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
    const { data } = await supabase
      .from('cursos')
      .select('id, nombre, fecha_inicio, fecha_fin')
      .order('creado_en', { ascending: false })
    return data ?? []
  })

  const { data: festivos } = useAsyncData('dashboard-festivos', async () => {
    const { data } = await supabase
      .from('dias_no_lectivos')
      .select('id, nombre, fecha_inicio, fecha_fin')
    return data ?? []
  })

  const { data: asignaturas } = useAsyncData('dashboard-asignaturas', async () => {
    const { data } = await supabase
      .from('asignaturas')
      .select('id, nombre')
      .order('creado_en', { ascending: false })
    return data ?? []
  })

  const { data: grupos } = useAsyncData('dashboard-grupos', async () => {
    const { data } = await supabase
      .from('grupos')
      .select('id, nombre, color')
      .order('creado_en', { ascending: false })
    return data ?? []
  })

  const { data: grupoAsignaturas } = useAsyncData('dashboard-grupo-asignaturas', async () => {
    const { data } = await supabase
      .from('grupo_asignaturas')
      .select('id, grupo_id, asignatura_id')
    return data ?? []
  })

  const { data: periodos } = useAsyncData('dashboard-periodos', async () => {
    const { data } = await supabase
      .from('periodos_horarios')
      .select('id, hora_inicio, hora_fin')
    return data ?? []
  })

  const { data: horarios } = useAsyncData('dashboard-horarios', async () => {
    const { data } = await supabase
      .from('franjas_horarias')
      .select('id, grupo_asignatura_id, dia_semana, periodo_id')
    return data ?? []
  })

  const sesionesAsyncData = useAsyncData('dashboard-sesiones', async () => {
    const { data } = await supabase
      .from('sesiones')
      .select('id, fecha, estado, franja_horaria_id')
      .order('fecha', { ascending: true })
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
    const { data } = await supabase
      .from('sesion_subtemas')
      .select('sesion_id, subtema_id, fraccion')
      .in('sesion_id', sesionIds)
    return data ?? []
  })
  const { data: sesionSubtemas } = sesionSubtemasAsyncData

  const subtemasRepartoAsyncData = useAsyncData('dashboard-subtemas-reparto', async () => {
    await sesionSubtemasAsyncData
    const subtemaIds = [...new Set((sesionSubtemas.value ?? []).map(ss => ss.subtema_id))]
    if (!subtemaIds.length) return []
    const { data } = await supabase.from('subtemas').select('id, nombre, tema_id').in('id', subtemaIds)
    return data ?? []
  })
  const { data: subtemasReparto } = subtemasRepartoAsyncData

  const { data: temasReparto } = useAsyncData('dashboard-temas-reparto', async () => {
    await subtemasRepartoAsyncData
    const temaIds = [...new Set((subtemasReparto.value ?? []).map(s => s.tema_id))]
    if (!temaIds.length) return []
    const { data } = await supabase.from('temas').select('id, nombre').in('id', temaIds)
    return data ?? []
  })

  const actualizandoEstadoId = ref<string | null>(null)

  async function alternarImpartida(sesionId: string, estadoActual: string) {
    const nuevoEstado = estadoActual === 'impartida' ? 'confirmada' : 'impartida'
    actualizandoEstadoId.value = sesionId
    const { error } = await supabase.from('sesiones').update({ estado: nuevoEstado }).eq('id', sesionId)
    actualizandoEstadoId.value = null
    if (error) return
    sesiones.value = (sesiones.value ?? []).map(s => (s.id === sesionId ? { ...s, estado: nuevoEstado } : s))
  }

  function detalleSesion(sesion: { id: string, fecha: string, estado: string, franja_horaria_id: string }) {
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
          tema: tema?.nombre ?? '',
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
      grupo: grupo?.nombre ?? '',
      color: grupo?.color ?? '#94a3b8',
      asignatura: asignatura?.nombre ?? '',
      contenido,
      puntos
    }
  }

  function festivoDe(fechaISO: string) {
    return (festivos.value ?? []).find(f => fechaISO >= f.fecha_inicio && fechaISO <= f.fecha_fin)
  }

  const mesesCalendario = computed<MesCalendario[]>(() => {
    const fechas = (sesiones.value ?? []).map(s => s.fecha)
    if (!fechas.length) return []

    const sesionesPorFecha = new Map<string, { color: string, grupo: string, asignatura: string }[]>()
    for (const sesion of sesiones.value ?? []) {
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

  // Distintos horarios tipo pueden definir franjas con el mismo rango
  // de horas (ej. el período de 10:30-11:20 en dos ciclos distintos):
  // se agrupan en una sola fila de la cuadrícula por hora real.
  const filasHorario = computed(() => {
    const vistos = new Map<string, { horaInicio: string, horaFin: string }>()
    for (const periodo of periodos.value ?? []) {
      vistos.set(`${periodo.hora_inicio}-${periodo.hora_fin}`, {
        horaInicio: periodo.hora_inicio,
        horaFin: periodo.hora_fin
      })
    }
    return [...vistos.values()].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
  })

  const celdas = computed(() => {
    const map = new Map<string, { asignatura: string, grupo: string, color: string }>()
    for (const franja of horarios.value ?? []) {
      const periodo = periodos.value?.find(item => item.id === franja.periodo_id)
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

  return {
    profesor,
    cursos,
    festivos,
    asignaturas,
    grupos,
    horarios,
    sesiones,
    etiquetaEstado,
    colorEstado,
    actualizandoEstadoId,
    alternarImpartida,
    detalleSesion,
    mesesCalendario,
    DIAS_SEMANA_CALENDARIO,
    diasSemanaHorario: DIAS_SEMANA_HORARIO,
    filasHorario,
    celdas,
    sinNada
  }
}
