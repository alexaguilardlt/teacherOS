export interface ResultadoReparto {
  sesionesCreadas: number
  subtemasNoAsignados: string[]
}

export function useReparto() {
  const supabase = useSupabaseClient()

  async function generar(grupoAsignaturaId: string): Promise<ResultadoReparto> {
    const { data: ga } = await supabase
      .from('grupo_asignaturas')
      .select('id, grupo_id, asignatura_id')
      .eq('id', grupoAsignaturaId)
      .single()
    if (!ga) throw new Error('No se ha encontrado la asignación de esta asignatura al grupo.')

    const { data: grupo } = await supabase
      .from('grupos')
      .select('curso_id, profesor_id')
      .eq('id', ga.grupo_id)
      .single()
    if (!grupo) throw new Error('No se ha encontrado el grupo.')

    const { data: curso } = await supabase
      .from('cursos')
      .select('fecha_inicio, fecha_fin')
      .eq('id', grupo.curso_id)
      .single()
    if (!curso) throw new Error('No se ha encontrado el curso.')

    const { data: festivos } = await supabase
      .from('dias_no_lectivos')
      .select('fecha_inicio, fecha_fin')
      .eq('curso_id', grupo.curso_id)

    const { data: franjas } = await supabase
      .from('franjas_horarias')
      .select('id, dia_semana, periodo_id')
      .eq('grupo_asignatura_id', grupoAsignaturaId)
    if (!franjas || !franjas.length) {
      throw new Error('Este grupo todavía no tiene horario asignado para esta asignatura.')
    }

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
    if (!subtemasOrdenados.length) {
      throw new Error('Esta asignatura todavía no tiene temario (temas y puntos del tema).')
    }

    const { data: reglas } = await supabase
      .from('reglas_dificultad')
      .select('dificultad, duracion_sesiones')
      .eq('profesor_id', grupo.profesor_id)
    const duracionPorDificultad = new Map((reglas ?? []).map(r => [r.dificultad, Number(r.duracion_sesiones)]))

    // --- 1) Fechas de clase reales para cada franja de este grupo+asignatura ---
    const festivosRangos = (festivos ?? []).map(f => ({ inicio: f.fecha_inicio, fin: f.fecha_fin }))
    const franjasParaSlots = franjas
      .map((franja) => {
        const periodo = periodoPorId.get(franja.periodo_id)
        if (!periodo) return null
        return { franjaId: franja.id, diaSemana: franja.dia_semana, horaInicio: periodo.hora_inicio }
      })
      .filter((f): f is NonNullable<typeof f> => f !== null)

    const slots = construirSlots(franjasParaSlots, curso.fecha_inicio, curso.fecha_fin, festivosRangos)
    if (!slots.length) {
      throw new Error('No hay días lectivos disponibles para el horario de este grupo.')
    }

    // --- 2) Agrupar subtemas en bloques según su duración (0.5 sesiones se emparejan) ---
    const bloques = agruparEnBloques(subtemasOrdenados, duracionPorDificultad)

    // --- 3) Repartir los bloques a lo largo de todo el curso (no solo al principio) ---
    const { asignaciones, subtemasNoAsignadosIds } = repartirBloques(bloques, slots)

    // --- 4) Agrupar por sesión (misma franja+fecha) e insertar ---
    const sesionesPorClave = new Map<string, { franjaId: string, fecha: string, subtemas: { subtemaId: string, fraccion: number }[] }>()
    for (const a of asignaciones) {
      const clave = `${a.slot.franjaId}__${a.slot.fecha}`
      if (!sesionesPorClave.has(clave)) {
        sesionesPorClave.set(clave, { franjaId: a.slot.franjaId, fecha: a.slot.fecha, subtemas: [] })
      }
      sesionesPorClave.get(clave)!.subtemas.push({ subtemaId: a.subtemaId, fraccion: a.fraccion })
    }

    const entradas = [...sesionesPorClave.values()]

    const { data: sesionesInsertadas, error: errorSesiones } = await supabase
      .from('sesiones')
      .insert(entradas.map(e => ({ franja_horaria_id: e.franjaId, fecha: e.fecha })))
      .select('id')
    if (errorSesiones || !sesionesInsertadas || sesionesInsertadas.length !== entradas.length) {
      throw errorSesiones ?? new Error('No se han podido crear las sesiones.')
    }

    const filasSubtemas = entradas.flatMap((entrada, indice) =>
      entrada.subtemas.map(s => ({
        sesion_id: sesionesInsertadas[indice]!.id,
        subtema_id: s.subtemaId,
        fraccion: s.fraccion
      }))
    )
    if (filasSubtemas.length) {
      const { error: errorSubtemas } = await supabase.from('sesion_subtemas').insert(filasSubtemas)
      if (errorSubtemas) throw errorSubtemas
    }

    const sesionesCreadas = sesionesInsertadas.length

    const nombrePorId = new Map(subtemasOrdenados.map(s => [s.id, s.nombre]))
    const subtemasNoAsignados = [...new Set(subtemasNoAsignadosIds)].map(id => nombrePorId.get(id) ?? id)

    return { sesionesCreadas, subtemasNoAsignados }
  }

  async function eliminarTodas(grupoAsignaturaId: string) {
    const { data: franjas } = await supabase
      .from('franjas_horarias')
      .select('id')
      .eq('grupo_asignatura_id', grupoAsignaturaId)
    const franjaIds = (franjas ?? []).map(f => f.id)
    if (!franjaIds.length) return

    const { error } = await supabase
      .from('sesiones')
      .delete()
      .in('franja_horaria_id', franjaIds)
    if (error) throw error
  }

  return { generar, eliminarTodas }
}
