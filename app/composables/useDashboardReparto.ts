export interface CeldaCalendario {
  fecha: string
  dia: number
  sesiones: { color: string, grupo: string, asignatura: string }[]
  festivo: string | null
}

export interface MesCalendario {
  etiqueta: string
  semanas: (CeldaCalendario | null)[][]
}

const DIAS_SEMANA_CALENDARIO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const DIAS_SEMANA_HORARIO = [
  { value: 'lunes', label: 'Lunes' },
  { value: 'martes', label: 'Martes' },
  { value: 'miercoles', label: 'Miércoles' },
  { value: 'jueves', label: 'Jueves' },
  { value: 'viernes', label: 'Viernes' }
]

const etiquetaEstado: Record<string, string> = {
  propuesta: 'Propuesta',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  impartida: 'Impartida'
}

const colorEstado: Record<string, 'neutral' | 'success' | 'error' | 'primary'> = {
  propuesta: 'neutral',
  confirmada: 'success',
  cancelada: 'error',
  impartida: 'primary'
}

// `data ?? []` en un fallo de consulta (ej. una columna que no existe
// todavía porque falta aplicar una migración) deja el dashboard con un
// "no hay nada" silencioso, indistinguible de que de verdad no hay datos.
// Este aviso en consola es la red de seguridad mínima para detectarlo.
function avisarSiError(tabla: string, error: unknown) {
  if (error) console.error(`[dashboard] error al leer "${tabla}":`, error)
}

