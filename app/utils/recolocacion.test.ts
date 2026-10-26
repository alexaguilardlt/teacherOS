import { describe, expect, it } from 'vitest'
import { aRecolocacionJson, recolocacionesConfirmadas } from './recolocacion'

describe('aRecolocacionJson', () => {
  it('traduce las sesiones al formato de aplicar_recolocacion', () => {
    const json = aRecolocacionJson(
      ['vieja-1'],
      [{ franjaId: 'f1', fecha: '2026-10-12', subtemas: [{ subtemaId: 's1', fraccion: 0.5 }, { subtemaId: 's2', fraccion: 0.5 }] }],
      'confirmada'
    )

    expect(json).toEqual({
      sesiones_a_cancelar: [],
      sesiones_a_eliminar: ['vieja-1'],
      sesiones_nuevas: [{
        franja_horaria_id: 'f1',
        fecha: '2026-10-12',
        estado: 'confirmada',
        subtemas: [{ subtema_id: 's1', fraccion: 0.5 }, { subtema_id: 's2', fraccion: 0.5 }]
      }]
    })
  })
})

describe('recolocacionesConfirmadas', () => {
  it('pasa las sesiones a cancelar de cada vista previa', () => {
    const [json] = recolocacionesConfirmadas([{ sesionesAEliminarIds: ['b'], sesionesNuevas: [], sesionesACancelarIds: ['a'] }])
    expect(json).toEqual({ sesiones_a_cancelar: ['a'], sesiones_a_eliminar: ['b'], sesiones_nuevas: [] })
  })
})
