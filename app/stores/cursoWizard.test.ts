import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCursoWizardStore } from './cursoWizard'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('cursoValido', () => {
  it('es falso si faltan datos del curso o no hay horarios tipo', () => {
    const store = useCursoWizardStore()
    expect(store.cursoValido).toBe(false)

    store.curso = { nombre: 'Curso 2025/2026', fechaInicio: '2025-09-08', fechaFin: '2026-06-19' }
    expect(store.cursoValido).toBe(false) // sin horariosTipo todavía
  })

  it('es falso si la fecha de fin no es posterior a la de inicio', () => {
    const store = useCursoWizardStore()
    store.curso = { nombre: 'Curso', fechaInicio: '2025-09-08', fechaFin: '2025-09-08' }
    store.horariosTipo = [{
      clienteId: 'ht1',
      nombre: 'General',
      periodos: [{ clienteId: 'p1', horaInicio: '08:00', horaFin: '09:00' }]
    }]
    expect(store.cursoValido).toBe(false)
  })

  it('es falso si algún horario tipo no tiene periodos o un periodo tiene horas inválidas', () => {
    const store = useCursoWizardStore()
    store.curso = { nombre: 'Curso', fechaInicio: '2025-09-08', fechaFin: '2026-06-19' }
    store.horariosTipo = [{ clienteId: 'ht1', nombre: 'General', periodos: [] }]
    expect(store.cursoValido).toBe(false)

    store.horariosTipo = [{
      clienteId: 'ht1',
      nombre: 'General',
      periodos: [{ clienteId: 'p1', horaInicio: '09:00', horaFin: '08:00' }]
    }]
    expect(store.cursoValido).toBe(false)
  })

  it('es verdadero con un curso y al menos un horario tipo bien formados', () => {
    const store = useCursoWizardStore()
    store.curso = { nombre: 'Curso', fechaInicio: '2025-09-08', fechaFin: '2026-06-19' }
    store.horariosTipo = [{
      clienteId: 'ht1',
      nombre: 'General',
      periodos: [{ clienteId: 'p1', horaInicio: '08:00', horaFin: '09:00' }]
    }]
    expect(store.cursoValido).toBe(true)
  })
})

describe('asignaturasValidas', () => {
  it('es falso sin asignaturas o con alguna sin nombre', () => {
    const store = useCursoWizardStore()
    expect(store.asignaturasValidas).toBe(false)

    store.asignaturas = [{ clienteId: 'a1', nombre: '', temas: [] }]
    expect(store.asignaturasValidas).toBe(false)
  })

  it('es verdadero cuando todas las asignaturas tienen nombre', () => {
    const store = useCursoWizardStore()
    store.asignaturas = [{ clienteId: 'a1', nombre: 'Biología', temas: [] }]
    expect(store.asignaturasValidas).toBe(true)
  })
})

describe('gruposValidos', () => {
  it('es falso sin grupos, sin nombre/horario, o sin franjas asignadas', () => {
    const store = useCursoWizardStore()
    expect(store.gruposValidos).toBe(false)

    store.grupos = [{ clienteId: 'g1', nombre: '', color: '#000', horarioTipoClienteId: 'ht1', asignaturas: [] }]
    expect(store.gruposValidos).toBe(false)

    store.grupos = [{
      clienteId: 'g1',
      nombre: '1º ESO A',
      color: '#000',
      horarioTipoClienteId: 'ht1',
      asignaturas: [{ asignaturaClienteId: 'a1', franjas: [] }]
    }]
    expect(store.gruposValidos).toBe(false) // asignatura sin ninguna franja

    store.grupos = [{
      clienteId: 'g1',
      nombre: '1º ESO A',
      color: '#000',
      horarioTipoClienteId: 'ht1',
      asignaturas: [{ asignaturaClienteId: 'a1', franjas: [{ clienteId: 'f1', diaSemana: 'lunes', periodoClienteId: '' }] }]
    }]
    expect(store.gruposValidos).toBe(false) // franja sin periodo
  })

  it('es verdadero cuando cada grupo tiene nombre, horario y franjas con periodo', () => {
    const store = useCursoWizardStore()
    store.grupos = [{
      clienteId: 'g1',
      nombre: '1º ESO A',
      color: '#000',
      horarioTipoClienteId: 'ht1',
      asignaturas: [{ asignaturaClienteId: 'a1', franjas: [{ clienteId: 'f1', diaSemana: 'lunes', periodoClienteId: 'p1' }] }]
    }]
    expect(store.gruposValidos).toBe(true)
  })
})

