import { describe, expect, it } from 'vitest'
import { fechaLocalISO } from './fechas'

describe('fechaLocalISO', () => {
  it('usa la fecha local, no la UTC', () => {
    // 00:30 hora local del 1 de octubre: en UTC (España) aún sería 30 de septiembre.
    expect(fechaLocalISO(new Date(2026, 9, 1, 0, 30))).toBe('2026-10-01')
  })

  it('rellena con ceros el mes y el día', () => {
    expect(fechaLocalISO(new Date(2027, 0, 5))).toBe('2027-01-05')
  })
})
