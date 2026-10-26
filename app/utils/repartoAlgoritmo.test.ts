import { describe, expect, it } from 'vitest'
import { agruparEnBloques, construirSlots, estaEnFestivo, recolocacionSinCambios, recolocarDesde, repartirBloques, subtemasYaDados, temarioAfectaAlReparto } from './repartoAlgoritmo'

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

describe('recolocarDesde', () => {
  // Lunes de octubre de 2026: 5, 12, 19 y 26.
  const franjas = [{ franjaId: 'f1', diaSemana: 'lunes' as const, horaInicio: '09:00' }]
  const sesiones = [
    { id: 'a', franjaId: 'f1', fecha: '2026-10-05', estado: 'confirmada' },
    { id: 'b', franjaId: 'f1', fecha: '2026-10-12', estado: 'confirmada' },
    { id: 'c', franjaId: 'f1', fecha: '2026-10-19', estado: 'confirmada' }
  ]
  const enlaces = [
    { sesionId: 'a', subtemaId: 's1' },
    { sesionId: 'b', subtemaId: 's2' },
    { sesionId: 'c', subtemaId: 's3' }
  ]
  const base = { sesiones, enlaces, franjas, fechaCorte: '2026-10-12', fechaFin: '2026-10-26', festivos: [] }

  it('al quitar un subtema pendiente, adelanta los siguientes sin dejar huecos vacíos', () => {
    const resultado = recolocarDesde({
      ...base,
      subtemasOrdenados: [{ id: 's1', duracionSesiones: 1 }, { id: 's3', duracionSesiones: 1 }]
    })

    expect(resultado.sesionesAEliminarIds).toEqual(['b', 'c'])
    expect(resultado.sesionesNuevas).toEqual([
      { franjaId: 'f1', fecha: '2026-10-12', subtemas: [{ subtemaId: 's3', fraccion: 1 }] }
    ])
    expect(resultado.subtemasNoAsignadosIds).toEqual([])
  })

  it('al alargar un subtema, empuja el resto hacia delante', () => {
    const resultado = recolocarDesde({
      ...base,
      subtemasOrdenados: [
        { id: 's1', duracionSesiones: 1 },
        { id: 's2', duracionSesiones: 2 },
        { id: 's3', duracionSesiones: 1 }
      ]
    })

    expect(resultado.sesionesNuevas.map(s => [s.fecha, s.subtemas[0]!.subtemaId])).toEqual([
      ['2026-10-12', 's2'],
      ['2026-10-19', 's2'],
      ['2026-10-26', 's3']
    ])
  })

  it('no toca las sesiones anteriores al corte ni las ya impartidas, y no reutiliza su hueco', () => {
    const resultado = recolocarDesde({
      ...base,
      sesiones: sesiones.map(s => s.id === 'b' ? { ...s, estado: 'impartida' } : s),
      subtemasOrdenados: [
        { id: 's1', duracionSesiones: 1 },
        { id: 's2', duracionSesiones: 1 },
        { id: 's3', duracionSesiones: 1 }
      ]
    })

    expect(resultado.sesionesAEliminarIds).toEqual(['c'])
    expect(resultado.sesionesNuevas.map(s => s.fecha)).toEqual(['2026-10-19'])
  })

  it('avisa de lo que ya no cabe antes del fin de curso', () => {
    const resultado = recolocarDesde({
      ...base,
      subtemasOrdenados: [
        { id: 's1', duracionSesiones: 1 },
        { id: 's2', duracionSesiones: 3 },
        { id: 's3', duracionSesiones: 1 }
      ]
    })

    expect(resultado.subtemasNoAsignadosIds).toEqual(['s3'])
  })
})

describe('subtemasYaDados', () => {
  it('devuelve los subtemas de sesiones pasadas o impartidas, con la primera fecha', () => {
    const sesiones = [
      { id: 'a', franjaId: 'f1', fecha: '2026-10-05', estado: 'confirmada' },
      { id: 'b', franjaId: 'f1', fecha: '2026-10-12', estado: 'confirmada' },
      { id: 'c', franjaId: 'f1', fecha: '2026-10-19', estado: 'impartida' },
      { id: 'd', franjaId: 'f1', fecha: '2026-10-26', estado: 'confirmada' }
    ]
    const enlaces = [
      { sesionId: 'a', subtemaId: 's1' },
      { sesionId: 'b', subtemaId: 's1' },
      { sesionId: 'c', subtemaId: 's2' },
      { sesionId: 'd', subtemaId: 's3' }
    ]

    const dados = subtemasYaDados(sesiones, enlaces, '2026-10-12')

    expect([...dados.entries()]).toEqual([['s1', '2026-10-05'], ['s2', '2026-10-19']])
  })
})

describe('temarioAfectaAlReparto', () => {
  const antes = [{ id: 's1', duracionSesiones: 1 }, { id: 's2', duracionSesiones: 0.5 }]

  it('no afecta si solo cambian los nombres', () => {
    expect(temarioAfectaAlReparto(antes, [...antes])).toBe(false)
  })

  it('afecta si cambia una duración, el orden o se quita o añade un subtema', () => {
    expect(temarioAfectaAlReparto(antes, [{ id: 's1', duracionSesiones: 2 }, antes[1]!])).toBe(true)
    expect(temarioAfectaAlReparto(antes, [antes[1]!, antes[0]!])).toBe(true)
    expect(temarioAfectaAlReparto(antes, [antes[0]!])).toBe(true)
    expect(temarioAfectaAlReparto(antes, [...antes, { id: 's3', duracionSesiones: 1 }])).toBe(true)
  })
})