describe('haySolape', () => {
  function darDeAltaHorario(store: ReturnType<typeof useCursoWizardStore>) {
    store.horariosTipo = [{
      clienteId: 'ht1',
      nombre: 'General',
      periodos: [
        { clienteId: 'p1', horaInicio: '08:00', horaFin: '09:00' },
        { clienteId: 'p2', horaInicio: '09:00', horaFin: '10:00' }
      ]
    }]
  }

  it('es falso si dos franjas del mismo día no se solapan en horas', () => {
    const store = useCursoWizardStore()
    darDeAltaHorario(store)
    store.grupos = [{
      clienteId: 'g1',
      nombre: 'G1',
      color: '#000',
      horarioTipoClienteId: 'ht1',
      asignaturas: [
        { asignaturaClienteId: 'a1', franjas: [{ clienteId: 'f1', diaSemana: 'lunes', periodoClienteId: 'p1' }] },
        { asignaturaClienteId: 'a2', franjas: [{ clienteId: 'f2', diaSemana: 'lunes', periodoClienteId: 'p2' }] }
      ]
    }]
    expect(store.haySolape).toBe(false)
  })

  it('es verdadero si dos franjas del mismo día comparten el mismo periodo', () => {
    const store = useCursoWizardStore()
    darDeAltaHorario(store)
    store.grupos = [{
      clienteId: 'g1',
      nombre: 'G1',
      color: '#000',
      horarioTipoClienteId: 'ht1',
      asignaturas: [
        { asignaturaClienteId: 'a1', franjas: [{ clienteId: 'f1', diaSemana: 'lunes', periodoClienteId: 'p1' }] },
        { asignaturaClienteId: 'a2', franjas: [{ clienteId: 'f2', diaSemana: 'lunes', periodoClienteId: 'p1' }] }
      ]
    }]
    expect(store.haySolape).toBe(true)
  })

  // Decisión de diseño documentada: distintos horarios tipo pueden definir franjas
  // con el mismo rango real de horas (p. ej. dos ciclos con el período 10:30-11:20).
  // haySolape debe detectar el choque por hora real, no por clienteId de periodo.
  it('es verdadero si dos periodos distintos de horarios tipo distintos coinciden en la hora real', () => {
    const store = useCursoWizardStore()
    store.horariosTipo = [
      { clienteId: 'ht1', nombre: 'ESO', periodos: [{ clienteId: 'p1', horaInicio: '10:30', horaFin: '11:20' }] },
      { clienteId: 'ht2', nombre: 'Bachillerato', periodos: [{ clienteId: 'p2', horaInicio: '10:30', horaFin: '11:20' }] }
    ]
    store.grupos = [
      {
        clienteId: 'g1',
        nombre: 'G1',
        color: '#000',
        horarioTipoClienteId: 'ht1',
        asignaturas: [{ asignaturaClienteId: 'a1', franjas: [{ clienteId: 'f1', diaSemana: 'martes', periodoClienteId: 'p1' }] }]
      },
      {
        clienteId: 'g2',
        nombre: 'G2',
        color: '#000',
        horarioTipoClienteId: 'ht2',
        asignaturas: [{ asignaturaClienteId: 'a2', franjas: [{ clienteId: 'f2', diaSemana: 'martes', periodoClienteId: 'p2' }] }]
      }
    ]
    expect(store.haySolape).toBe(true)
  })

  it('es falso si las franjas que coinciden en hora son en días distintos', () => {
    const store = useCursoWizardStore()
    darDeAltaHorario(store)
    store.grupos = [{
      clienteId: 'g1',
      nombre: 'G1',
      color: '#000',
      horarioTipoClienteId: 'ht1',
      asignaturas: [
        { asignaturaClienteId: 'a1', franjas: [{ clienteId: 'f1', diaSemana: 'lunes', periodoClienteId: 'p1' }] },
        { asignaturaClienteId: 'a2', franjas: [{ clienteId: 'f2', diaSemana: 'martes', periodoClienteId: 'p1' }] }
      ]
    }]
    expect(store.haySolape).toBe(false)
  })
})
