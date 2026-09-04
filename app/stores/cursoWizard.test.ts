import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCursoWizardStore } from './cursoWizard'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('cursoValido', () => {
  it('es falso si faltan datos del curso', () => {
    const store = useCursoWizardStore()
    expect(store.cursoValido).toBe(false)

    store.curso = { nombre: 'Curso 2025/2026', fechaInicio: '2025-09-08', fechaFin: '2026-06-19' }
    expect(store.cursoValido).toBe(true) // sin horariosTipo es válido: el horario es opcional
  })

  it('es falso si la fecha de fin no es posterior a la de inicio', () => {
    const store = useCursoWizardStore()
    store.curso = { nombre: 'Curso', fechaInicio: '2025-09-08', fechaFin: '2025-09-08' }
    store.horariosTipo = [{
      clienteId: 'ht1',
      nombre: 'General',
      vigencias: [],
      periodos: [{ clienteId: 'p1', horaInicio: '08:00', horaFin: '09:00' }]
    }]
    expect(store.cursoValido).toBe(false)
  })

  it('es falso si algún horario tipo no tiene periodos o un periodo tiene horas inválidas', () => {
    const store = useCursoWizardStore()
    store.curso = { nombre: 'Curso', fechaInicio: '2025-09-08', fechaFin: '2026-06-19' }
    store.horariosTipo = [{ clienteId: 'ht1', nombre: 'General', vigencias: [], periodos: [] }]
    expect(store.cursoValido).toBe(false)

    store.horariosTipo = [{
      clienteId: 'ht1',
      nombre: 'General',
      vigencias: [],
      periodos: [{ clienteId: 'p1', horaInicio: '09:00', horaFin: '08:00' }]
    }]
    expect(store.cursoValido).toBe(false)
  })

  it('es falso si un tramo de vigencia tiene una fecha vacía, o si el fin no es posterior al inicio', () => {
    const store = useCursoWizardStore()
    store.curso = { nombre: 'Curso', fechaInicio: '2025-09-08', fechaFin: '2026-06-19' }
    store.horariosTipo = [{
      clienteId: 'ht1',
      nombre: 'Reducido',
      vigencias: [{ clienteId: 'v1', fechaInicio: '2025-09-01', fechaFin: '' }],
      periodos: [{ clienteId: 'p1', horaInicio: '08:00', horaFin: '09:00' }]
    }]
    expect(store.cursoValido).toBe(false)

    store.horariosTipo = [{
      clienteId: 'ht1',
      nombre: 'Reducido',
      vigencias: [{ clienteId: 'v1', fechaInicio: '2025-09-30', fechaFin: '2025-09-01' }],
      periodos: [{ clienteId: 'p1', horaInicio: '08:00', horaFin: '09:00' }]
    }]
    expect(store.cursoValido).toBe(false)
  })

  it('es verdadero con un curso y al menos un horario tipo bien formados, con o sin vigencia (uno o varios tramos)', () => {
    const store = useCursoWizardStore()
    store.curso = { nombre: 'Curso', fechaInicio: '2025-09-08', fechaFin: '2026-06-19' }
    store.horariosTipo = [
      {
        clienteId: 'ht1',
        nombre: 'General',
        vigencias: [],
        periodos: [{ clienteId: 'p1', horaInicio: '08:00', horaFin: '09:00' }]
      },
      {
        clienteId: 'ht2',
        nombre: 'Reducido',
        vigencias: [
          { clienteId: 'v1', fechaInicio: '2025-09-01', fechaFin: '2025-09-30' },
          { clienteId: 'v2', fechaInicio: '2026-06-01', fechaFin: '2026-06-19' }
        ],
        periodos: [{ clienteId: 'p2', horaInicio: '08:00', horaFin: '13:00' }]
      }
    ]
    expect(store.cursoValido).toBe(true)
  })

  it('es falso si a un festivo le falta la fecha, o si la de fin es anterior a la de inicio', () => {
    const store = useCursoWizardStore()
    store.curso = { nombre: 'Curso', fechaInicio: '2025-09-08', fechaFin: '2026-06-19' }

    store.festivos = [{ clienteId: 'f1', nombre: 'San José', fechaInicio: '', fechaFin: '' }]
    expect(store.cursoValido).toBe(false)

    store.festivos = [{ clienteId: 'f1', nombre: 'Navidad', fechaInicio: '2025-12-22', fechaFin: '2025-12-01' }]
    expect(store.cursoValido).toBe(false)

    store.festivos = [{ clienteId: 'f1', nombre: 'Navidad', fechaInicio: '2025-12-22', fechaFin: '2026-01-07' }]
    expect(store.cursoValido).toBe(true)
  })

  it('es verdadero con un festivo de un solo día (fecha de fin vacía)', () => {
    const store = useCursoWizardStore()
    store.curso = { nombre: 'Curso', fechaInicio: '2025-09-08', fechaFin: '2026-06-19' }
    store.festivos = [{ clienteId: 'f1', nombre: 'San José', fechaInicio: '2026-03-19', fechaFin: '' }]
    expect(store.cursoValido).toBe(true)
  })
})

