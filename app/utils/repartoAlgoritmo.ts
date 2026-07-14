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
}

export interface RangoFecha {
  inicio: string
  fin: string
}

export interface SubtemaParaBloques {
  id: string
  dificultad: string
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
  const unDia = 24 * 60 * 60 * 1000
  const inicioMs = new Date(`${fechaInicio}T00:00:00Z`).getTime()
  const finMs = new Date(`${fechaFin}T00:00:00Z`).getTime()

  for (const franja of franjas) {
    for (let t = inicioMs; t <= finMs; t += unDia) {
      const diaSemana = DIA_SEMANA_POR_INDICE[new Date(t).getUTCDay()]
      if (diaSemana !== franja.diaSemana) continue
      const fechaISO = new Date(t).toISOString().slice(0, 10)
      if (estaEnFestivo(fechaISO, festivos)) continue
      slots.push({ franjaId: franja.franjaId, fecha: fechaISO, horaInicio: franja.horaInicio })
    }
  }
  slots.sort((a, b) => (a.fecha === b.fecha ? a.horaInicio.localeCompare(b.horaInicio) : a.fecha.localeCompare(b.fecha)))
  return slots
}

// Agrupa los subtemas en bloques según su duración en sesiones: los subtemas
// "fáciles" (duración <= 0.5) se emparejan de dos en dos en una sola sesión.
export function agruparEnBloques(
  subtemasOrdenados: SubtemaParaBloques[],
  duracionPorDificultad: Map<string, number>
): Bloque[] {
  const bloques: Bloque[] = []
  let pendienteFacil: string | null = null

  for (const subtema of subtemasOrdenados) {
    const duracion = duracionPorDificultad.get(subtema.dificultad) ?? 1
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

// Reparte los bloques a lo largo de todo el curso por FECHA objetivo (proporcional
// a la posición del bloque en el temario dentro del rango del curso), no saltando
// un nº fijo de slots: como varias franjas de la semana se entrelazan en `slots`,
// saltar un índice fijo podía coincidir con el nº de franjas semanales y caer
// siempre en el mismo día de la semana, dejando el resto sin usar nunca.
export function repartirBloques(
  bloques: Bloque[],
  slots: Slot[],
  fechaInicio: string,
  fechaFin: string
): ResultadoRepartoBloques {
  const inicioMs = new Date(`${fechaInicio}T00:00:00Z`).getTime()
  const finMs = new Date(`${fechaFin}T00:00:00Z`).getTime()
  const diasTotalesMs = Math.max(1, finMs - inicioMs)

  const asignaciones: Asignacion[] = []
  const subtemasNoAsignadosIds: string[] = []

  let cursor = 0
  for (const [indice, bloque] of bloques.entries()) {
    const fechaObjetivoMs = inicioMs + Math.floor((indice / bloques.length) * diasTotalesMs)
    while (
      cursor < slots.length
      && new Date(`${slots[cursor]!.fecha}T00:00:00Z`).getTime() < fechaObjetivoMs
    ) {
      cursor++
    }

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
