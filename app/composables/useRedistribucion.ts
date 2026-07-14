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
      .select('id, nombre, profesor_id')
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
      .select('id, nombre, profesor_id')
      .in('id', asignaturaIds)

    const previews: PreviewGrupoAsignatura[] = []

    for (const ga of grupoAsignaturas) {
      const profesorId = grupos?.find(g => g.id === ga.grupo_id)?.profesor_id ?? ''
      const preview = await previsualizarGrupoAsignatura(ga, profesorId, curso.fecha_fin, nuevoFestivo, festivosRangos)
      if (!preview) continue
      preview.grupoNombre = grupos?.find(g => g.id === ga.grupo_id)?.nombre ?? ''
      preview.asignaturaNombre = asignaturas?.find(a => a.id === ga.asignatura_id)?.nombre ?? ''
      previews.push(preview)
    }

    return previews
  }

  async function previsualizarGrupoAsignatura(
    ga: { id: string, grupo_id: string, asignatura_id: string },
    profesorId: string,
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
      .select('id, hora_inicio')
      .in('id', periodoIds)
    const periodoPorId = new Map((periodos ?? []).map(p => [p.id, p]))

    const { data: temas } = await supabase
      .from('temas')
      .select('id, orden')
      .eq('asignatura_id', ga.asignatura_id)
      .order('orden', { ascending: true })
    const temaIds = (temas ?? []).map(t => t.id)

    const subtemasRaw = temaIds.length
      ? (await supabase
          .from('subtemas')
          .select('id, tema_id, nombre, orden, dificultad')
          .in('tema_id', temaIds)).data ?? []
      : []

    const ordenTema = new Map((temas ?? []).map(t => [t.id, t.orden]))
    const subtemasOrdenados = [...subtemasRaw].sort((a, b) => {
      const ta = ordenTema.get(a.tema_id) ?? 0
      const tb = ordenTema.get(b.tema_id) ?? 0
      if (ta !== tb) return ta - tb
      return a.orden - b.orden
    })
    if (!subtemasOrdenados.length) return null

    const { data: reglas } = await supabase
      .from('reglas_dificultad')
      .select('dificultad, duracion_sesiones')
      .eq('profesor_id', profesorId)
    const duracionPorDificultad = new Map((reglas ?? []).map(r => [r.dificultad, Number(r.duracion_sesiones)]))

    // Se reconstruyen los bloques exactamente como en el reparto original
    // (mismo temario, mismas reglas de dificultad) para que el emparejamiento
    // de subtemas "fáciles" no cambie; luego se separan en entregados/pendientes
    // según si ya se dio alguna sesión de ese bloque antes del corte.
    const bloques = agruparEnBloques(subtemasOrdenados, duracionPorDificultad)
    const bloquesPendientes = bloques.filter(
      (bloque: Bloque) => !bloque.subtemaIds.every(id => subtemaIdsEntregados.has(id))
    )

    const franjasParaSlots = franjas
      .map((franja) => {
        const periodo = periodoPorId.get(franja.periodo_id)
        if (!periodo) return null
        return { franjaId: franja.id, diaSemana: franja.dia_semana, horaInicio: periodo.hora_inicio }
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
      if (preview.sesionesAEliminarIds.length) {
        const { error } = await supabase.from('sesiones').delete().in('id', preview.sesionesAEliminarIds)
        if (error) throw error
      }

      if (!preview.sesionesNuevas.length) continue

      const { data: sesionesInsertadas, error: errorSesiones } = await supabase
        .from('sesiones')
        .insert(preview.sesionesNuevas.map(s => ({ franja_horaria_id: s.franjaId, fecha: s.fecha })))
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
  }

  return { previsualizar, confirmar }
}
