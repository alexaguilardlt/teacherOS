import { describe, expect, it } from 'vitest'
import { construirCursoNuevo } from './cursoNuevo'

function generadorIds() {
  let n = 0
  return () => `id-${++n}`
}

describe('construirCursoNuevo', () => {
  const datos = {
    curso: { nombre: '2026/2027', fechaInicio: '2026-09-08', fechaFin: '2027-06-19' },
    festivos: [{ clienteId: 'x', nombre: '', fechaInicio: '2026-10-12', fechaFin: '' }],
    horariosTipo: [{
      clienteId: 'ht',
      nombre: 'Normal',
      vigencias: [],
      periodos: [{ clienteId: 'p1', horaInicio: '08:00', horaFin: '08:50' }]
    }],
    asignaturas: [{
      clienteId: 'a',
      nombre: 'Biología',
      elementos: [
        { clienteId: 't', clase: 'tema' as const, nombre: 'Geosfera', duracionSesiones: 1, subtemas: [{ clienteId: 's', nombre: 'Minerales', duracionSesiones: 1 }] },
        { clienteId: 'e', clase: 'suelto' as const, tipo: 'examen' as const, nombre: 'Parcial', duracionSesiones: 1 }
      ]
    }],
    grupos: [{
      clienteId: 'g',
      nombre: '1º ESO A',
      color: '#ff0000',
      asignaturas: [
        { asignaturaClienteId: 'a', franjas: [{ clienteId: 'f', diaSemana: 'lunes' as const, periodoClienteId: 'p1', propia: true }] },
        // Una asignatura que se borró del asistente después de asignarla: se ignora.
        { asignaturaClienteId: 'borrada', franjas: [] }
      ]
    }]
  }

  it('enlaza cada fila con su padre mediante ids nuevos, sin reutilizar los del asistente', () => {
    const curso = construirCursoNuevo(datos, generadorIds())

    const periodoId = curso.periodos[0]!.id
    const asignaturaId = curso.asignaturas[0]!.id
    const temaId = curso.temas[0]!.id
    const grupoId = curso.grupos[0]!.id
    const grupoAsignaturaId = curso.grupo_asignaturas[0]!.id

    expect(curso.periodos[0]!.horario_tipo_id).toBe(curso.horarios_tipo[0]!.id)
    expect(curso.temas[0]!.asignatura_id).toBe(asignaturaId)
    expect(curso.subtemas.map(s => [s.tema_id, s.tipo, s.orden])).toEqual([[temaId, 'contenido', 1], [null, 'examen', 2]])
    expect(curso.grupo_asignaturas).toEqual([{ id: grupoAsignaturaId, grupo_id: grupoId, asignatura_id: asignaturaId }])
    expect(curso.franjas).toEqual([{ id: curso.franjas[0]!.id, grupo_asignatura_id: grupoAsignaturaId, dia_semana: 'lunes', periodo_id: periodoId, propia: true }])

    const todosLosIds = [curso.curso.id, periodoId, asignaturaId, temaId, grupoId, grupoAsignaturaId, ...curso.subtemas.map(s => s.id)]
    expect(todosLosIds.every(id => id.startsWith('id-'))).toBe(true)
  })

  it('un festivo sin fecha de fin dura un solo día', () => {
    const curso = construirCursoNuevo(datos, generadorIds())
    expect(curso.festivos).toEqual([{ nombre: null, fecha_inicio: '2026-10-12', fecha_fin: '2026-10-12' }])
  })
})
