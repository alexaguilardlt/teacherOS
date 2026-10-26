import { describe, expect, it } from 'vitest'
import type { ElementoTemarioWizard } from '../stores/cursoWizard.types'
import { planificarGuardadoTemario } from './temario'

function generadorIds() {
  let n = 0
  return () => `nuevo-${++n}`
}

describe('planificarGuardadoTemario', () => {
  it('conserva el id de los temas y subtemas que ya existían', () => {
    const elementos: ElementoTemarioWizard[] = [{
      clienteId: 't1',
      clase: 'tema',
      nombre: 'La geosfera (editado)',
      duracionSesiones: 1,
      subtemas: [{ clienteId: 's1', nombre: 'Los minerales', duracionSesiones: 1.5 }]
    }]

    const plan = planificarGuardadoTemario('a1', elementos, { temaIds: ['t1'], subtemaIds: ['s1'] }, generadorIds())

    expect(plan.temas).toEqual([{ id: 't1', asignatura_id: 'a1', nombre: 'La geosfera (editado)', orden: 0 }])
    expect(plan.subtemas).toEqual([{
      id: 's1',
      asignatura_id: 'a1',
      tema_id: 't1',
      nombre: 'Los minerales',
      tipo: 'contenido',
      duracion_sesiones: 1.5,
      orden: 1
    }])
    expect(plan.temaIdsABorrar).toEqual([])
    expect(plan.subtemaIdsABorrar).toEqual([])
  })

  it('usa el clienteId como id de lo que se ha añadido y enlaza sus subtemas con él', () => {
    const elementos: ElementoTemarioWizard[] = [{
      clienteId: 'cliente-tema',
      clase: 'tema',
      nombre: 'Tema nuevo',
      duracionSesiones: 1,
      subtemas: [{ clienteId: 'cliente-subtema', nombre: 'Punto nuevo', duracionSesiones: 1 }]
    }]

    const plan = planificarGuardadoTemario('a1', elementos, { temaIds: [], subtemaIds: [] }, generadorIds())

    expect(plan.temas[0]!.id).toBe('cliente-tema')
    expect(plan.subtemas[0]!.id).toBe('cliente-subtema')
    expect(plan.subtemas[0]!.tema_id).toBe('cliente-tema')
  })

  it('solo borra lo que el profesor ha quitado', () => {
    const elementos: ElementoTemarioWizard[] = [{
      clienteId: 't1',
      clase: 'tema',
      nombre: 'Tema 1',
      duracionSesiones: 1,
      subtemas: [{ clienteId: 's1', nombre: 'Se queda', duracionSesiones: 1 }]
    }]

    const plan = planificarGuardadoTemario(
      'a1',
      elementos,
      { temaIds: ['t1', 't2'], subtemaIds: ['s1', 's2', 's-del-t2'] },
      generadorIds()
    )

    expect(plan.temaIdsABorrar).toEqual(['t2'])
    expect(plan.subtemaIdsABorrar).toEqual(['s2', 's-del-t2'])
  })

  it('un tema sin puntos se guarda como un único subtema con su nombre y duración', () => {
    const elementos: ElementoTemarioWizard[] = [{
      clienteId: 't1',
      clase: 'tema',
      nombre: 'Tema entero',
      duracionSesiones: 3,
      subtemas: []
    }]

    const plan = planificarGuardadoTemario('a1', elementos, { temaIds: ['t1'], subtemaIds: [] }, generadorIds())

    expect(plan.subtemas).toEqual([{
      id: 'nuevo-1',
      asignatura_id: 'a1',
      tema_id: 't1',
      nombre: 'Tema entero',
      tipo: 'contenido',
      duracion_sesiones: 3,
      orden: 1
    }])
  })

  it('los elementos sueltos no tienen tema y comparten el contador de orden con los temas', () => {
    const elementos: ElementoTemarioWizard[] = [
      {
        clienteId: 't1',
        clase: 'tema',
        nombre: 'Tema 1',
        duracionSesiones: 1,
        subtemas: [
          { clienteId: 's1', nombre: '1.1', duracionSesiones: 1 },
          { clienteId: 's2', nombre: '1.2', duracionSesiones: 0.5 }
        ]
      },
      { clienteId: 'e1', clase: 'suelto', tipo: 'examen', nombre: 'Parcial tema 1', duracionSesiones: 1 },
      { clienteId: 't2', clase: 'tema', nombre: 'Tema 2', duracionSesiones: 2, subtemas: [] }
    ]

    const plan = planificarGuardadoTemario(
      'a1',
      elementos,
      { temaIds: ['t1', 't2'], subtemaIds: ['s1', 's2', 'e1'] },
      generadorIds()
    )

    expect(plan.temas.map(t => [t.id, t.orden])).toEqual([['t1', 0], ['t2', 4]])
    expect(plan.subtemas.map(s => [s.id, s.tema_id, s.tipo, s.orden])).toEqual([
      ['s1', 't1', 'contenido', 1],
      ['s2', 't1', 'contenido', 2],
      ['e1', null, 'examen', 3],
      ['nuevo-1', 't2', 'contenido', 5]
    ])
  })
})
