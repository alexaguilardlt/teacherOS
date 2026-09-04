import type { Bloque } from '~/utils/repartoAlgoritmo'

export interface SesionPropuesta {
  franjaId: string
  fecha: string
  subtemas: { subtemaId: string, fraccion: number }[]
}

export interface PreviewGrupoAsignatura {
  grupoAsignaturaId: string
  grupoNombre: string
  asignaturaNombre: string
  sesionesAEliminarIds: string[]
  sesionesNuevas: SesionPropuesta[]
  subtemasNoAsignados: string[]
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
    festivosRangos: { inicio: string, fin: string }[]
  ): Promise<PreviewGrupoAsignatura | null> {
    const fechaCorte = nuevoFestivo.fechaInicio

    const { data: franjas } = await supabase
      .from('franjas_horarias')
      .select('id, dia_semana, periodo_id')
      .eq('grupo_asignatura_id', ga.id)
    if (!franjas?.length) return null

    const franjaIds = franjas.map(f => f.id)
    const { data: sesiones } = await supabase
      .from('sesiones')
      .select('id, fecha, estado, franja_horaria_id')
      .in('franja_horaria_id', franjaIds)
    if (!sesiones?.length) return null

    // Solo afecta a esta asignatura-grupo si de verdad tenía clase alguno de
    // los días que se marcan como no lectivos; si no coincide con su horario,
    // no hay nada que reorganizar.
    const tieneSesionEnFestivo = sesiones.some(
      s => s.fecha >= nuevoFestivo.fechaInicio && s.fecha <= nuevoFestivo.fechaFin && s.estado !== 'impartida'
    )
    if (!tieneSesionEnFestivo) return null

    const sesionesFuturas = sesiones.filter(s => s.fecha >= fechaCorte && s.estado !== 'impartida')
    const sesionesFijasIds = sesiones.filter(s => !sesionesFuturas.includes(s)).map(s => s.id)
    const sesionIds = sesiones.map(s => s.id)

    const { data: sesionSubtemas } = await supabase
      .from('sesion_subtemas')
      .select('sesion_id, subtema_id, fraccion')
      .in('sesion_id', sesionIds)

    const subtemaIdsEntregados = new Set(
      (sesionSubtemas ?? [])
        .filter(ss => sesionesFijasIds.includes(ss.sesion_id))
        .map(ss => ss.subtema_id)
    )

    const periodoIds = franjas.map(f => f.periodo_id)
    const { data: periodos } = await supabase
      .from('periodos_horarios')
      .select('id, hora_inicio, horario_tipo_id')
      .in('id', periodoIds)
    const periodoPorId = new Map((periodos ?? []).map(p => [p.id, p]))

    const horarioTipoIds = [...new Set((periodos ?? []).map(p => p.horario_tipo_id))]
    const { data: horariosTipo } = await supabase
      .from('horarios_tipo')
      .select('id, vigencia_inicio, vigencia_fin')
      .in('id', horarioTipoIds)
    const horarioTipoPorId = new Map((horariosTipo ?? []).map(ht => [ht.id, ht]))

    const { data: subtemasOrdenados } = await supabase
      .from('subtemas')
      .select('id, nombre, duracion_sesiones')
      .eq('asignatura_id', ga.asignatura_id)
      .order('orden', { ascending: true })
    if (!subtemasOrdenados || !subtemasOrdenados.length) return null

    // Se reconstruyen los bloques exactamente como en el reparto original
    // (mismo temario, mismas duraciones) para que el emparejamiento de
    // subtemas de 0.5 sesiones no cambie; luego se separan en
    // entregados/pendientes según si ya se dio alguna sesión de ese bloque
    // antes del corte.
    const bloques = agruparEnBloques(
      subtemasOrdenados.map(s => ({ id: s.id, duracionSesiones: Number(s.duracion_sesiones) }))
    )
    const bloquesPendientes = bloques.filter(
      (bloque: Bloque) => !bloque.subtemaIds.every(id => subtemaIdsEntregados.has(id))
    )

    const franjasParaSlots = franjas
      .map((franja) => {
        const periodo = periodoPorId.get(franja.periodo_id)
        if (!periodo) return null
        const horarioTipo = horarioTipoPorId.get(periodo.horario_tipo_id)
        return {
          franjaId: franja.id,
          diaSemana: franja.dia_semana,
          horaInicio: periodo.hora_inicio,
          vigenciaInicio: horarioTipo?.vigencia_inicio ?? undefined,
          vigenciaFin: horarioTipo?.vigencia_fin ?? undefined
        }
      })
      .filter((f): f is NonNullable<typeof f> => f !== null)

    const slots = construirSlots(franjasParaSlots, fechaCorte, cursoFechaFin, festivosRangos)

    const { asignaciones, subtemasNoAsignadosIds } = repartirBloques(bloquesPendientes, slots)

    const sesionesPorClave = new Map<string, SesionPropuesta>()
    for (const a of asignaciones) {
      const clave = `${a.slot.franjaId}__${a.slot.fecha}`
      if (!sesionesPorClave.has(clave)) {
        sesionesPorClave.set(clave, { franjaId: a.slot.franjaId, fecha: a.slot.fecha, subtemas: [] })
      }
      sesionesPorClave.get(clave)!.subtemas.push({ subtemaId: a.subtemaId, fraccion: a.fraccion })
    }

    const nombrePorId = new Map(subtemasOrdenados.map(s => [s.id, s.nombre]))
    const subtemasNoAsignados = [...new Set(subtemasNoAsignadosIds)].map(id => nombrePorId.get(id) ?? id)

    return {
      grupoAsignaturaId: ga.id,
      grupoNombre: '',
      asignaturaNombre: '',
      sesionesAEliminarIds: sesionesFuturas.map(s => s.id),
      sesionesNuevas: [...sesionesPorClave.values()],
      subtemasNoAsignados
    }
  }

  // Aplica un preview ya calculado: borra las sesiones futuras afectadas y
  // crea las nuevas ya "confirmada" (el profesor ya ha revisado el preview,
  // no hace falta un paso de confirmación aparte para estas).
  async function aplicarPreview(preview: PreviewGrupoAsignatura) {
    if (preview.sesionesAEliminarIds.length) {
      const { error } = await supabase.from('sesiones').delete().in('id', preview.sesionesAEliminarIds)
      if (error) throw error
    }

    if (!preview.sesionesNuevas.length) return

    const { data: sesionesInsertadas, error: errorSesiones } = await supabase
      .from('sesiones')
      .insert(preview.sesionesNuevas.map(s => ({ franja_horaria_id: s.franjaId, fecha: s.fecha, estado: 'confirmada' as const })))
      .select('id')
    if (errorSesiones || !sesionesInsertadas || sesionesInsertadas.length !== preview.sesionesNuevas.length) {
      throw errorSesiones ?? new Error('No se han podido crear las sesiones redistribuidas.')
    }

    const filasSubtemas = preview.sesionesNuevas.flatMap((sesion, indice) =>
      sesion.subtemas.map(s => ({
        sesion_id: sesionesInsertadas[indice]!.id,
        subtema_id: s.subtemaId,
        fraccion: s.fraccion
      }))
    )
    if (filasSubtemas.length) {
      const { error: errorSubtemas } = await supabase.from('sesion_subtemas').insert(filasSubtemas)
      if (errorSubtemas) throw errorSubtemas
    }
  }

  async function confirmar(
    cursoId: string,
    nuevoFestivo: { nombre: string, fechaInicio: string, fechaFin: string },
    previews: PreviewGrupoAsignatura[]
  ) {
    const { error: errorFestivo } = await supabase.from('dias_no_lectivos').insert({
      curso_id: cursoId,
      nombre: nuevoFestivo.nombre || null,
      fecha_inicio: nuevoFestivo.fechaInicio,
      fecha_fin: nuevoFestivo.fechaFin
    })
    if (errorFestivo) throw errorFestivo

    for (const preview of previews) {
      await aplicarPreview(preview)
    }
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

    const preview = await previsualizarGrupoAsignatura(ga, curso.fecha_fin, { fechaInicio: fecha, fechaFin: fecha }, festivosRangos)
    if (!preview) return null
    preview.grupoNombre = grupo.nombre
    preview.asignaturaNombre = asignatura?.nombre ?? ''
    return preview
  }

  async function confirmarUnaAsignatura(preview: PreviewGrupoAsignatura) {
    await aplicarPreview(preview)
  }

  return { previsualizar, confirmar, previsualizarUnaAsignatura, confirmarUnaAsignatura }
}
