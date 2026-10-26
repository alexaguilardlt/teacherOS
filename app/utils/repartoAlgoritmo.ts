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
// es historia. Tampoco si se canceló (una clase saltada): así su día sigue
// ocupado y ninguna recolocación vuelve a poner clase ahí. Todo lo demás se
// puede recolocar.
function esSesionFija(sesion: SesionExistente, fechaCorte: string) {
  return sesion.fecha < fechaCorte || sesion.estado === 'impartida' || sesion.estado === 'cancelada'
}

// Lo que cuenta como dado: lo de las sesiones fijas que no se cancelaron.
function sesionDaContenido(sesion: SesionExistente, fechaCorte: string) {
  return esSesionFija(sesion, fechaCorte) && sesion.estado !== 'cancelada'
}

// Recalcula el reparto de una asignatura-grupo a partir de `fechaCorte`: las
// sesiones fijas se quedan como están, y el temario que aún no se ha dado
// entero se vuelve a repartir en los huecos que quedan desde el corte. Sirve
// tanto para un festivo nuevo (el corte es el festivo, que ya va en
// `festivos`) como para un cambio de temario (el corte es hoy).
//
// Los bloques se reconstruyen con el temario completo, igual que en el
// reparto original, para que el emparejamiento de subtemas de 0.5 sesiones
// no cambie. De cada bloque se descuentan las sesiones que ya se dieron: un
// subtema de 2 sesiones con una ya dada solo necesita una más.
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

  const clave = (franjaId: string, fecha: string) => `${franjaId}__${fecha}`
  const huecos = construirSlots(franjas, fechaCorte, fechaFin, festivos)
  const huecosValidos = new Set(huecos.map(h => clave(h.franjaId, h.fecha)))

  // Una clase cancelada a partir del corte que ya no cae en ningún hueco (su
  // franja cambió de día, el curso de fechas, o ese día pasó a ser festivo)
  // ya no significa nada: se quita en vez de dejarla colgando.
  const canceladasSinHueco = new Set(
    sesiones
      .filter(s => s.estado === 'cancelada' && s.fecha >= fechaCorte && !huecosValidos.has(clave(s.franjaId, s.fecha)))
      .map(s => s.id)
  )
  const sesionesFijasIds = new Set(
    sesiones.filter(s => esSesionFija(s, fechaCorte) && !canceladasSinHueco.has(s.id)).map(s => s.id)
  )
  const sesionesDadasIds = new Set(sesiones.filter(s => sesionDaContenido(s, fechaCorte)).map(s => s.id))
  const sesionesFijasPorSubtema = new Map<string, Set<string>>()
  for (const enlace of enlaces) {
    if (!sesionesDadasIds.has(enlace.sesionId)) continue
    const ids = sesionesFijasPorSubtema.get(enlace.subtemaId) ?? new Set<string>()
    ids.add(enlace.sesionId)
    sesionesFijasPorSubtema.set(enlace.subtemaId, ids)
  }

  const bloquesPendientes: Bloque[] = []
  for (const bloque of agruparEnBloques(subtemasOrdenados)) {
    const sesionesDadas = new Set(bloque.subtemaIds.flatMap(id => [...(sesionesFijasPorSubtema.get(id) ?? [])]))
    const ancho = bloque.ancho - sesionesDadas.size
    if (ancho > 0) bloquesPendientes.push({ subtemaIds: bloque.subtemaIds, ancho })
  }

  // Un hueco ocupado por una sesión fija (ej. la clase de hoy, ya marcada
  // como impartida) no se puede volver a usar.
  const ocupados = new Set(
    sesiones.filter(s => sesionesFijasIds.has(s.id)).map(s => clave(s.franjaId, s.fecha))
  )
  const slots = huecos.filter(slot => !ocupados.has(clave(slot.franjaId, slot.fecha)))
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
    sesiones.filter(s => sesionDaContenido(s, hoy)).map(s => [s.id, s.fecha])
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

// Una recolocación no cambia nada si crea exactamente las mismas sesiones
// (franja, fecha y subtemas) que quita: no hace falta enseñarla ni
// aplicarla (y así no se pierden estados ni notas de esas sesiones).
export function recolocacionSinCambios(
  resultado: ResultadoRecolocacion,
  sesiones: SesionExistente[],
  enlaces: EnlaceSesionSubtema[]
): boolean {
  const clave = (franjaId: string, fecha: string, subtemaIds: string[]) => `${franjaId}|${fecha}|${[...subtemaIds].sort().join(',')}`
  const quitadas = new Set(resultado.sesionesAEliminarIds)
  const antes = sesiones
    .filter(s => quitadas.has(s.id))
    .map(s => clave(s.franjaId, s.fecha, enlaces.filter(e => e.sesionId === s.id).map(e => e.subtemaId)))
    .sort()
  const despues = resultado.sesionesNuevas
    .map(s => clave(s.franjaId, s.fecha, s.subtemas.map(x => x.subtemaId)))
    .sort()
  return antes.length === despues.length && antes.every((c, i) => c === despues[i])
}

// Qué sesiones cancelar al saltar la clase de un día para una
// asignatura-grupo, o por qué no se puede saltar. Lo pasado es historia: no
// se salta un día anterior a hoy ni una clase ya impartida. Sin `motivo` y
// sin sesiones a cancelar, ese día no hay clase.
export function sesionesAlSaltarUnDia(
  sesiones: SesionExistente[],
  fecha: string,
  hoy: string
): { aCancelar: string[], motivo?: string } {
  if (fecha < hoy) return { aCancelar: [], motivo: 'No se puede saltar un día que ya ha pasado.' }

  const delDia = sesiones.filter(s => s.fecha === fecha)
  const aCancelar = delDia.filter(s => s.estado !== 'impartida' && s.estado !== 'cancelada').map(s => s.id)
  if (!aCancelar.length && delDia.some(s => s.estado === 'cancelada')) {
    return { aCancelar, motivo: 'La clase de ese día ya está cancelada.' }
  }
  if (!aCancelar.length && delDia.some(s => s.estado === 'impartida')) {
    return { aCancelar, motivo: 'La clase de ese día ya está impartida: no se puede saltar.' }
  }
  return { aCancelar }
}
