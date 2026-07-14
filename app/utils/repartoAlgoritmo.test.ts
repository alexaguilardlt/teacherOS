import { describe, expect, it } from 'vitest'
import { agruparEnBloques, construirSlots, estaEnFestivo, repartirBloques } from './repartoAlgoritmo'

describe('estaEnFestivo', () => {
  it('detecta una fecha dentro del rango, incluyendo los extremos', () => {
    const festivos = [{ inicio: '2025-12-22', fin: '2026-01-07' }]
    expect(estaEnFestivo('2025-12-22', festivos)).toBe(true)
    expect(estaEnFestivo('2026-01-07', festivos)).toBe(true)
    expect(estaEnFestivo('2025-12-30', festivos)).toBe(true)
  })

  it('devuelve false fuera de cualquier rango o sin festivos', () => {
    const festivos = [{ inicio: '2025-12-22', fin: '2026-01-07' }]
    expect(estaEnFestivo('2025-12-21', festivos)).toBe(false)
    expect(estaEnFestivo('2026-01-08', festivos)).toBe(false)
    expect(estaEnFestivo('2025-12-25', [])).toBe(false)
  })
})

describe('construirSlots', () => {
  it('genera un slot por cada fecha que coincide con el día de la semana de la franja', () => {
    // 2025-09-01 y 2025-09-08 son lunes
    const slots = construirSlots(
      [{ franjaId: 'f1', diaSemana: 'lunes', horaInicio: '08:00' }],
      '2025-09-01',
      '2025-09-14',
      []
    )
    expect(slots.map(s => s.fecha)).toEqual(['2025-09-01', '2025-09-08'])
  })

  it('excluye las fechas que caen en un festivo', () => {
    const slots = construirSlots(
      [{ franjaId: 'f1', diaSemana: 'lunes', horaInicio: '08:00' }],
      '2025-09-01',
      '2025-09-14',
      [{ inicio: '2025-09-08', fin: '2025-09-08' }]
    )
    expect(slots.map(s => s.fecha)).toEqual(['2025-09-01'])
  })

  it('ordena los slots por fecha y, dentro del mismo día, por hora', () => {
    const slots = construirSlots(
      [
        { franjaId: 'tarde', diaSemana: 'lunes', horaInicio: '09:00' },
        { franjaId: 'manana', diaSemana: 'lunes', horaInicio: '08:00' }
      ],
      '2025-09-01',
      '2025-09-08',
      []
    )
    expect(slots.map(s => `${s.fecha}-${s.franjaId}`)).toEqual([
      '2025-09-01-manana',
      '2025-09-01-tarde',
      '2025-09-08-manana',
      '2025-09-08-tarde'
    ])
  })
})

describe('agruparEnBloques', () => {
  const duracionPorDificultad = new Map([
    ['baja', 0.5],
    ['media', 1],
    ['alta', 2]
  ])

  it('empareja subtemas fáciles consecutivos en un único bloque de ancho 1', () => {
    const bloques = agruparEnBloques(
      [{ id: 'a', dificultad: 'baja' }, { id: 'b', dificultad: 'baja' }],
      duracionPorDificultad
    )
    expect(bloques).toEqual([{ subtemaIds: ['a', 'b'], ancho: 1 }])
  })

  it('empareja subtemas fáciles aunque haya uno no-fácil de por medio, y deja el último impar como bloque propio', () => {
    const bloques = agruparEnBloques(
      [
        { id: 'a', dificultad: 'baja' },
        { id: 'b', dificultad: 'baja' },
        { id: 'c', dificultad: 'media' },
        { id: 'd', dificultad: 'baja' }
      ],
      duracionPorDificultad
    )
    expect(bloques).toEqual([
      { subtemaIds: ['a', 'b'], ancho: 1 },
      { subtemaIds: ['c'], ancho: 1 },
      { subtemaIds: ['d'], ancho: 1 }
    ])
  })

  it('da a los subtemas medios y difíciles su propio bloque con el ancho de su dificultad', () => {
    const bloques = agruparEnBloques(
      [{ id: 'a', dificultad: 'media' }, { id: 'b', dificultad: 'alta' }],
      duracionPorDificultad
    )
    expect(bloques).toEqual([
      { subtemaIds: ['a'], ancho: 1 },
      { subtemaIds: ['b'], ancho: 2 }
    ])
  })

  it('usa duración 1 por defecto si la dificultad no tiene regla configurada', () => {
    const bloques = agruparEnBloques([{ id: 'x', dificultad: 'desconocida' }], new Map())
    expect(bloques).toEqual([{ subtemaIds: ['x'], ancho: 1 }])
  })
})

