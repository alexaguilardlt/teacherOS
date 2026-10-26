import { describe, expect, it } from 'vitest'
import { calendarioAfectaAlReparto, festivosARangos, planificarGuardadoCurso, vigenciasPorHorarioTipo } from './curso'

describe('planificarGuardadoCurso', () => {
  it('conserva los ids, numera las franjas y solo borra lo quitado', () => {
    const plan = planificarGuardadoCurso([{
      clienteId: 'ht1',
      nombre: 'Normal',
      vigencias: [{ clienteId: 'v-nueva', fechaInicio: '2026-10-01', fechaFin: '2027-05-31' }],
      periodos: [
        { clienteId: 'p2', horaInicio: '09:00', horaFin: '09:50' },
        { clienteId: 'p-nuevo', horaInicio: '10:00', horaFin: '10:50' }
      ]
    }], { horarioTipoIds: ['ht1', 'ht2'], vigenciaIds: ['v1'], periodoIds: ['p1', 'p2'] })

    expect(plan.horarios_tipo).toEqual([{ id: 'ht1', nombre: 'Normal' }])
    expect(plan.periodos.map(p => [p.id, p.horario_tipo_id, p.orden])).toEqual([['p2', 'ht1', 0], ['p-nuevo', 'ht1', 1]])
    expect(plan.vigencias).toEqual([{ id: 'v-nueva', horario_tipo_id: 'ht1', fecha_inicio: '2026-10-01', fecha_fin: '2027-05-31' }])
    expect(plan.horarioTipoIdsABorrar).toEqual(['ht2'])
    expect(plan.vigenciaIdsABorrar).toEqual(['v1'])
    expect(plan.periodoIdsABorrar).toEqual(['p1'])
  })
})

describe('calendarioAfectaAlReparto', () => {
  const base = {
    fechaInicio: '2026-09-08',
    fechaFin: '2027-06-19',
    festivos: festivosARangos([{ fechaInicio: '2026-10-12', fechaFin: '' }]),
    vigencias: vigenciasPorHorarioTipo([{ horario_tipo_id: 'ht1', fecha_inicio: '2026-09-08', fecha_fin: '2026-09-30' }])
  }

  it('no afecta si el calendario es el mismo (aunque los festivos vengan en otro orden)', () => {
    const conDosFestivos = { ...base, festivos: [...base.festivos, { inicio: '2026-12-22', fin: '2027-01-07' }] }
    const enOtroOrden = { ...conDosFestivos, festivos: [...conDosFestivos.festivos].reverse() }
    expect(calendarioAfectaAlReparto(conDosFestivos, enOtroOrden)).toBe(false)
  })

  it('afecta si cambian las fechas del curso, un festivo o una vigencia', () => {
    expect(calendarioAfectaAlReparto(base, { ...base, fechaFin: '2027-06-23' })).toBe(true)
    expect(calendarioAfectaAlReparto(base, { ...base, festivos: [] })).toBe(true)
    expect(calendarioAfectaAlReparto(base, { ...base, vigencias: new Map() })).toBe(true)
  })
})
