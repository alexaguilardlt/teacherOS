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

  it('acota una franja a la vigencia de su horario tipo (ej. horario "Reducido" solo en septiembre)', () => {
    // Todos los lunes de septiembre a noviembre son: 1, 8, 15, 22, 29 sept;
    // 6, 13, 20, 27 oct; 3, 10, 17, 24 nov.
    const slots = construirSlots(
      [{ franjaId: 'f1', diaSemana: 'lunes', horaInicio: '08:00', vigencias: [{ inicio: '2025-09-01', fin: '2025-09-30' }] }],
      '2025-09-01',
      '2025-11-30',
      []
    )
    expect(slots.map(s => s.fecha)).toEqual(['2025-09-01', '2025-09-08', '2025-09-15', '2025-09-22', '2025-09-29'])
  })

  it('un horario "Reducido" con dos tramos de vigencia (septiembre y junio) cubre ambos con una sola franja', () => {
    const slots = construirSlots(
      [{
        franjaId: 'reducido',
        diaSemana: 'lunes',
        horaInicio: '08:00',
        vigencias: [
          { inicio: '2025-09-01', fin: '2025-09-30' },
          { inicio: '2026-06-01', fin: '2026-06-19' }
        ]
      }],
      '2025-09-01',
      '2026-06-19',
      []
    )
    expect(slots.filter(s => s.fecha.startsWith('2025-09'))).toHaveLength(5) // lunes de septiembre
    expect(slots.filter(s => s.fecha.startsWith('2026-06'))).toHaveLength(3) // lunes de 1-19 junio
  })

  it('combina en un mismo grupo franjas con vigencias distintas y complementarias', () => {
    const slots = construirSlots(
      [
        { franjaId: 'reducido', diaSemana: 'lunes', horaInicio: '08:00', vigencias: [{ inicio: '2025-09-01', fin: '2025-09-30' }] },
        { franjaId: 'normal', diaSemana: 'lunes', horaInicio: '09:00', vigencias: [{ inicio: '2025-10-01', fin: '2025-11-30' }] }
      ],
      '2025-09-01',
      '2025-11-30',
      []
    )
    expect(slots.filter(s => s.franjaId === 'reducido')).toHaveLength(5) // lunes de septiembre
    expect(slots.filter(s => s.franjaId === 'normal')).toHaveLength(8) // lunes de oct+nov
  })

  it('recorta la vigencia de una franja si se sale de las fechas reales del curso', () => {
    const slots = construirSlots(
      [{ franjaId: 'f1', diaSemana: 'lunes', horaInicio: '08:00', vigencias: [{ inicio: '2025-08-01', fin: '2025-09-30' }] }],
      '2025-09-01',
      '2025-09-14',
      []
    )
    expect(slots.map(s => s.fecha)).toEqual(['2025-09-01', '2025-09-08'])
  })

  it('sin vigencia (undefined) la franja aplica a todo el curso, como antes', () => {
    const slots = construirSlots(
      [{ franjaId: 'f1', diaSemana: 'lunes', horaInicio: '08:00' }],
      '2025-09-01',
      '2025-09-14',
      []
    )
    expect(slots.map(s => s.fecha)).toEqual(['2025-09-01', '2025-09-08'])
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
  it('empareja subtemas de 0.5 sesiones consecutivos en un único bloque de ancho 1', () => {
    const bloques = agruparEnBloques([
      { id: 'a', duracionSesiones: 0.5 },
      { id: 'b', duracionSesiones: 0.5 }
    ])
    expect(bloques).toEqual([{ subtemaIds: ['a', 'b'], ancho: 1 }])
  })

  it('empareja subtemas de 0.5 sesiones aunque haya uno más largo de por medio, y deja el último impar como bloque propio', () => {
    const bloques = agruparEnBloques([
      { id: 'a', duracionSesiones: 0.5 },
      { id: 'b', duracionSesiones: 0.5 },
      { id: 'c', duracionSesiones: 1 },
      { id: 'd', duracionSesiones: 0.5 }
    ])
    expect(bloques).toEqual([
      { subtemaIds: ['a', 'b'], ancho: 1 },
      { subtemaIds: ['c'], ancho: 1 },
      { subtemaIds: ['d'], ancho: 1 }
    ])
  })

  it('da a los subtemas de más de 0.5 sesiones su propio bloque con el ancho redondeado a sesiones enteras', () => {
    const bloques = agruparEnBloques([
      { id: 'a', duracionSesiones: 1 },
      { id: 'b', duracionSesiones: 2 },
      { id: 'c', duracionSesiones: 1.5 }
    ])
    expect(bloques).toEqual([
      { subtemaIds: ['a'], ancho: 1 },
      { subtemaIds: ['b'], ancho: 2 },
      { subtemaIds: ['c'], ancho: 2 }
    ])
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
    const { asignaciones } = repartirBloques(bloques, slots)
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
    const { asignaciones, subtemasNoAsignadosIds } = repartirBloques(bloques, slots)
    expect(asignaciones).toEqual([])
    expect(subtemasNoAsignadosIds).toEqual(['a'])
  })

  // Regresión del bug real: con muchas franjas semanales (p. ej. 9/semana), avanzar
  // el cursor un nº fijo de slots podía coincidir con el nº de franjas por semana y
  // caer siempre en el mismo día, dejando jueves y viernes sin sesiones jamás. El
  // reparto secuencial (a ritmo natural) no salta nunca, así que no puede alias-earse.
  it('reparte el contenido entre todos los días de la semana con muchas franjas (no se queda enganchado en un solo día)', () => {
    const diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'] as const
    const franjas = diasSemana.flatMap(dia =>
      Array.from({ length: 2 }, (_, i) => ({ franjaId: `${dia}-${i}`, diaSemana: dia, horaInicio: `0${8 + i}:00` }))
    )
    // 10 franjas/semana durante 10 semanas ⇒ 100 slots disponibles.
    const slots = construirSlots(franjas, '2025-09-01', '2025-11-07', [])
    expect(slots.length).toBeGreaterThan(90)

    // 20 subtemas de una sesión cada uno: muchos menos que los slots disponibles.
    const bloques = Array.from({ length: 20 }, (_, i) => ({ subtemaIds: [`s${i}`], ancho: 1 }))
    const { asignaciones } = repartirBloques(bloques, slots)

    const diaSemanaDe = (fechaISO: string) => {
      const indice = new Date(`${fechaISO}T00:00:00Z`).getUTCDay()
      return ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][indice]
    }
    const diasUsados = new Set(asignaciones.map(a => diaSemanaDe(a.slot.fecha)))
    expect(diasUsados.has('jueves')).toBe(true)
    expect(diasUsados.has('viernes')).toBe(true)
    expect(diasUsados.size).toBeGreaterThan(2)
  })

  it('da clase a ritmo natural: usa todas las franjas de una semana antes de pasar a la siguiente, y deja el resto del curso libre al terminar el temario', () => {
    // Igual que Biología de 1º Bachillerato: 2 franjas/semana (miércoles y jueves).
    const franjas = [
      { franjaId: 'mie', diaSemana: 'miercoles' as const, horaInicio: '09:00' },
      { franjaId: 'jue', diaSemana: 'jueves' as const, horaInicio: '09:00' }
    ]
    // 10 semanas disponibles ⇒ 20 slots, pero solo se necesitan 8 sesiones.
    const slots = construirSlots(franjas, '2025-09-01', '2025-11-07', [])
    const bloques = Array.from({ length: 8 }, (_, i) => ({ subtemaIds: [`s${i}`], ancho: 1 }))
    const { asignaciones } = repartirBloques(bloques, slots)

    // Se usan exactamente los 8 primeros huecos cronológicos (sin saltos ni huecos
    // sueltos dentro de las 4 primeras semanas), y nada a partir de ahí.
    expect(asignaciones.map(a => a.slot.fecha)).toEqual(slots.slice(0, 8).map(s => s.fecha))
    for (const fecha of asignaciones.map(a => a.slot.fecha)) {
      expect(fecha < '2025-10-01').toBe(true) // dentro de las primeras 4 semanas
    }
  })
})
