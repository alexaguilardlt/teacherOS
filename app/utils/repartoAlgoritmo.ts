type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'

const DIA_SEMANA_POR_INDICE: DiaSemana[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

export interface Slot {
  franjaId: string
  fecha: string
  horaInicio: string
}

export interface Bloque {
  subtemaIds: string[]
  ancho: number
}

export interface FranjaParaSlots {
  franjaId: string
  diaSemana: DiaSemana
  horaInicio: string
  // Tramos de vigencia del horario tipo al que pertenece esta franja (ej.
  // un horario "Reducido" vigente en dos tramos: septiembre y junio). Sin
  // ningún tramo (undefined o vacío) significa "todo el curso".
  vigencias?: RangoFecha[]
}

export interface RangoFecha {
  inicio: string
  fin: string
}

export interface SubtemaParaBloques {
  id: string
  duracionSesiones: number
}

export interface Asignacion {
  slot: Slot
  subtemaId: string
  fraccion: number
}

export interface ResultadoRepartoBloques {
  asignaciones: Asignacion[]
  subtemasNoAsignadosIds: string[]
}

export function estaEnFestivo(fechaISO: string, festivos: RangoFecha[]): boolean {
  return festivos.some(r => fechaISO >= r.inicio && fechaISO <= r.fin)
}

// Genera, para cada franja horaria de un grupo+asignatura, la lista ordenada de
// fechas lectivas reales dentro del curso (excluyendo festivos).
export function construirSlots(
  franjas: FranjaParaSlots[],
  fechaInicio: string,
  fechaFin: string,
  festivos: RangoFecha[]
): Slot[] {
  const slots: Slot[] = []
  const vistos = new Set<string>()
  const unDia = 24 * 60 * 60 * 1000

  for (const franja of franjas) {
    // Cada franja se acota a los tramos de vigencia de su horario tipo (si
    // los tiene; puede tener varios, ej. septiembre y junio), recortados
    // además a las fechas reales del curso. Sin tramos, aplica todo el curso.
    const tramos = franja.vigencias?.length ? franja.vigencias : [{ inicio: fechaInicio, fin: fechaFin }]

    for (const tramo of tramos) {
      const inicio = tramo.inicio > fechaInicio ? tramo.inicio : fechaInicio
      const fin = tramo.fin < fechaFin ? tramo.fin : fechaFin
      const inicioMs = new Date(`${inicio}T00:00:00Z`).getTime()
      const finMs = new Date(`${fin}T00:00:00Z`).getTime()

      for (let t = inicioMs; t <= finMs; t += unDia) {
        const diaSemana = DIA_SEMANA_POR_INDICE[new Date(t).getUTCDay()]
        if (diaSemana !== franja.diaSemana) continue
        const fechaISO = new Date(t).toISOString().slice(0, 10)
        if (estaEnFestivo(fechaISO, festivos)) continue
        // Si dos tramos de vigencia se solapasen entre sí, no duplicar el slot.
        const clave = `${franja.franjaId}__${fechaISO}`
        if (vistos.has(clave)) continue
        vistos.add(clave)
        slots.push({ franjaId: franja.franjaId, fecha: fechaISO, horaInicio: franja.horaInicio })
      }
    }
  }
  slots.sort((a, b) => (a.fecha === b.fecha ? a.horaInicio.localeCompare(b.horaInicio) : a.fecha.localeCompare(b.fecha)))
  return slots
}

// Agrupa los subtemas en bloques según su duración en sesiones (que el
// profesor introduce directamente, en bloques de 0.5): los subtemas de 0.5
// sesiones se emparejan de dos en dos en una sola sesión.
export function agruparEnBloques(subtemasOrdenados: SubtemaParaBloques[]): Bloque[] {
  const bloques: Bloque[] = []
  let pendienteFacil: string | null = null

  for (const subtema of subtemasOrdenados) {
    const duracion = subtema.duracionSesiones
    if (duracion <= 0.5) {
      if (pendienteFacil) {
        bloques.push({ subtemaIds: [pendienteFacil, subtema.id], ancho: 1 })
        pendienteFacil = null
      } else {
        pendienteFacil = subtema.id
      }
    } else {
      bloques.push({ subtemaIds: [subtema.id], ancho: Math.max(1, Math.round(duracion)) })
    }
  }
  if (pendienteFacil) {
    bloques.push({ subtemaIds: [pendienteFacil], ancho: 1 })
  }
  return bloques
}

// Reparte los bloques a ritmo natural: consume los slots disponibles en orden
// cronológico, usando todas las franjas semanales que hagan falta (sin dejar
// huecos sueltos dentro de una misma semana) hasta agotar el temario. El curso
// puede terminar de dar el temario antes del fin de curso real, dejando el resto
// del tiempo libre para repaso, exámenes u otras actividades.
export function repartirBloques(bloques: Bloque[], slots: Slot[]): ResultadoRepartoBloques {
  const asignaciones: Asignacion[] = []
  const subtemasNoAsignadosIds: string[] = []

  let cursor = 0
  for (const bloque of bloques) {
    if (cursor + bloque.ancho > slots.length) {
      subtemasNoAsignadosIds.push(...bloque.subtemaIds)
      continue
    }
    const fraccion = bloque.subtemaIds.length > 1 ? 0.5 : 1
    for (let i = 0; i < bloque.ancho; i++) {
      const slot = slots[cursor + i]!
      for (const subtemaId of bloque.subtemaIds) {
        asignaciones.push({ slot, subtemaId, fraccion })
      }
    }
    cursor += bloque.ancho
  }

  return { asignaciones, subtemasNoAsignadosIds }
}

export interface SesionExistente {
  id: string
  franjaId: string
  fecha: string
  estado: string
}

export interface EnlaceSesionSubtema {
  sesionId: string
  subtemaId: string
}

export interface SesionRecolocada {
  franjaId: string
  fecha: string
  subtemas: { subtemaId: string, fraccion: number }[]
}

export interface ResultadoRecolocacion {
  sesionesAEliminarIds: string[]
  sesionesNuevas: SesionRecolocada[]
  subtemasNoAsignadosIds: string[]
}

// Una sesión ya no se toca si es anterior al corte o si ya se impartió:
// es historia. Todo lo demás se puede recolocar.
function esSesionFija(sesion: SesionExistente, fechaCorte: string) {
  return sesion.fecha < fechaCorte || sesion.estado === 'impartida'
}

// Recalcula el reparto de una asignatura-grupo a partir de `fechaCorte`: las
// sesiones fijas se quedan como están, y el temario que aún no se ha dado
// entero se vuelve a repartir en los huecos que quedan desde el corte. Sirve
// tanto para un festivo nuevo (el corte es el festivo, que ya va en
// `festivos`) como para un cambio de temario (el corte es hoy).
//
// Los bloques se reconstruyen con el temario completo, igual que en el
// reparto original, para que el emparejamiento de subtemas de 0.5 sesiones
// no cambie; un bloque se da por entregado solo si todos sus subtemas
// aparecen ya en sesiones fijas.
export function recolocarDesde(params: {
  subtemasOrdenados: SubtemaParaBloques[]
  sesiones: SesionExistente[]
  enlaces: EnlaceSesionSubtema[]
  franjas: FranjaParaSlots[]
  fechaCorte: string
  fechaFin: string
  festivos: RangoFecha[]
}): ResultadoRecolocacion {
  const { subtemasOrdenados, sesiones, enlaces, franjas, fechaCorte, fechaFin, festivos } = params

  const sesionesFijasIds = new Set(sesiones.filter(s => esSesionFija(s, fechaCorte)).map(s => s.id))
  const subtemaIdsEntregados = new Set(
    enlaces.filter(e => sesionesFijasIds.has(e.sesionId)).map(e => e.subtemaId)
  )

  const bloquesPendientes = agruparEnBloques(subtemasOrdenados).filter(
    bloque => !bloque.subtemaIds.every(id => subtemaIdsEntregados.has(id))
  )

  // Un hueco ocupado por una sesión fija (ej. la clase de hoy, ya marcada
  // como impartida) no se puede volver a usar.
  const ocupados = new Set(
    sesiones.filter(s => sesionesFijasIds.has(s.id)).map(s => `${s.franjaId}__${s.fecha}`)
  )
  const slots = construirSlots(franjas, fechaCorte, fechaFin, festivos)
    .filter(slot => !ocupados.has(`${slot.franjaId}__${slot.fecha}`))
  const { asignaciones, subtemasNoAsignadosIds } = repartirBloques(bloquesPendientes, slots)

  const sesionesPorClave = new Map<string, SesionRecolocada>()
  for (const a of asignaciones) {
    const clave = `${a.slot.franjaId}__${a.slot.fecha}`
    if (!sesionesPorClave.has(clave)) {
      sesionesPorClave.set(clave, { franjaId: a.slot.franjaId, fecha: a.slot.fecha, subtemas: [] })
    }
    sesionesPorClave.get(clave)!.subtemas.push({ subtemaId: a.subtemaId, fraccion: a.fraccion })
  }

  return {
    sesionesAEliminarIds: sesiones.filter(s => !sesionesFijasIds.has(s.id)).map(s => s.id),
    sesionesNuevas: [...sesionesPorClave.values()],
    subtemasNoAsignadosIds: [...new Set(subtemasNoAsignadosIds)]
  }
}

// Subtemas que ya se han dado (aparecen en alguna sesión fija respecto a
// `hoy`), con la primera fecha en que se dieron. No se pueden borrar del
// temario: lo pasado es historia y esas sesiones se quedarían vacías.
export function subtemasYaDados(
  sesiones: SesionExistente[],
  enlaces: EnlaceSesionSubtema[],
  hoy: string
): Map<string, string> {
  const fechaPorSesionFija = new Map(
    sesiones.filter(s => esSesionFija(s, hoy)).map(s => [s.id, s.fecha])
  )
  const dados = new Map<string, string>()
  for (const enlace of enlaces) {
    const fecha = fechaPorSesionFija.get(enlace.sesionId)
    if (!fecha) continue
    const anterior = dados.get(enlace.subtemaId)
    if (!anterior || fecha < anterior) dados.set(enlace.subtemaId, fecha)
  }
  return dados
}

// El reparto solo depende de qué subtemas hay, en qué orden y cuánto dura
// cada uno: cambiar un nombre no obliga a recolocar nada.
export function temarioAfectaAlReparto(antes: SubtemaParaBloques[], despues: SubtemaParaBloques[]): boolean {
  if (antes.length !== despues.length) return true
  return antes.some((s, i) => s.id !== despues[i]!.id || s.duracionSesiones !== despues[i]!.duracionSesiones)
}
