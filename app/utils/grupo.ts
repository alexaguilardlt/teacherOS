import type { SeleccionAsignatura } from '../composables/useSeleccionAsignaturas'
import type { DiaSemana } from '../stores/cursoWizard.types'

export interface FilaGrupoAsignatura {
  id: string
  grupo_id: string
  asignatura_id: string
}

export interface FilaFranja {
  id: string
  grupo_asignatura_id: string
  dia_semana: DiaSemana
  periodo_id: string
  propia: boolean
}

export interface PlanGuardadoGrupo {
  grupoAsignaturasNuevas: FilaGrupoAsignatura[]
  grupoAsignaturaIdsABorrar: string[]
  franjas: FilaFranja[]
  franjaIdsABorrar: string[]
  // Asignaturas que ya estaban en el grupo y cuyo horario cambia (franjas
  // añadidas, quitadas o con otro día u hora): su reparto hay que recolocarlo.
  // Cambiar solo "La imparto yo" no cuenta: la franja sigue marcando el ritmo.
  grupoAsignaturaIdsConCambioDeHorario: string[]
}

// Traduce la edición de un grupo a lo que hay que guardar, sin borrar y
// recrear todo (borrar una franja borra en cascada sus sesiones): el
// clienteId de cada franja es su id en la base de datos (lo nuevo lleva un
// UUID generado en el navegador), y lo mismo con cada asignatura del grupo.
export function planificarGuardadoGrupo(
  grupoId: string,
  seleccion: SeleccionAsignatura[],
  existentes: { grupoAsignaturas: FilaGrupoAsignatura[], franjas: FilaFranja[] },
  nuevoId: () => string = () => crypto.randomUUID()
): PlanGuardadoGrupo {
  const grupoAsignaturaIdPorAsignatura = new Map(existentes.grupoAsignaturas.map(ga => [ga.asignatura_id, ga.id]))

  const grupoAsignaturasNuevas: FilaGrupoAsignatura[] = []
  const franjas: FilaFranja[] = []

  for (const s of seleccion) {
    let grupoAsignaturaId = grupoAsignaturaIdPorAsignatura.get(s.asignaturaId)
    if (!grupoAsignaturaId) {
      grupoAsignaturaId = nuevoId()
      grupoAsignaturasNuevas.push({ id: grupoAsignaturaId, grupo_id: grupoId, asignatura_id: s.asignaturaId })
    }
    for (const franja of s.franjas) {
      franjas.push({
        id: franja.clienteId,
        grupo_asignatura_id: grupoAsignaturaId,
        dia_semana: franja.diaSemana,
        periodo_id: franja.periodoId,
        propia: franja.propia
      })
    }
  }

  const asignaturasSeleccionadas = new Set(seleccion.map(s => s.asignaturaId))
  const grupoAsignaturaIdsABorrar = existentes.grupoAsignaturas
    .filter(ga => !asignaturasSeleccionadas.has(ga.asignatura_id))
    .map(ga => ga.id)

  const franjaIdsGuardadas = new Set(franjas.map(f => f.id))
  const franjaIdsABorrar = existentes.franjas.filter(f => !franjaIdsGuardadas.has(f.id)).map(f => f.id)

  const horario = (lista: FilaFranja[], grupoAsignaturaId: string) =>
    lista
      .filter(f => f.grupo_asignatura_id === grupoAsignaturaId)
      .map(f => `${f.id}|${f.dia_semana}|${f.periodo_id}`)
      .sort()
      .join(',')

  const grupoAsignaturaIdsConCambioDeHorario = existentes.grupoAsignaturas
    .filter(ga => asignaturasSeleccionadas.has(ga.asignatura_id))
    .filter(ga => horario(existentes.franjas, ga.id) !== horario(franjas, ga.id))
    .map(ga => ga.id)

  return { grupoAsignaturasNuevas, grupoAsignaturaIdsABorrar, franjas, franjaIdsABorrar, grupoAsignaturaIdsConCambioDeHorario }
}
