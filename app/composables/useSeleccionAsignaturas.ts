import type { DiaSemana } from '~/stores/cursoWizard.types'

export const OPCIONES_DIA = [
  { label: 'Lunes', value: 'lunes' },
  { label: 'Martes', value: 'martes' },
  { label: 'Miércoles', value: 'miercoles' },
  { label: 'Jueves', value: 'jueves' },
  { label: 'Viernes', value: 'viernes' },
  { label: 'Sábado', value: 'sabado' },
  { label: 'Domingo', value: 'domingo' }
]

export interface FranjaSeleccion {
  clienteId: string
  diaSemana: DiaSemana
  periodoId: string
}

export interface SeleccionAsignatura {
  asignaturaId: string
  franjas: FranjaSeleccion[]
}

interface PeriodoDisponible {
  id: string
  horario_tipo_id: string
  hora_inicio: string
  hora_fin: string
}

interface HorarioTipoDisponible {
  id: string
  nombre: string
  vigencias?: { fecha_inicio: string, fecha_fin: string }[] | null
}

const SIN_LIMITE_INICIO = '0001-01-01'
const SIN_LIMITE_FIN = '9999-12-31'

// Dos horarios tipo "se solapan" en el tiempo si, tratando un horario sin
// tramos de vigencia como "todo el curso", alguno de sus tramos se cruza.
// Sin esto, dos franjas del mismo día y hora pero de horarios tipo que nunca
// coinciden en el calendario real (ej. "Reducido" en septiembre vs. "Normal"
// en octubre) se marcarían como conflicto sin serlo.
function vigenciasSolapan(a: HorarioTipoDisponible | undefined, b: HorarioTipoDisponible | undefined) {
  const tramosA = a?.vigencias?.length ? a.vigencias : [{ fecha_inicio: SIN_LIMITE_INICIO, fecha_fin: SIN_LIMITE_FIN }]
  const tramosB = b?.vigencias?.length ? b.vigencias : [{ fecha_inicio: SIN_LIMITE_INICIO, fecha_fin: SIN_LIMITE_FIN }]
  return tramosA.some(ta => tramosB.some(tb => ta.fecha_inicio <= tb.fecha_fin && tb.fecha_inicio <= ta.fecha_fin))
}

// Estado y validación compartidos por las pantallas de creación y edición de
// grupo: qué asignaturas cursa y en qué día/franja horaria de cada una. Los
// períodos ofrecidos son los de todos los horarios tipo del curso (cada uno
// puede tener su propia vigencia, ej. "Reducido" solo en septiembre y
// junio), etiquetados con el nombre de su horario tipo para distinguirlos.
export function useSeleccionAsignaturas(
  periodos: Ref<PeriodoDisponible[] | null | undefined>,
  horariosTipo: Ref<HorarioTipoDisponible[] | null | undefined>,
  seleccionInicial: SeleccionAsignatura[] = []
) {
  const seleccion = ref<SeleccionAsignatura[]>(seleccionInicial)

  function seleccionDe(asignaturaId: string) {
    return seleccion.value.find(s => s.asignaturaId === asignaturaId)
  }

  function alternarAsignatura(asignaturaId: string) {
    const existente = seleccionDe(asignaturaId)
    if (existente) {
      seleccion.value = seleccion.value.filter(s => s.asignaturaId !== asignaturaId)
    } else {
      seleccion.value.push({ asignaturaId, franjas: [] })
    }
  }

  const opcionesPeriodo = computed(() =>
    (periodos.value ?? []).map((periodo) => {
      const nombreHorario = horariosTipo.value?.find(ht => ht.id === periodo.horario_tipo_id)?.nombre
      const prefijo = nombreHorario ? `${nombreHorario}: ` : ''
      return {
        label: `${prefijo}${periodo.hora_inicio}–${periodo.hora_fin}`,
        value: periodo.id
      }
    })
  )

  function agregarFranja(asignaturaId: string) {
    seleccionDe(asignaturaId)?.franjas.push({
      clienteId: crypto.randomUUID(),
      diaSemana: 'lunes',
      periodoId: opcionesPeriodo.value[0]?.value ?? ''
    })
  }

  function eliminarFranja(asignaturaId: string, franjaClienteId: string) {
    const s = seleccionDe(asignaturaId)
    if (!s) return
    s.franjas = s.franjas.filter(franja => franja.clienteId !== franjaClienteId)
  }

  const haySolape = computed(() => {
    const periodoPorId = new Map((periodos.value ?? []).map(p => [p.id, p]))

    const franjas = seleccion.value
      .flatMap(s => s.franjas)
      .map(franja => ({ diaSemana: franja.diaSemana, periodo: periodoPorId.get(franja.periodoId) }))
      .filter((f): f is { diaSemana: DiaSemana, periodo: PeriodoDisponible } => Boolean(f.periodo))

    for (let i = 0; i < franjas.length; i++) {
      for (let j = i + 1; j < franjas.length; j++) {
        const a = franjas[i]!
        const b = franjas[j]!
        const horarioTipoA = horariosTipo.value?.find(ht => ht.id === a.periodo.horario_tipo_id)
        const horarioTipoB = horariosTipo.value?.find(ht => ht.id === b.periodo.horario_tipo_id)
        if (
          a.diaSemana === b.diaSemana
          && a.periodo.hora_inicio < b.periodo.hora_fin
          && b.periodo.hora_inicio < a.periodo.hora_fin
          && vigenciasSolapan(horarioTipoA, horarioTipoB)
        ) {
          return true
        }
      }
    }
    return false
  })

  return { seleccion, seleccionDe, alternarAsignatura, agregarFranja, eliminarFranja, opcionesPeriodo, haySolape }
}
