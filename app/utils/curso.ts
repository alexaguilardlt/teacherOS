import type { RangoFecha } from './repartoAlgoritmo'

export interface HorarioTipoEditable {
  clienteId: string
  nombre: string
  vigencias: { clienteId: string, fechaInicio: string, fechaFin: string }[]
  periodos: { clienteId: string, horaInicio: string, horaFin: string }[]
}

export interface FilaVigencia {
  id: string
  horario_tipo_id: string
  fecha_inicio: string
  fecha_fin: string
}

// Traduce los horarios tipo editados a lo que hay que guardar, sin borrar y
// recrear (borrar una franja horaria borra en cascada las franjas de los
// grupos que la usan y sus sesiones): el clienteId de cada horario tipo,
// tramo de vigencia y franja horaria es su id en la base de datos (lo nuevo
// lleva un UUID generado en el navegador).
export function planificarGuardadoCurso(
  horariosTipo: HorarioTipoEditable[],
  existentes: { horarioTipoIds: string[], vigenciaIds: string[], periodoIds: string[] }
) {
  const horarios_tipo = horariosTipo.map(ht => ({ id: ht.clienteId, nombre: ht.nombre }))
  const vigencias: FilaVigencia[] = horariosTipo.flatMap(ht => ht.vigencias.map(v => ({
    id: v.clienteId,
    horario_tipo_id: ht.clienteId,
    fecha_inicio: v.fechaInicio,
    fecha_fin: v.fechaFin
  })))
  const periodos = horariosTipo.flatMap(ht => ht.periodos.map((p, orden) => ({
    id: p.clienteId,
    horario_tipo_id: ht.clienteId,
    hora_inicio: p.horaInicio,
    hora_fin: p.horaFin,
    orden
  })))

  const faltan = (ids: string[], guardados: { id: string }[]) => {
    const presentes = new Set(guardados.map(g => g.id))
    return ids.filter(id => !presentes.has(id))
  }

  return {
    horarios_tipo,
    vigencias,
    periodos,
    horarioTipoIdsABorrar: faltan(existentes.horarioTipoIds, horarios_tipo),
    vigenciaIdsABorrar: faltan(existentes.vigenciaIds, vigencias),
    periodoIdsABorrar: faltan(existentes.periodoIds, periodos)
  }
}

export type PlanGuardadoCurso = ReturnType<typeof planificarGuardadoCurso>

// Un festivo sin fecha de fin dura un solo día.
export function festivosARangos(festivos: { fechaInicio: string, fechaFin: string | null }[]): RangoFecha[] {
  return festivos.map(f => ({ inicio: f.fechaInicio, fin: f.fechaFin || f.fechaInicio }))
}

export function vigenciasPorHorarioTipo(vigencias: Omit<FilaVigencia, 'id'>[]): Map<string, RangoFecha[]> {
  const mapa = new Map<string, RangoFecha[]>()
  for (const v of vigencias) {
    const lista = mapa.get(v.horario_tipo_id) ?? []
    lista.push({ inicio: v.fecha_inicio, fin: v.fecha_fin })
    mapa.set(v.horario_tipo_id, lista)
  }
  return mapa
}

export interface CalendarioCurso {
  fechaInicio: string
  fechaFin: string
  festivos: RangoFecha[]
  vigencias: Map<string, RangoFecha[]>
}

// El reparto depende de los días en los que hay clase: fechas del curso,
// festivos y tramos de vigencia de cada horario tipo. Cambiar nombres u
// horas (la franja sigue cayendo el mismo día) no obliga a recolocar nada.
export function calendarioAfectaAlReparto(antes: CalendarioCurso, despues: CalendarioCurso): boolean {
  const rangos = (lista: RangoFecha[] | undefined) => (lista ?? []).map(r => `${r.inicio}/${r.fin}`).sort().join(',')
  if (antes.fechaInicio !== despues.fechaInicio || antes.fechaFin !== despues.fechaFin) return true
  if (rangos(antes.festivos) !== rangos(despues.festivos)) return true
  const horariosTipo = new Set([...antes.vigencias.keys(), ...despues.vigencias.keys()])
  return [...horariosTipo].some(id => rangos(antes.vigencias.get(id)) !== rangos(despues.vigencias.get(id)))
}