describe('repartirBloques', () => {
  it('asigna fraccion 0.5 a los bloques emparejados y 1 a los normales', () => {
    const slots = construirSlots(
      [{ franjaId: 'f1', diaSemana: 'lunes', horaInicio: '08:00' }],
      '2025-09-01',
      '2025-09-15',
      []
    )
    const bloques = [
      { subtemaIds: ['a', 'b'], ancho: 1 },
      { subtemaIds: ['c'], ancho: 1 }
    ]
    const { asignaciones } = repartirBloques(bloques, slots, '2025-09-01', '2025-09-15')
    expect(asignaciones.filter(a => a.subtemaId === 'a' || a.subtemaId === 'b').every(a => a.fraccion === 0.5)).toBe(true)
    expect(asignaciones.find(a => a.subtemaId === 'c')?.fraccion).toBe(1)
  })

  it('manda a subtemasNoAsignadosIds lo que no cabe en los slots disponibles', () => {
    const slots = construirSlots(
      [{ franjaId: 'f1', diaSemana: 'lunes', horaInicio: '08:00' }],
      '2025-09-01',
      '2025-09-08',
      []
    )
    // Solo hay 2 slots disponibles (2 lunes); un bloque de ancho 3 no cabe.
    const bloques = [{ subtemaIds: ['a'], ancho: 3 }]
    const { asignaciones, subtemasNoAsignadosIds } = repartirBloques(bloques, slots, '2025-09-01', '2025-09-08')
    expect(asignaciones).toEqual([])
    expect(subtemasNoAsignadosIds).toEqual(['a'])
  })

  // Regresión del bug real: con muchas franjas semanales (p. ej. 9/semana), avanzar
  // el cursor un nº fijo de slots podía coincidir con el nº de franjas por semana y
  // caer siempre en el mismo día, dejando jueves y viernes sin sesiones jamás.
  it('reparte el contenido entre todos los días de la semana con muchas franjas (no se queda enganchado en un solo día)', () => {
    const diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'] as const
    const franjas = diasSemana.flatMap(dia =>
      Array.from({ length: 2 }, (_, i) => ({ franjaId: `${dia}-${i}`, diaSemana: dia, horaInicio: `0${8 + i}:00` }))
    )
    // 10 franjas/semana durante 10 semanas ⇒ 100 slots disponibles.
    const slots = construirSlots(franjas, '2025-09-01', '2025-11-07', [])
    expect(slots.length).toBeGreaterThan(90)

    // 20 subtemas de una sesión cada uno: muchos menos que los slots disponibles,
    // el mismo desequilibrio que causaba el bug original.
    const bloques = Array.from({ length: 20 }, (_, i) => ({ subtemaIds: [`s${i}`], ancho: 1 }))
    const { asignaciones } = repartirBloques(bloques, slots, '2025-09-01', '2025-11-07')

    const diaSemanaDe = (fechaISO: string) => {
      const indice = new Date(`${fechaISO}T00:00:00Z`).getUTCDay()
      return ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][indice]
    }
    const diasUsados = new Set(asignaciones.map(a => diaSemanaDe(a.slot.fecha)))
    expect(diasUsados.has('jueves')).toBe(true)
    expect(diasUsados.has('viernes')).toBe(true)
    expect(diasUsados.size).toBeGreaterThan(2)
  })
})