export function useDashboardReparto() {
  const user = useSupabaseUser()
  const supabase = useSupabaseClient()

  const { data: profesor } = useAsyncData('dashboard-profesor', async () => {
    if (!user.value) return null
    const { data } = await supabase
      .from('profesores')
      .select('nombre')
      .eq('id', user.value.sub)
      .single()
    return data
  }, { watch: [user] })

  const { data: cursos } = useAsyncData('dashboard-cursos', async () => {
    const { data, error } = await supabase
      .from('cursos')
      .select('id, nombre, fecha_inicio, fecha_fin')
      .order('creado_en', { ascending: false })
    avisarSiError('cursos', error)
    return data ?? []
  })

  const { data: festivos } = useAsyncData('dashboard-festivos', async () => {
    const { data, error } = await supabase
      .from('dias_no_lectivos')
      .select('id, curso_id, nombre, fecha_inicio, fecha_fin')
    avisarSiError('dias_no_lectivos', error)
    return data ?? []
  })

  const { data: asignaturas } = useAsyncData('dashboard-asignaturas', async () => {
    const { data, error } = await supabase
      .from('asignaturas')
      .select('id, nombre')
      .order('creado_en', { ascending: false })
    avisarSiError('asignaturas', error)
    return data ?? []
  })

  const { data: grupos } = useAsyncData('dashboard-grupos', async () => {
    const { data, error } = await supabase
      .from('grupos')
      .select('id, curso_id, nombre, color')
      .order('creado_en', { ascending: false })
    avisarSiError('grupos', error)
    return data ?? []
  })

  const { data: grupoAsignaturas } = useAsyncData('dashboard-grupo-asignaturas', async () => {
    const { data, error } = await supabase
      .from('grupo_asignaturas')
      .select('id, grupo_id, asignatura_id')
    avisarSiError('grupo_asignaturas', error)
    return data ?? []
  })

  const { data: periodos } = useAsyncData('dashboard-periodos', async () => {
    const { data, error } = await supabase
      .from('periodos_horarios')
      .select('id, hora_inicio, hora_fin, horario_tipo_id')
    avisarSiError('periodos_horarios', error)
    return data ?? []
  })

  const { data: horariosTipo } = useAsyncData('dashboard-horarios-tipo', async () => {
    const { data, error } = await supabase
      .from('horarios_tipo')
      .select('id, curso_id, nombre, vigencia_inicio, vigencia_fin')
    avisarSiError('horarios_tipo', error)
    return data ?? []
  })

  const { data: horarios } = useAsyncData('dashboard-horarios', async () => {
    const { data, error } = await supabase
      .from('franjas_horarias')
      .select('id, grupo_asignatura_id, dia_semana, periodo_id')
    avisarSiError('franjas_horarias', error)
    return data ?? []
  })

  const sesionesAsyncData = useAsyncData('dashboard-sesiones', async () => {
    const { data, error } = await supabase
      .from('sesiones')
      .select('id, fecha, estado, notas, franja_horaria_id')
      .order('fecha', { ascending: true })
    avisarSiError('sesiones', error)
    return data ?? []
  })
  const { data: sesiones } = sesionesAsyncData

  // Estas tres dependen unas de otras (sesiones -> sesion_subtemas -> subtemas ->
  // temas). En vez de usar `watch` para re-disparar el fetch cuando la anterior
  // resuelve, cada una espera explícitamente a que la anterior termine antes de
  // leer su `.value`: es más predecible que depender del reactivity timing.
  const sesionSubtemasAsyncData = useAsyncData('dashboard-sesion-subtemas', async () => {
    await sesionesAsyncData
    const sesionIds = (sesiones.value ?? []).map(s => s.id)
    if (!sesionIds.length) return []
    const { data, error } = await supabase
      .from('sesion_subtemas')
      .select('sesion_id, subtema_id, fraccion')
      .in('sesion_id', sesionIds)
    avisarSiError('sesion_subtemas', error)
    return data ?? []
  })
  const { data: sesionSubtemas } = sesionSubtemasAsyncData

  const subtemasRepartoAsyncData = useAsyncData('dashboard-subtemas-reparto', async () => {
    await sesionSubtemasAsyncData
    const subtemaIds = [...new Set((sesionSubtemas.value ?? []).map(ss => ss.subtema_id))]
    if (!subtemaIds.length) return []
    const { data, error } = await supabase.from('subtemas').select('id, nombre, tema_id, tipo').in('id', subtemaIds)
    avisarSiError('subtemas', error)
    return data ?? []
  })
  const { data: subtemasReparto } = subtemasRepartoAsyncData

  const { data: temasReparto } = useAsyncData('dashboard-temas-reparto', async () => {
    await subtemasRepartoAsyncData
    const temaIds = [...new Set((subtemasReparto.value ?? []).map(s => s.tema_id).filter(id => id !== null))]
    if (!temaIds.length) return []
    const { data, error } = await supabase.from('temas').select('id, nombre').in('id', temaIds)
    avisarSiError('temas', error)
    return data ?? []
  })

  const opcionesCurso = computed(() =>
    (cursos.value ?? []).map(c => ({ label: c.nombre, value: c.id }))
  )

  // Qué curso se ve se recuerda entre visitas (ej. al volver de generar un
  // reparto): si no, cada vez que se vuelve a montar el dashboard se
  // perdía la elección y volvía a aplicar el criterio por defecto, dando
  // la sensación de que el reparto recién creado había desaparecido.
  const CLAVE_CURSO_SELECCIONADO = 'teacherOS:dashboard:cursoSeleccionadoId'
  const cursoSeleccionadoId = ref('')
  if (import.meta.client) {
    try {
      cursoSeleccionadoId.value = localStorage.getItem(CLAVE_CURSO_SELECCIONADO) ?? ''
    } catch {
      // localStorage puede no estar disponible (privado, bloqueado...): sin problema, se usa el criterio por defecto.
    }
  }
  watch(cursoSeleccionadoId, (id) => {
    if (!import.meta.client) return
    try {
      if (id) localStorage.setItem(CLAVE_CURSO_SELECCIONADO, id)
    } catch {
      // Igual que arriba: si no se puede guardar, no pasa nada.
    }
  })

  // Si no hay nada recordado (o ya no es válido), se muestra el curso
  // vigente hoy; si ninguno lo está, el más reciente (cursos ya viene
  // ordenado por creado_en desc).
  watch(cursos, (lista) => {
    if (cursoSeleccionadoId.value && lista?.some(c => c.id === cursoSeleccionadoId.value)) return
    const hoy = new Date().toISOString().slice(0, 10)
    const vigenteHoy = lista?.find(c => hoy >= c.fecha_inicio && hoy <= c.fecha_fin)
    cursoSeleccionadoId.value = vigenteHoy?.id ?? lista?.[0]?.id ?? ''
  }, { immediate: true })

  // Todo lo demás en el dashboard (horario semanal, reparto, festivos que
  // usa "marcar día no lectivo") se acota al curso elegido: sin esto, un
  // profesor con varios cursos vería sus datos mezclados sin poder saber
  // cuál está mirando.
  const gruposDelCurso = computed(() =>
    (grupos.value ?? []).filter(g => g.curso_id === cursoSeleccionadoId.value)
  )

  const festivosDelCurso = computed(() =>
    (festivos.value ?? []).filter(f => f.curso_id === cursoSeleccionadoId.value)
  )

  const horariosTipoDelCurso = computed(() =>
    (horariosTipo.value ?? []).filter(ht => ht.curso_id === cursoSeleccionadoId.value)
  )

  const gaIdsDelCurso = computed(() => {
    const grupoIds = new Set(gruposDelCurso.value.map(g => g.id))
    return new Set(
      (grupoAsignaturas.value ?? [])
        .filter(ga => grupoIds.has(ga.grupo_id))
        .map(ga => ga.id)
    )
  })

  const horariosDelCurso = computed(() =>
    (horarios.value ?? []).filter(f => gaIdsDelCurso.value.has(f.grupo_asignatura_id))
  )

  const sesionesDelCurso = computed(() => {
    const franjaIds = new Set(horariosDelCurso.value.map(f => f.id))
    return (sesiones.value ?? []).filter(s => franjaIds.has(s.franja_horaria_id))
  })

  const etiquetaTipoSubtema: Record<string, string> = {
    repaso: 'Repaso',
    examen: 'Examen',
    exposicion_oral: 'Exposición oral',
    otro: 'Otro'
  }

  const actualizandoEstadoId = ref<string | null>(null)

  async function alternarImpartida(sesionId: string, estadoActual: string) {
    const nuevoEstado = estadoActual === 'impartida' ? 'confirmada' : 'impartida'
    actualizandoEstadoId.value = sesionId
    const { error } = await supabase.from('sesiones').update({ estado: nuevoEstado }).eq('id', sesionId)
    actualizandoEstadoId.value = null
    if (error) return
    sesiones.value = (sesiones.value ?? []).map(s => (s.id === sesionId ? { ...s, estado: nuevoEstado } : s))
  }

  const guardandoNotasId = ref<string | null>(null)

  async function guardarNotas(sesionId: string, notas: string) {
    guardandoNotasId.value = sesionId
    const { error } = await supabase.from('sesiones').update({ notas: notas || null }).eq('id', sesionId)
    guardandoNotasId.value = null
    if (error) return
    sesiones.value = (sesiones.value ?? []).map(s => (s.id === sesionId ? { ...s, notas: notas || null } : s))
  }

  function detalleSesion(sesion: { id: string, fecha: string, estado: string, notas: string | null, franja_horaria_id: string }) {
    const franja = horarios.value?.find(f => f.id === sesion.franja_horaria_id)
    const ga = grupoAsignaturas.value?.find(item => item.id === franja?.grupo_asignatura_id)
    const grupo = grupos.value?.find(item => item.id === ga?.grupo_id)
    const asignatura = asignaturas.value?.find(item => item.id === ga?.asignatura_id)
    const puntos = (sesionSubtemas.value ?? [])
      .filter(ss => ss.sesion_id === sesion.id)
      .map((ss) => {
        const subtema = subtemasReparto.value?.find(s => s.id === ss.subtema_id)
        const tema = temasReparto.value?.find(t => t.id === subtema?.tema_id)
        return {
          tema: tema?.nombre ?? (subtema ? etiquetaTipoSubtema[subtema.tipo] ?? '' : ''),
          subtema: subtema?.nombre ?? '',
          fraccion: ss.fraccion
        }
      })
    const contenido = puntos
      .map(p => (p.fraccion < 1 ? `${p.subtema} (½)` : p.subtema))
      .join(', ')
    return {
      id: sesion.id,
      fecha: sesion.fecha,
      estado: sesion.estado,
      notas: sesion.notas,
      grupo: grupo?.nombre ?? '',
      color: grupo?.color ?? '#94a3b8',
      asignatura: asignatura?.nombre ?? '',
      contenido,
      puntos
    }
  }

  function festivoDe(fechaISO: string) {
    return festivosDelCurso.value.find(f => fechaISO >= f.fecha_inicio && fechaISO <= f.fecha_fin)
  }

  const mesesCalendario = computed<MesCalendario[]>(() => {
    const fechas = sesionesDelCurso.value.map(s => s.fecha)
    if (!fechas.length) return []

    const sesionesPorFecha = new Map<string, { color: string, grupo: string, asignatura: string }[]>()
    for (const sesion of sesionesDelCurso.value) {
      const detalle = detalleSesion(sesion)
      if (!sesionesPorFecha.has(sesion.fecha)) sesionesPorFecha.set(sesion.fecha, [])
      sesionesPorFecha.get(sesion.fecha)!.push({ color: detalle.color, grupo: detalle.grupo, asignatura: detalle.asignatura })
    }

    const minFecha = fechas.reduce((a, b) => (a < b ? a : b))
    const maxFecha = fechas.reduce((a, b) => (a > b ? a : b))

    let cursorAnio = Number(minFecha.slice(0, 4))
    let cursorMes = Number(minFecha.slice(5, 7)) - 1
    const finAnio = Number(maxFecha.slice(0, 4))
    const finMes = Number(maxFecha.slice(5, 7)) - 1

    const meses: MesCalendario[] = []

    while (cursorAnio < finAnio || (cursorAnio === finAnio && cursorMes <= finMes)) {
      const primerDia = new Date(Date.UTC(cursorAnio, cursorMes, 1))
      const ultimoDia = new Date(Date.UTC(cursorAnio, cursorMes + 1, 0))

      const semanas: (CeldaCalendario | null)[][] = []
      let semanaActual: (CeldaCalendario | null)[] = []

      const diaSemanaInicial = (primerDia.getUTCDay() + 6) % 7
      if (diaSemanaInicial < 5) {
        for (let i = 0; i < diaSemanaInicial; i++) semanaActual.push(null)
      }

      for (const d = new Date(primerDia); d <= ultimoDia; d.setUTCDate(d.getUTCDate() + 1)) {
        const diaSemana = (d.getUTCDay() + 6) % 7
        if (diaSemana > 4) continue

        if (diaSemana === 0 && semanaActual.length > 0) {
          semanas.push(semanaActual)
          semanaActual = []
        }

        const fechaISO = d.toISOString().slice(0, 10)
        semanaActual.push({
          fecha: fechaISO,
          dia: d.getUTCDate(),
          sesiones: sesionesPorFecha.get(fechaISO) ?? [],
          festivo: festivoDe(fechaISO)?.nombre || (festivoDe(fechaISO) ? 'Festivo' : null)
        })
      }
      if (semanaActual.length > 0) {
        while (semanaActual.length < 5) semanaActual.push(null)
        semanas.push(semanaActual)
      }

      meses.push({ etiqueta: `${NOMBRES_MES[cursorMes]} ${cursorAnio}`, semanas })

      cursorMes++
      if (cursorMes > 11) {
        cursorMes = 0
        cursorAnio++
      }
    }

    return meses
  })

  const opcionesHorarioTipo = computed(() =>
    horariosTipoDelCurso.value.map(ht => ({ label: ht.nombre, value: ht.id }))
  )

  // Por defecto se muestra el horario vigente hoy; si ninguno lo está
  // (o no tiene vigencia definida), el primero que haya.
  const horarioTipoSeleccionadoId = ref('')
  watch(horariosTipoDelCurso, (lista) => {
    if (horarioTipoSeleccionadoId.value && lista?.some(ht => ht.id === horarioTipoSeleccionadoId.value)) return
    const hoy = new Date().toISOString().slice(0, 10)
    const vigenteHoy = lista?.find(ht =>
      (!ht.vigencia_inicio || hoy >= ht.vigencia_inicio) && (!ht.vigencia_fin || hoy <= ht.vigencia_fin)
    )
    horarioTipoSeleccionadoId.value = vigenteHoy?.id ?? lista?.[0]?.id ?? ''
  }, { immediate: true })

  const periodosDelHorarioSeleccionado = computed(() =>
    (periodos.value ?? []).filter(p => !horarioTipoSeleccionadoId.value || p.horario_tipo_id === horarioTipoSeleccionadoId.value)
  )

  // Distintos horarios tipo pueden definir franjas con el mismo rango
  // de horas (ej. el período de 10:30-11:20 en dos ciclos distintos):
  // se agrupan en una sola fila de la cuadrícula por hora real. Solo se
  // muestra un horario tipo a la vez, porque dos franjas del mismo día y
  // hora pero de horarios distintos (vigentes en fechas distintas) no
  // caben en una sola celda.
  const filasHorario = computed(() => {
    const vistos = new Map<string, { horaInicio: string, horaFin: string }>()
    for (const periodo of periodosDelHorarioSeleccionado.value) {
      vistos.set(`${periodo.hora_inicio}-${periodo.hora_fin}`, {
        horaInicio: periodo.hora_inicio,
        horaFin: periodo.hora_fin
      })
    }
    return [...vistos.values()].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
  })

  const celdas = computed(() => {
    const map = new Map<string, { asignatura: string, grupo: string, color: string }>()
    for (const franja of horariosDelCurso.value) {
      const periodo = periodosDelHorarioSeleccionado.value.find(item => item.id === franja.periodo_id)
      if (!periodo) continue
      const ga = grupoAsignaturas.value?.find(item => item.id === franja.grupo_asignatura_id)
      const grupo = grupos.value?.find(item => item.id === ga?.grupo_id)
      map.set(`${periodo.hora_inicio}-${periodo.hora_fin}-${franja.dia_semana}`, {
        asignatura: asignaturas.value?.find(item => item.id === ga?.asignatura_id)?.nombre ?? '',
        grupo: grupo?.nombre ?? '',
        color: grupo?.color ?? '#94a3b8'
      })
    }
    return map
  })

  const sinNada = computed(() =>
    (cursos.value?.length ?? 0) === 0
    && (asignaturas.value?.length ?? 0) === 0
    && (grupos.value?.length ?? 0) === 0
    && (horarios.value?.length ?? 0) === 0
  )

  // Asignatura+grupo con horario ya definido pero sin ninguna sesión
  // generada todavía: se enlazan directamente a "generar reparto" sin
  // tener que pasar antes por "editar grupo". Se calcula aparte de si YA
  // hay sesiones de otras asignaturas, para no esconder las pendientes
  // solo porque alguna otra ya esté repartida.
  const asignaturasPendientesDeReparto = computed(() => {
    const gaConHorarioIds = new Set(horariosDelCurso.value.map(f => f.grupo_asignatura_id))
    const gaIdPorFranjaId = new Map(horariosDelCurso.value.map(f => [f.id, f.grupo_asignatura_id]))
    const gaConSesionesIds = new Set(
      sesionesDelCurso.value
        .map(s => gaIdPorFranjaId.get(s.franja_horaria_id))
        .filter((id): id is string => Boolean(id))
    )
    return (grupoAsignaturas.value ?? [])
      .filter(ga => gaConHorarioIds.has(ga.id) && !gaConSesionesIds.has(ga.id))
      .map(ga => ({
        id: ga.id,
        grupoNombre: grupos.value?.find(g => g.id === ga.grupo_id)?.nombre ?? '',
        asignaturaNombre: asignaturas.value?.find(a => a.id === ga.asignatura_id)?.nombre ?? ''
      }))
  })

  return {
    profesor,
    cursos,
    festivos,
    festivosDelCurso,
    sesionesDelCurso,
    asignaturas,
    grupos,
    horarios,
    sesiones,
    etiquetaEstado,
    colorEstado,
    actualizandoEstadoId,
    alternarImpartida,
    guardandoNotasId,
    guardarNotas,
    detalleSesion,
    mesesCalendario,
    DIAS_SEMANA_CALENDARIO,
    diasSemanaHorario: DIAS_SEMANA_HORARIO,
    filasHorario,
    celdas,
    sinNada,
    opcionesHorarioTipo,
    horarioTipoSeleccionadoId,
    asignaturasPendientesDeReparto,
    opcionesCurso,
    cursoSeleccionadoId,
    gruposDelCurso
  }
}
