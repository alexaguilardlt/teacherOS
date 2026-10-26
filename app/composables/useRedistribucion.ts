import type { RangoFecha, SesionRecolocada } from '~/utils/repartoAlgoritmo'
import type { DiaSemana } from '~/stores/cursoWizard.types'

export type SesionPropuesta = SesionRecolocada

export interface SubtemaParaRecolocar {
  id: string
  nombre: string
  duracionSesiones: number
}

export interface PreviewGrupoAsignatura {
  grupoAsignaturaId: string
  grupoNombre: string
  asignaturaNombre: string
  sesionesAEliminarIds: string[]
  sesionesNuevas: SesionPropuesta[]
  // Se quedan como 'cancelada' y sin contenido (una clase saltada).
  sesionesACancelarIds: string[]
  subtemasNoAsignados: string[]
  // Crea exactamente las mismas sesiones que quita: no hace falta aplicarla.
  sinCambios: boolean
}

export function useRedistribucion() {
  const supabase = useSupabaseClient()

  // Calcula, para cada asignatura-grupo del curso con sesiones en o después de
  // `nuevoFestivo.fechaInicio`, cómo quedaría el reparto si esas sesiones
  // futuras se recalculasen contra los huecos que quedan tras añadir ese
  // festivo (todavía no guardado en base de datos: es solo la previsualización).
  async function previsualizar(
    cursoId: string,
    nuevoFestivo: { fechaInicio: string, fechaFin: string }
  ): Promise<PreviewGrupoAsignatura[]> {
    const { data: curso } = await supabase
      .from('cursos')
      .select('fecha_fin')
      .eq('id', cursoId)
      .single()
    if (!curso) throw new Error('No se ha encontrado el curso.')

    const { data: festivos } = await supabase
      .from('dias_no_lectivos')
      .select('fecha_inicio, fecha_fin')
      .eq('curso_id', cursoId)
    const festivosRangos = [
      ...(festivos ?? []).map(f => ({ inicio: f.fecha_inicio, fin: f.fecha_fin })),
      { inicio: nuevoFestivo.fechaInicio, fin: nuevoFestivo.fechaFin }
    ]

    const { data: grupos } = await supabase
      .from('grupos')
      .select('id, nombre')
      .eq('curso_id', cursoId)
    const grupoIds = (grupos ?? []).map(g => g.id)
    if (!grupoIds.length) return []

    const { data: grupoAsignaturas } = await supabase
      .from('grupo_asignaturas')
      .select('id, grupo_id, asignatura_id')
      .in('grupo_id', grupoIds)
    if (!grupoAsignaturas?.length) return []

    const asignaturaIds = [...new Set(grupoAsignaturas.map(ga => ga.asignatura_id))]
    const { data: asignaturas } = await supabase
      .from('asignaturas')
      .select('id, nombre')
      .in('id', asignaturaIds)

    const previews: PreviewGrupoAsignatura[] = []

    for (const ga of grupoAsignaturas) {
      const preview = await previsualizarGrupoAsignatura(ga, curso.fecha_fin, nuevoFestivo, festivosRangos)
      if (!preview) continue
      preview.grupoNombre = grupos?.find(g => g.id === ga.grupo_id)?.nombre ?? ''
      preview.asignaturaNombre = asignaturas?.find(a => a.id === ga.asignatura_id)?.nombre ?? ''
      previews.push(preview)
    }

    return previews
  }

  async function previsualizarGrupoAsignatura(
    ga: { id: string, grupo_id: string, asignatura_id: string },
    cursoFechaFin: string,
    nuevoFestivo: { fechaInicio: string, fechaFin: string },
    festivosRangos: RangoFecha[]
  ): Promise<PreviewGrupoAsignatura | null> {
    const datos = await cargarSesionesYFranjas(ga.id)
    if (!datos) return null

    // Solo afecta a esta asignatura-grupo si de verdad tenía clase alguno de
    // los días que se marcan como no lectivos; si no coincide con su horario,
    // no hay nada que reorganizar.
    const tieneSesionEnFestivo = datos.sesiones.some(
      s => s.fecha >= nuevoFestivo.fechaInicio && s.fecha <= nuevoFestivo.fechaFin
        && s.estado !== 'impartida' && s.estado !== 'cancelada'
    )
    if (!tieneSesionEnFestivo) return null

    return calcularRecolocacion(ga, datos, {
      fechaCorte: nuevoFestivo.fechaInicio,
      fechaFin: cursoFechaFin,
      festivos: festivosRangos
    })
  }

  async function cargarSesionesYFranjas(grupoAsignaturaId: string) {
    const { data: franjas } = await supabase
      .from('franjas_horarias')
      .select('id, dia_semana, periodo_id')
      .eq('grupo_asignatura_id', grupoAsignaturaId)
    if (!franjas?.length) return null

    const { data: sesiones } = await supabase
      .from('sesiones')
      .select('id, fecha, estado, franja_horaria_id')
      .in('franja_horaria_id', franjas.map(f => f.id))
    if (!sesiones?.length) return null

    return { franjas, sesiones }
  }

  // Recalcula el reparto de una asignatura-grupo desde `fechaCorte` (ver
  // recolocarDesde). `subtemas` permite previsualizar con un temario que
  // todavía no se ha guardado; si no se pasa, se usa el de la base de datos.
  async function calcularRecolocacion(
    ga: { id: string, asignatura_id: string },
    // Las franjas son las que marcan los huecos a partir del corte (pueden ser
    // las de un horario aún sin guardar); las sesiones, las que hay ahora.
    datos: {
      franjas: { id: string, dia_semana: DiaSemana, periodo_id: string }[]
      sesiones: { id: string, fecha: string, estado: string, franja_horaria_id: string }[]
    },
    opciones: {
      fechaCorte: string
      fechaFin: string
      festivos: RangoFecha[]
      subtemas?: SubtemaParaRecolocar[]
      // Tramos de vigencia de cada horario tipo aún sin guardar; si no se
      // pasan, se usan los de la base de datos.
      vigencias?: Map<string, RangoFecha[]>
    }
  ): Promise<PreviewGrupoAsignatura> {
    const { franjas, sesiones } = datos

    const { data: sesionSubtemas } = await supabase
      .from('sesion_subtemas')
      .select('sesion_id, subtema_id')
      .in('sesion_id', sesiones.map(s => s.id))

    const periodoIds = franjas.map(f => f.periodo_id)
    const { data: periodos } = await supabase
      .from('periodos_horarios')
      .select('id, hora_inicio, horario_tipo_id')
      .in('id', periodoIds)
    const periodoPorId = new Map((periodos ?? []).map(p => [p.id, p]))

    let vigenciasPorHorarioTipoId = opciones.vigencias
    if (!vigenciasPorHorarioTipoId) {
      const horarioTipoIds = [...new Set((periodos ?? []).map(p => p.horario_tipo_id))]
      const { data: vigencias } = await supabase
        .from('horario_tipo_vigencias')
        .select('horario_tipo_id, fecha_inicio, fecha_fin')
        .in('horario_tipo_id', horarioTipoIds)
      vigenciasPorHorarioTipoId = vigenciasPorHorarioTipo(vigencias ?? [])
    }

    let subtemas = opciones.subtemas
    if (!subtemas) {
      const { data } = await supabase
        .from('subtemas')
        .select('id, nombre, duracion_sesiones')
        .eq('asignatura_id', ga.asignatura_id)
        .order('orden', { ascending: true })
      subtemas = (data ?? []).map(s => ({ id: s.id, nombre: s.nombre, duracionSesiones: Number(s.duracion_sesiones) }))
    }

    const franjasParaSlots = franjas
      .map((franja) => {
        const periodo = periodoPorId.get(franja.periodo_id)
        if (!periodo) return null
        return {
          franjaId: franja.id,
          diaSemana: franja.dia_semana,
          horaInicio: periodo.hora_inicio,
          vigencias: vigenciasPorHorarioTipoId!.get(periodo.horario_tipo_id)
        }
      })
      .filter((f): f is NonNullable<typeof f> => f !== null)

    const sesionesExistentes = sesiones.map(s => ({ id: s.id, franjaId: s.franja_horaria_id, fecha: s.fecha, estado: s.estado }))
    const enlaces = (sesionSubtemas ?? []).map(ss => ({ sesionId: ss.sesion_id, subtemaId: ss.subtema_id }))
    const resultado = recolocarDesde({
      subtemasOrdenados: subtemas,
      sesiones: sesionesExistentes,
      enlaces,
      franjas: franjasParaSlots,
      fechaCorte: opciones.fechaCorte,
      fechaFin: opciones.fechaFin,
      festivos: opciones.festivos
    })

    const nombrePorId = new Map(subtemas.map(s => [s.id, s.nombre]))

    return {
      grupoAsignaturaId: ga.id,
      grupoNombre: '',
      asignaturaNombre: '',
      sesionesAEliminarIds: resultado.sesionesAEliminarIds,
      sesionesNuevas: resultado.sesionesNuevas,
      sesionesACancelarIds: [],
      subtemasNoAsignados: resultado.subtemasNoAsignadosIds.map(id => nombrePorId.get(id) ?? id),
      sinCambios: recolocacionSinCambios(resultado, sesionesExistentes, enlaces)
    }
  }

  // Cómo quedaría el reparto de cada grupo que tiene esta asignatura si el
  // temario pasase a ser `subtemas` (aún sin guardar). Se recoloca desde hoy:
  // lo anterior y lo ya impartido no se toca. Solo devuelve los grupos que
  // ya tienen sesiones generadas.
  async function previsualizarCambioTemario(
    asignaturaId: string,
    subtemas: SubtemaParaRecolocar[]
  ): Promise<PreviewGrupoAsignatura[]> {
    const { data: grupoAsignaturas } = await supabase
      .from('grupo_asignaturas')
      .select('id, grupo_id, asignatura_id')
      .eq('asignatura_id', asignaturaId)
    if (!grupoAsignaturas?.length) return []

    const { data: grupos } = await supabase
      .from('grupos')
      .select('id, nombre, curso_id')
      .in('id', grupoAsignaturas.map(ga => ga.grupo_id))
    const cursoIds = [...new Set((grupos ?? []).map(g => g.curso_id))]

    const { data: cursos } = await supabase
      .from('cursos')
      .select('id, fecha_inicio, fecha_fin')
      .in('id', cursoIds)
    const { data: festivos } = await supabase
      .from('dias_no_lectivos')
      .select('curso_id, fecha_inicio, fecha_fin')
      .in('curso_id', cursoIds)

    const { data: asignatura } = await supabase
      .from('asignaturas')
      .select('nombre')
      .eq('id', asignaturaId)
      .single()

    const hoy = fechaLocalISO()
    const previews: PreviewGrupoAsignatura[] = []

    for (const ga of grupoAsignaturas) {
      const grupo = grupos?.find(g => g.id === ga.grupo_id)
      const curso = cursos?.find(c => c.id === grupo?.curso_id)
      // Un curso ya terminado no tiene nada que recolocar.
      if (!grupo || !curso || hoy > curso.fecha_fin) continue

      const datos = await cargarSesionesYFranjas(ga.id)
      if (!datos) continue

      const preview = await calcularRecolocacion(ga, datos, {
        fechaCorte: hoy > curso.fecha_inicio ? hoy : curso.fecha_inicio,
        fechaFin: curso.fecha_fin,
        festivos: (festivos ?? [])
          .filter(f => f.curso_id === curso.id)
          .map(f => ({ inicio: f.fecha_inicio, fin: f.fecha_fin })),
        subtemas
      })
      preview.grupoNombre = grupo.nombre
      preview.asignaturaNombre = asignatura?.nombre ?? ''
      previews.push(preview)
    }

    return previews
  }

  // Cómo quedaría el reparto de las asignaturas de un grupo cuyo horario
  // cambia (franjas añadidas, quitadas o movidas, aún sin guardar). Se
  // recoloca desde hoy con las franjas nuevas; lo anterior y lo ya impartido
  // no se toca. Solo devuelve las asignaturas que ya tienen sesiones.
  async function previsualizarCambioHorario(
    grupoId: string,
    cambios: { grupoAsignaturaId: string, asignaturaId: string, franjas: { id: string, dia_semana: DiaSemana, periodo_id: string }[] }[]
  ): Promise<PreviewGrupoAsignatura[]> {
    if (!cambios.length) return []

    const { data: grupo } = await supabase
      .from('grupos')
      .select('nombre, curso_id')
      .eq('id', grupoId)
      .single()
    if (!grupo) throw new Error('No se ha encontrado el grupo.')

    const { data: curso } = await supabase
      .from('cursos')
      .select('fecha_inicio, fecha_fin')
      .eq('id', grupo.curso_id)
      .single()
    if (!curso) throw new Error('No se ha encontrado el curso.')

    const hoy = fechaLocalISO()
    // Un curso ya terminado no tiene nada que recolocar.
    if (hoy > curso.fecha_fin) return []

    const { data: festivos } = await supabase
      .from('dias_no_lectivos')
      .select('fecha_inicio, fecha_fin')
      .eq('curso_id', grupo.curso_id)

    const { data: asignaturas } = await supabase
      .from('asignaturas')
      .select('id, nombre')
      .in('id', cambios.map(c => c.asignaturaId))

    const previews: PreviewGrupoAsignatura[] = []
    for (const cambio of cambios) {
      const actuales = await cargarSesionesYFranjas(cambio.grupoAsignaturaId)
      if (!actuales) continue

      const preview = await calcularRecolocacion(
        { id: cambio.grupoAsignaturaId, asignatura_id: cambio.asignaturaId },
        { franjas: cambio.franjas, sesiones: actuales.sesiones },
        {
          fechaCorte: hoy > curso.fecha_inicio ? hoy : curso.fecha_inicio,
          fechaFin: curso.fecha_fin,
          festivos: (festivos ?? []).map(f => ({ inicio: f.fecha_inicio, fin: f.fecha_fin }))
        }
      )
      preview.grupoNombre = grupo.nombre
      preview.asignaturaNombre = asignaturas?.find(a => a.id === cambio.asignaturaId)?.nombre ?? ''
      previews.push(preview)
    }
    return previews
  }

  // Cómo quedaría el reparto de cada asignatura-grupo del curso si su
  // calendario (fechas, festivos, tramos de vigencia; aún sin guardar)
  // pasase a ser `calendario`. Se recoloca desde hoy; lo anterior y lo ya
  // impartido no se toca. Solo devuelve las que de verdad cambian.
  async function previsualizarCambioCurso(
    cursoId: string,
    calendario: { fechaInicio: string, fechaFin: string, festivos: RangoFecha[], vigencias: Map<string, RangoFecha[]> }
  ): Promise<PreviewGrupoAsignatura[]> {
    const { data: grupos } = await supabase
      .from('grupos')
      .select('id, nombre')
      .eq('curso_id', cursoId)
    if (!grupos?.length) return []

    const { data: grupoAsignaturas } = await supabase
      .from('grupo_asignaturas')
      .select('id, grupo_id, asignatura_id')
      .in('grupo_id', grupos.map(g => g.id))
    if (!grupoAsignaturas?.length) return []

    const { data: asignaturas } = await supabase
      .from('asignaturas')
      .select('id, nombre')
      .in('id', [...new Set(grupoAsignaturas.map(ga => ga.asignatura_id))])

    const hoy = fechaLocalISO()
    const previews: PreviewGrupoAsignatura[] = []
    for (const ga of grupoAsignaturas) {
      const datos = await cargarSesionesYFranjas(ga.id)
      if (!datos) continue

      const preview = await calcularRecolocacion(ga, datos, {
        fechaCorte: hoy > calendario.fechaInicio ? hoy : calendario.fechaInicio,
        fechaFin: calendario.fechaFin,
        festivos: calendario.festivos,
        vigencias: calendario.vigencias
      })
      if (preview.sinCambios) continue
      preview.grupoNombre = grupos.find(g => g.id === ga.grupo_id)?.nombre ?? ''
      preview.asignaturaNombre = asignaturas?.find(a => a.id === ga.asignatura_id)?.nombre ?? ''
      previews.push(preview)
    }
    return previews
  }

  // Aplica previews ya calculados en una sola transacción (función de
  // Postgres aplicar_recolocacion): o se guardan todos, o ninguno. Las
  // sesiones nuevas se crean ya "confirmada" (el profesor ya ha revisado la
  // vista previa). Si se pasa un festivo, se guarda en la misma transacción.
  async function aplicarRecolocaciones(
    previews: PreviewGrupoAsignatura[],
    festivo?: { cursoId: string, nombre: string, fechaInicio: string, fechaFin: string }
  ) {
    const { error } = await supabase.rpc('aplicar_recolocacion', {
      recolocaciones: recolocacionesConfirmadas(previews),
      festivo: festivo
        ? { curso_id: festivo.cursoId, nombre: festivo.nombre, fecha_inicio: festivo.fechaInicio, fecha_fin: festivo.fechaFin }
        : undefined
    })
    if (error) throw error
  }

  async function confirmar(
    cursoId: string,
    nuevoFestivo: { nombre: string, fechaInicio: string, fechaFin: string },
    previews: PreviewGrupoAsignatura[]
  ) {
    await aplicarRecolocaciones(previews, { cursoId, ...nuevoFestivo })
  }

  // Salta una única fecha para una única asignatura-grupo, sin marcar el
  // día como no lectivo para el resto del curso (eso ya lo cubre
  // previsualizar/confirmar). Pensado para "hoy no doy esta asignatura en
  // concreto" (una excursión de ese grupo, el profesor no puede dar esa
  // clase puntual...), no para un festivo real de centro.
  async function previsualizarUnaAsignatura(
    grupoAsignaturaId: string,
    fecha: string
  ): Promise<PreviewGrupoAsignatura | null> {
    const { data: ga } = await supabase
      .from('grupo_asignaturas')
      .select('id, grupo_id, asignatura_id')
      .eq('id', grupoAsignaturaId)
      .single()
    if (!ga) throw new Error('No se ha encontrado la asignación de esta asignatura al grupo.')

    const { data: grupo } = await supabase
      .from('grupos')
      .select('nombre, curso_id')
      .eq('id', ga.grupo_id)
      .single()
    if (!grupo) throw new Error('No se ha encontrado el grupo.')

    const { data: curso } = await supabase
      .from('cursos')
      .select('fecha_fin')
      .eq('id', grupo.curso_id)
      .single()
    if (!curso) throw new Error('No se ha encontrado el curso.')

    const { data: asignatura } = await supabase
      .from('asignaturas')
      .select('nombre')
      .eq('id', ga.asignatura_id)
      .single()

    const { data: festivos } = await supabase
      .from('dias_no_lectivos')
      .select('fecha_inicio, fecha_fin')
      .eq('curso_id', grupo.curso_id)
    const festivosRangos = [
      ...(festivos ?? []).map(f => ({ inicio: f.fecha_inicio, fin: f.fecha_fin })),
      { inicio: fecha, fin: fecha }
    ]

    // La clase de ese día no se borra: se cancela, para que quede guardado
    // que ese día no hay clase y ninguna recolocación posterior la vuelva a
    // poner (las canceladas son huecos ocupados para el algoritmo).
    const datos = await cargarSesionesYFranjas(ga.id)
    const { aCancelar, motivo } = sesionesAlSaltarUnDia(
      (datos?.sesiones ?? []).map(s => ({ id: s.id, franjaId: s.franja_horaria_id, fecha: s.fecha, estado: s.estado })),
      fecha,
      fechaLocalISO()
    )
    if (motivo) throw new Error(motivo)

    const preview = await previsualizarGrupoAsignatura(ga, curso.fecha_fin, { fechaInicio: fecha, fechaFin: fecha }, festivosRangos)
    if (!preview) return null
    preview.sesionesACancelarIds = aCancelar
    preview.sesionesAEliminarIds = preview.sesionesAEliminarIds.filter(id => !aCancelar.includes(id))
    preview.grupoNombre = grupo.nombre
    preview.asignaturaNombre = asignatura?.nombre ?? ''
    return preview
  }

  // Cómo quedaría el reparto de una asignatura-grupo si se recupera una
  // clase saltada (cancelada): ese día vuelve a tener clase y se recoloca
  // desde su fecha. Se confirma con confirmarUnaAsignatura.
  async function previsualizarRecuperarClase(
    grupoAsignaturaId: string,
    sesionId: string
  ): Promise<PreviewGrupoAsignatura> {
    const { data: ga } = await supabase
      .from('grupo_asignaturas')
      .select('id, grupo_id, asignatura_id')
      .eq('id', grupoAsignaturaId)
      .single()
    if (!ga) throw new Error('No se ha encontrado la asignación de esta asignatura al grupo.')

    const { data: grupo } = await supabase
      .from('grupos')
      .select('nombre, curso_id')
      .eq('id', ga.grupo_id)
      .single()
    if (!grupo) throw new Error('No se ha encontrado el grupo.')

    const { data: curso } = await supabase
      .from('cursos')
      .select('fecha_fin')
      .eq('id', grupo.curso_id)
      .single()
    if (!curso) throw new Error('No se ha encontrado el curso.')

    const { data: festivos } = await supabase
      .from('dias_no_lectivos')
      .select('fecha_inicio, fecha_fin')
      .eq('curso_id', grupo.curso_id)

    const datos = await cargarSesionesYFranjas(ga.id)
    if (!datos) throw new Error('Esta asignatura no tiene reparto.')

    const preparado = prepararRecuperarClase(
      datos.sesiones.map(s => ({ id: s.id, franjaId: s.franja_horaria_id, fecha: s.fecha, estado: s.estado })),
      sesionId,
      fechaLocalISO()
    )
    if ('motivo' in preparado) throw new Error(preparado.motivo)

    const estadoPorId = new Map(preparado.sesiones.map(s => [s.id, s.estado]))
    const preview = await calcularRecolocacion(
      ga,
      { franjas: datos.franjas, sesiones: datos.sesiones.map(s => ({ ...s, estado: estadoPorId.get(s.id)! })) },
      {
        fechaCorte: preparado.fechaCorte,
        fechaFin: curso.fecha_fin,
        festivos: (festivos ?? []).map(f => ({ inicio: f.fecha_inicio, fin: f.fecha_fin }))
      }
    )

    const { data: asignatura } = await supabase
      .from('asignaturas')
      .select('nombre')
      .eq('id', ga.asignatura_id)
      .single()
    preview.grupoNombre = grupo.nombre
    preview.asignaturaNombre = asignatura?.nombre ?? ''
    return preview
  }

  async function confirmarUnaAsignatura(preview: PreviewGrupoAsignatura) {
    await aplicarRecolocaciones([preview])
  }

  return { previsualizar, confirmar, previsualizarUnaAsignatura, previsualizarRecuperarClase, confirmarUnaAsignatura, previsualizarCambioTemario, previsualizarCambioHorario, previsualizarCambioCurso, aplicarRecolocaciones }
}