describe('recolocarDesde con un subtema a medias', () => {
  it('mantiene las sesiones que le quedan a un subtema empezado antes del corte', () => {
    const resultado = recolocarDesde({
      subtemasOrdenados: [{ id: 's1', duracionSesiones: 2 }, { id: 's2', duracionSesiones: 1 }],
      sesiones: [
        { id: 'a', franjaId: 'f1', fecha: '2026-10-05', estado: 'confirmada' },
        { id: 'b', franjaId: 'f1', fecha: '2026-10-12', estado: 'confirmada' },
        { id: 'c', franjaId: 'f1', fecha: '2026-10-19', estado: 'confirmada' }
      ],
      enlaces: [
        { sesionId: 'a', subtemaId: 's1' },
        { sesionId: 'b', subtemaId: 's1' },
        { sesionId: 'c', subtemaId: 's2' }
      ],
      franjas: [{ franjaId: 'f1', diaSemana: 'lunes', horaInicio: '09:00' }],
      fechaCorte: '2026-10-12',
      fechaFin: '2026-10-26',
      festivos: []
    })

    expect(resultado.sesionesNuevas.map(s => [s.fecha, s.subtemas[0]!.subtemaId])).toEqual([
      ['2026-10-12', 's1'],
      ['2026-10-19', 's2']
    ])
  })
})

describe('recolocacionSinCambios', () => {
  const franjas = [{ franjaId: 'f1', diaSemana: 'lunes' as const, horaInicio: '09:00' }]
  const sesiones = [
    { id: 'a', franjaId: 'f1', fecha: '2026-10-12', estado: 'confirmada' },
    { id: 'b', franjaId: 'f1', fecha: '2026-10-19', estado: 'confirmada' }
  ]
  const enlaces = [{ sesionId: 'a', subtemaId: 's1' }, { sesionId: 'b', subtemaId: 's2' }]
  const subtemasOrdenados = [{ id: 's1', duracionSesiones: 1 }, { id: 's2', duracionSesiones: 1 }]
  const base = { subtemasOrdenados, sesiones, enlaces, franjas, fechaCorte: '2026-10-12', fechaFin: '2026-10-26' }

  it('detecta que recolocar con el mismo calendario no cambia nada', () => {
    const resultado = recolocarDesde({ ...base, festivos: [] })
    expect(recolocacionSinCambios(resultado, sesiones, enlaces)).toBe(true)
  })

  it('detecta que un festivo en un día con clase sí cambia algo', () => {
    const resultado = recolocarDesde({ ...base, festivos: [{ inicio: '2026-10-12', fin: '2026-10-12' }] })
    expect(recolocacionSinCambios(resultado, sesiones, enlaces)).toBe(false)
  })
})

describe('sesiones canceladas', () => {
  // Lunes de octubre de 2026: 5, 12, 19 y 26. El 12 se saltó (cancelada).
  const franjas = [{ franjaId: 'f1', diaSemana: 'lunes' as const, horaInicio: '09:00' }]
  const sesiones = [
    { id: 'a', franjaId: 'f1', fecha: '2026-10-05', estado: 'confirmada' },
    { id: 'b', franjaId: 'f1', fecha: '2026-10-12', estado: 'cancelada' },
    { id: 'c', franjaId: 'f1', fecha: '2026-10-19', estado: 'confirmada' }
  ]

  it('al recolocar, un día cancelado se queda como está y no vuelve a tener clase', () => {
    const resultado = recolocarDesde({
      subtemasOrdenados: [{ id: 's1', duracionSesiones: 1 }, { id: 's2', duracionSesiones: 1 }, { id: 's3', duracionSesiones: 1 }],
      sesiones,
      enlaces: [{ sesionId: 'a', subtemaId: 's1' }, { sesionId: 'c', subtemaId: 's2' }],
      franjas,
      fechaCorte: '2026-10-12',
      fechaFin: '2026-11-02',
      festivos: []
    })

    expect(resultado.sesionesAEliminarIds).toEqual(['c'])
    expect(resultado.sesionesNuevas.map(s => [s.fecha, s.subtemas[0]!.subtemaId])).toEqual([
      ['2026-10-19', 's2'],
      ['2026-10-26', 's3']
    ])
  })

  it('lo que tuviera enlazado una sesión cancelada no cuenta como dado', () => {
    const resultado = recolocarDesde({
      subtemasOrdenados: [{ id: 's1', duracionSesiones: 1 }, { id: 's2', duracionSesiones: 1 }],
      sesiones,
      enlaces: [{ sesionId: 'a', subtemaId: 's1' }, { sesionId: 'b', subtemaId: 's2' }],
      franjas,
      fechaCorte: '2026-10-19',
      fechaFin: '2026-10-26',
      festivos: []
    })

    expect(resultado.sesionesNuevas.map(s => [s.fecha, s.subtemas[0]!.subtemaId])).toEqual([['2026-10-19', 's2']])
    expect(subtemasYaDados(sesiones, [{ sesionId: 'b', subtemaId: 's2' }], '2026-10-19').has('s2')).toBe(false)
  })
})