describe('asignaturasValidas', () => {
  it('es falso sin asignaturas o con alguna sin nombre', () => {
    const store = useCursoWizardStore()
    expect(store.asignaturasValidas).toBe(false)

    store.asignaturas = [{ clienteId: 'a1', nombre: '', elementos: [] }]
    expect(store.asignaturasValidas).toBe(false)
  })

  it('es verdadero cuando todas las asignaturas tienen nombre y no hay elementos', () => {
    const store = useCursoWizardStore()
    store.asignaturas = [{ clienteId: 'a1', nombre: 'Biología', elementos: [] }]
    expect(store.asignaturasValidas).toBe(true)
  })

  it('es falso si un subtema de un tema tiene duración inválida (no positiva o no múltiplo de 0.5)', () => {
    const store = useCursoWizardStore()
    store.asignaturas = [{
      clienteId: 'a1',
      nombre: 'Biología',
      elementos: [{
        clienteId: 't1',
        clase: 'tema',
        nombre: 'Tema 1',
        subtemas: [{ clienteId: 's1', nombre: 'Punto 1', duracionSesiones: 0.7 }],
        duracionSesiones: 1
      }]
    }]
    expect(store.asignaturasValidas).toBe(false)

    store.asignaturas[0]!.elementos[0] = {
      clienteId: 't1',
      clase: 'tema',
      nombre: 'Tema 1',
      subtemas: [{ clienteId: 's1', nombre: 'Punto 1', duracionSesiones: 0 }],
      duracionSesiones: 1
    }
    expect(store.asignaturasValidas).toBe(false)
  })

  it('un tema sin puntos usa su propia duración: falsa si no es válida, verdadera si lo es', () => {
    const store = useCursoWizardStore()
    store.asignaturas = [{
      clienteId: 'a1',
      nombre: 'Biología',
      elementos: [{ clienteId: 't1', clase: 'tema', nombre: 'Tema sin puntos', subtemas: [], duracionSesiones: 0.3 }]
    }]
    expect(store.asignaturasValidas).toBe(false)

    store.asignaturas[0]!.elementos[0] = { clienteId: 't1', clase: 'tema', nombre: 'Tema sin puntos', subtemas: [], duracionSesiones: 3 }
    expect(store.asignaturasValidas).toBe(true)
  })

  it('es falso si un elemento suelto no tiene nombre o su duración no es válida', () => {
    const store = useCursoWizardStore()
    store.asignaturas = [{
      clienteId: 'a1',
      nombre: 'Biología',
      elementos: [{ clienteId: 'e1', clase: 'suelto', tipo: 'examen', nombre: '', duracionSesiones: 1 }]
    }]
    expect(store.asignaturasValidas).toBe(false)

    store.asignaturas[0]!.elementos[0] = { clienteId: 'e1', clase: 'suelto', tipo: 'examen', nombre: 'Examen parcial', duracionSesiones: 1.3 }
    expect(store.asignaturasValidas).toBe(false)
  })

  it('es verdadero con temas y elementos sueltos bien formados', () => {
    const store = useCursoWizardStore()
    store.asignaturas = [{
      clienteId: 'a1',
      nombre: 'Biología',
      elementos: [
        {
          clienteId: 't1',
          clase: 'tema',
          nombre: 'Tema 1',
          subtemas: [{ clienteId: 's1', nombre: 'Punto 1', duracionSesiones: 1.5 }],
          duracionSesiones: 1
        },
        { clienteId: 'e1', clase: 'suelto', tipo: 'repaso', nombre: 'Repaso trimestral', duracionSesiones: 1 }
      ]
    }]
    expect(store.asignaturasValidas).toBe(true)
  })
})

