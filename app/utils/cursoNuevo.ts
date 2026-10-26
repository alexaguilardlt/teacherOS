import type { AsignaturaWizard, FestivoWizard, GrupoWizard, HorarioTipoWizard } from '../stores/cursoWizard.types'
import { planificarGuardadoGrupo } from './grupo'
import { planificarGuardadoTemario } from './temario'

export interface DatosWizard {
  curso: { nombre: string, fechaInicio: string, fechaFin: string }
  festivos: FestivoWizard[]
  horariosTipo: HorarioTipoWizard[]
  asignaturas: AsignaturaWizard[]
  grupos: GrupoWizard[]
}

// Traduce todo lo que se ha rellenado en el asistente a las filas que crea
// la función de Postgres crear_curso (migración 017), en una sola
// transacción. Los ids se generan aquí (no se reutilizan los clienteId del
// asistente), así cada fila puede apuntar a su padre sin esperar a que la
// base de datos los devuelva. Temas y grupos se calculan con lo mismo que
// usan sus pantallas de edición, como si se crearan desde cero.
export function construirCursoNuevo(datos: DatosWizard, nuevoId: () => string = () => crypto.randomUUID()) {
  const cursoId = nuevoId()

  const horariosTipo: { id: string, nombre: string }[] = []
  const vigencias: { horario_tipo_id: string, fecha_inicio: string, fecha_fin: string }[] = []
  const periodos: { id: string, horario_tipo_id: string, hora_inicio: string, hora_fin: string, orden: number }[] = []
  const periodoIdPorClienteId = new Map<string, string>()

  for (const ht of datos.horariosTipo) {
    const horarioTipoId = nuevoId()
    horariosTipo.push({ id: horarioTipoId, nombre: ht.nombre })
    for (const v of ht.vigencias) {
      vigencias.push({ horario_tipo_id: horarioTipoId, fecha_inicio: v.fechaInicio, fecha_fin: v.fechaFin })
    }
    ht.periodos.forEach((p, orden) => {
      const periodoId = nuevoId()
      periodoIdPorClienteId.set(p.clienteId, periodoId)
      periodos.push({ id: periodoId, horario_tipo_id: horarioTipoId, hora_inicio: p.horaInicio, hora_fin: p.horaFin, orden })
    })
  }

  const asignaturas: { id: string, nombre: string }[] = []
  const temas: { id: string, asignatura_id: string, nombre: string, orden: number }[] = []
  const subtemas: ReturnType<typeof planificarGuardadoTemario>['subtemas'] = []
  const asignaturaIdPorClienteId = new Map<string, string>()

  for (const asignatura of datos.asignaturas) {
    const asignaturaId = nuevoId()
    asignaturaIdPorClienteId.set(asignatura.clienteId, asignaturaId)
    asignaturas.push({ id: asignaturaId, nombre: asignatura.nombre })

    const elementosConIdsNuevos = asignatura.elementos.map(e =>
      e.clase === 'tema'
        ? { ...e, clienteId: nuevoId(), subtemas: e.subtemas.map(s => ({ ...s, clienteId: nuevoId() })) }
        : { ...e, clienteId: nuevoId() }
    )
    const plan = planificarGuardadoTemario(asignaturaId, elementosConIdsNuevos, { temaIds: [], subtemaIds: [] }, nuevoId)
    temas.push(...plan.temas)
    subtemas.push(...plan.subtemas)
  }

  const grupos: { id: string, nombre: string, color: string }[] = []
  const grupoAsignaturas: { id: string, grupo_id: string, asignatura_id: string }[] = []
  const franjas: { id: string, grupo_asignatura_id: string, dia_semana: string, periodo_id: string, propia: boolean }[] = []

  for (const grupo of datos.grupos) {
    const grupoId = nuevoId()
    grupos.push({ id: grupoId, nombre: grupo.nombre, color: grupo.color })

    const seleccion = grupo.asignaturas
      .filter(ga => asignaturaIdPorClienteId.has(ga.asignaturaClienteId))
      .map(ga => ({
        asignaturaId: asignaturaIdPorClienteId.get(ga.asignaturaClienteId)!,
        franjas: ga.franjas.map(f => ({
          clienteId: nuevoId(),
          diaSemana: f.diaSemana,
          periodoId: periodoIdPorClienteId.get(f.periodoClienteId)!,
          propia: f.propia
        }))
      }))
    const plan = planificarGuardadoGrupo(grupoId, seleccion, { grupoAsignaturas: [], franjas: [] }, nuevoId)
    grupoAsignaturas.push(...plan.grupoAsignaturasNuevas)
    franjas.push(...plan.franjas.map(f => ({ ...f })))
  }

  return {
    curso: { id: cursoId, nombre: datos.curso.nombre, fecha_inicio: datos.curso.fechaInicio, fecha_fin: datos.curso.fechaFin },
    festivos: datos.festivos.map(f => ({
      nombre: f.nombre || null,
      fecha_inicio: f.fechaInicio,
      fecha_fin: f.fechaFin || f.fechaInicio
    })),
    horarios_tipo: horariosTipo,
    vigencias,
    periodos,
    asignaturas,
    temas: temas.map(t => ({ ...t })),
    subtemas: subtemas.map(s => ({ ...s })),
    grupos,
    grupo_asignaturas: grupoAsignaturas,
    franjas
  }
}
