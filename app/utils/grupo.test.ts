import { describe, expect, it } from 'vitest'
import type { FilaFranja } from './grupo'
import { argumentosGuardarGrupo, planificarGuardadoGrupo } from './grupo'

function generadorIds() {
  let n = 0
  return () => `nuevo-${++n}`
}

const existentes = {
  grupoAsignaturas: [
    { id: 'ga-mates', grupo_id: 'g1', asignatura_id: 'mates' },
    { id: 'ga-bio', grupo_id: 'g1', asignatura_id: 'bio' }
  ],
  franjas: [
    { id: 'f1', grupo_asignatura_id: 'ga-mates', dia_semana: 'lunes', periodo_id: 'p1', propia: true },
    { id: 'f2', grupo_asignatura_id: 'ga-bio', dia_semana: 'martes', periodo_id: 'p1', propia: true }
  ] satisfies FilaFranja[]
}

describe('planificarGuardadoGrupo', () => {
  it('sin cambios de horario no borra ni recoloca nada', () => {
    const plan = planificarGuardadoGrupo('g1', [
      { asignaturaId: 'mates', franjas: [{ clienteId: 'f1', diaSemana: 'lunes', periodoId: 'p1', propia: true }] },
      { asignaturaId: 'bio', franjas: [{ clienteId: 'f2', diaSemana: 'martes', periodoId: 'p1', propia: true }] }
    ], existentes, generadorIds())

    expect(plan.grupoAsignaturasNuevas).toEqual([])
    expect(plan.grupoAsignaturaIdsABorrar).toEqual([])
    expect(plan.franjaIdsABorrar).toEqual([])
    expect(plan.grupoAsignaturaIdsConCambioDeHorario).toEqual([])
    expect(plan.franjas.map(f => f.id)).toEqual(['f1', 'f2'])
  })

  it('cambiar solo "La imparto yo" no obliga a recolocar', () => {
    const plan = planificarGuardadoGrupo('g1', [
      { asignaturaId: 'mates', franjas: [{ clienteId: 'f1', diaSemana: 'lunes', periodoId: 'p1', propia: false }] },
      { asignaturaId: 'bio', franjas: [{ clienteId: 'f2', diaSemana: 'martes', periodoId: 'p1', propia: true }] }
    ], existentes, generadorIds())

    expect(plan.franjas[0]!.propia).toBe(false)
    expect(plan.grupoAsignaturaIdsConCambioDeHorario).toEqual([])
  })

  it('detecta qué asignaturas cambian de horario y qué franjas se quitan', () => {
    const plan = planificarGuardadoGrupo('g1', [
      {
        asignaturaId: 'mates',
        franjas: [
          { clienteId: 'f1', diaSemana: 'miercoles', periodoId: 'p1', propia: true },
          { clienteId: 'f-nueva', diaSemana: 'jueves', periodoId: 'p2', propia: true }
        ]
      },
      { asignaturaId: 'bio', franjas: [] }
    ], existentes, generadorIds())

    expect(plan.franjaIdsABorrar).toEqual(['f2'])
    expect(plan.grupoAsignaturaIdsConCambioDeHorario).toEqual(['ga-mates', 'ga-bio'])
    expect(plan.franjas.find(f => f.id === 'f-nueva')!.grupo_asignatura_id).toBe('ga-mates')
  })

  it('añade y quita asignaturas del grupo', () => {
    const plan = planificarGuardadoGrupo('g1', [
      { asignaturaId: 'mates', franjas: [{ clienteId: 'f1', diaSemana: 'lunes', periodoId: 'p1', propia: true }] },
      { asignaturaId: 'fisica', franjas: [{ clienteId: 'f-fis', diaSemana: 'viernes', periodoId: 'p1', propia: true }] }
    ], existentes, generadorIds())

    expect(plan.grupoAsignaturasNuevas).toEqual([{ id: 'nuevo-1', grupo_id: 'g1', asignatura_id: 'fisica' }])
    expect(plan.franjas.find(f => f.id === 'f-fis')!.grupo_asignatura_id).toBe('nuevo-1')
    expect(plan.grupoAsignaturaIdsABorrar).toEqual(['ga-bio'])
    // Quitar la asignatura entera no es un cambio de horario: su reparto se va con ella.
    expect(plan.grupoAsignaturaIdsConCambioDeHorario).toEqual([])
  })
})

describe('argumentosGuardarGrupo', () => {
  it('un grupo nuevo lleva todas sus asignaturas y franjas como nuevas', () => {
    const plan = planificarGuardadoGrupo('g-nuevo', [
      { asignaturaId: 'mates', franjas: [{ clienteId: 'f1', diaSemana: 'lunes', periodoId: 'p1', propia: true }] }
    ], { grupoAsignaturas: [], franjas: [] }, generadorIds())

    const args = argumentosGuardarGrupo({ id: 'g-nuevo', cursoId: 'c1', nombre: '1º ESO A', color: '#000000' }, plan, [])

    expect(args).toEqual({
      p_grupo_id: 'g-nuevo',
      p_curso_id: 'c1',
      p_nombre: '1º ESO A',
      p_color: '#000000',
      p_grupo_asignaturas_nuevas: [{ id: 'nuevo-1', asignatura_id: 'mates' }],
      p_franjas: [{ id: 'f1', grupo_asignatura_id: 'nuevo-1', dia_semana: 'lunes', periodo_id: 'p1', propia: true }],
      p_franja_ids_a_borrar: [],
      p_grupo_asignatura_ids_a_borrar: [],
      p_recolocaciones: []
    })
  })
})