describe('gruposValidos', () => {
  it('es falso sin grupos, sin nombre, o sin ninguna asignatura asociada', () => {
    const store = useCursoWizardStore()
    expect(store.gruposValidos).toBe(false)

    store.grupos = [{ clienteId: 'g1', nombre: '', color: '#000', asignaturas: [] }]
    expect(store.gruposValidos).toBe(false)

    store.grupos = [{
      clienteId: 'g1',
      nombre: '1º ESO A',
      color: '#000',
      asignaturas: []
    }]
    expect(store.gruposValidos).toBe(false) // ninguna asignatura asociada
  })

  it('es falso si una franja se añadió sin elegir periodo', () => {
    const store = useCursoWizardStore()
    store.grupos = [{
      clienteId: 'g1',
      nombre: '1º ESO A',
      color: '#000',
      asignaturas: [{ asignaturaClienteId: 'a1', franjas: [{ clienteId: 'f1', diaSemana: 'lunes', periodoClienteId: '' }] }]
    }]
    expect(store.gruposValidos).toBe(false)
  })

  it('es verdadero sin horario ni franjas: el horario es opcional y se puede añadir más tarde', () => {
    const store = useCursoWizardStore()
    store.grupos = [{
      clienteId: 'g1',
      nombre: '1º ESO A',
      color: '#000',
      asignaturas: [{ asignaturaClienteId: 'a1', franjas: [] }]
    }]
    expect(store.gruposValidos).toBe(true)
  })

  it('es verdadero cuando cada grupo tiene nombre y franjas con periodo', () => {
    const store = useCursoWizardStore()
    store.grupos = [{
      clienteId: 'g1',
      nombre: '1º ESO A',
      color: '#000',
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
      vigencias: [],
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
  it('es verdadero si dos periodos distintos de horarios tipo distintos (sin vigencia) coinciden en la hora real', () => {
    const store = useCursoWizardStore()
    store.horariosTipo = [
      { clienteId: 'ht1', nombre: 'ESO', vigencias: [], periodos: [{ clienteId: 'p1', horaInicio: '10:30', horaFin: '11:20' }] },
      { clienteId: 'ht2', nombre: 'Bachillerato', vigencias: [], periodos: [{ clienteId: 'p2', horaInicio: '10:30', horaFin: '11:20' }] }
    ]
    store.grupos = [
      {
        clienteId: 'g1',
        nombre: 'G1',
        color: '#000',
        asignaturas: [{ asignaturaClienteId: 'a1', franjas: [{ clienteId: 'f1', diaSemana: 'martes', periodoClienteId: 'p1' }] }]
      },
      {
        clienteId: 'g2',
        nombre: 'G2',
        color: '#000',
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
      asignaturas: [
        { asignaturaClienteId: 'a1', franjas: [{ clienteId: 'f1', diaSemana: 'lunes', periodoClienteId: 'p1' }] },
        { asignaturaClienteId: 'a2', franjas: [{ clienteId: 'f2', diaSemana: 'martes', periodoClienteId: 'p1' }] }
      ]
    }]
    expect(store.haySolape).toBe(false)
  })

  // Caso real que motivó la vigencia: un horario "Reducido" (septiembre y
  // junio) y uno "Normal" (octubre-mayo) pueden compartir día y hora sin
  // que sea un conflicto real, porque nunca coinciden en el calendario.
  it('es falso si dos franjas coinciden en día y hora pero sus horarios tipo tienen vigencias que no se solapan', () => {
    const store = useCursoWizardStore()
    store.horariosTipo = [
      { clienteId: 'ht-reducido', nombre: 'Reducido', vigencias: [{ clienteId: 'v1', fechaInicio: '2025-09-01', fechaFin: '2025-09-30' }], periodos: [{ clienteId: 'p1', horaInicio: '08:00', horaFin: '09:00' }] },
      { clienteId: 'ht-normal', nombre: 'Normal', vigencias: [{ clienteId: 'v2', fechaInicio: '2025-10-01', fechaFin: '2026-05-31' }], periodos: [{ clienteId: 'p2', horaInicio: '08:00', horaFin: '09:00' }] }
    ]
    store.grupos = [{
      clienteId: 'g1',
      nombre: 'G1',
      color: '#000',
      asignaturas: [
        { asignaturaClienteId: 'a1', franjas: [{ clienteId: 'f1', diaSemana: 'lunes', periodoClienteId: 'p1' }] },
        { asignaturaClienteId: 'a2', franjas: [{ clienteId: 'f2', diaSemana: 'lunes', periodoClienteId: 'p2' }] }
      ]
    }]
    expect(store.haySolape).toBe(false)
  })

  it('es verdadero si dos franjas coinciden en día y hora y sus vigencias sí se cruzan', () => {
    const store = useCursoWizardStore()
    store.horariosTipo = [
      { clienteId: 'ht-a', nombre: 'A', vigencias: [{ clienteId: 'v1', fechaInicio: '2025-09-01', fechaFin: '2025-10-15' }], periodos: [{ clienteId: 'p1', horaInicio: '08:00', horaFin: '09:00' }] },
      { clienteId: 'ht-b', nombre: 'B', vigencias: [{ clienteId: 'v2', fechaInicio: '2025-10-01', fechaFin: '2026-05-31' }], periodos: [{ clienteId: 'p2', horaInicio: '08:00', horaFin: '09:00' }] }
    ]
    store.grupos = [{
      clienteId: 'g1',
      nombre: 'G1',
      color: '#000',
      asignaturas: [
        { asignaturaClienteId: 'a1', franjas: [{ clienteId: 'f1', diaSemana: 'lunes', periodoClienteId: 'p1' }] },
        { asignaturaClienteId: 'a2', franjas: [{ clienteId: 'f2', diaSemana: 'lunes', periodoClienteId: 'p2' }] }
      ]
    }]
    expect(store.haySolape).toBe(true)
  })

  // Caso real: "Reducido" vigente en dos tramos (septiembre Y junio) no
  // choca con "Normal" (octubre-mayo) aunque compartan día y hora, porque
  // ningún tramo de uno se cruza con el del otro.
  it('es falso si un horario con dos tramos de vigencia no se cruza con otro horario', () => {
    const store = useCursoWizardStore()
    store.horariosTipo = [
      {
        clienteId: 'ht-reducido',
        nombre: 'Reducido',
        vigencias: [
          { clienteId: 'v1', fechaInicio: '2025-09-01', fechaFin: '2025-09-30' },
          { clienteId: 'v2', fechaInicio: '2026-06-01', fechaFin: '2026-06-19' }
        ],
        periodos: [{ clienteId: 'p1', horaInicio: '08:00', horaFin: '09:00' }]
      },
      {
        clienteId: 'ht-normal',
        nombre: 'Normal',
        vigencias: [{ clienteId: 'v3', fechaInicio: '2025-10-01', fechaFin: '2026-05-31' }],
        periodos: [{ clienteId: 'p2', horaInicio: '08:00', horaFin: '09:00' }]
      }
    ]
    store.grupos = [{
      clienteId: 'g1',
      nombre: 'G1',
      color: '#000',
      asignaturas: [
        { asignaturaClienteId: 'a1', franjas: [{ clienteId: 'f1', diaSemana: 'lunes', periodoClienteId: 'p1' }] },
        { asignaturaClienteId: 'a2', franjas: [{ clienteId: 'f2', diaSemana: 'lunes', periodoClienteId: 'p2' }] }
      ]
    }]
    expect(store.haySolape).toBe(false)
  })
})
