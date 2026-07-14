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

// Estado y validación compartidos por las pantallas de creación y edición de
// grupo: qué asignaturas cursa y en qué día/franja horaria de cada una.
export function useSeleccionAsignaturas(
  horarioTipoId: Ref<string>,
  periodos: Ref<PeriodoDisponible[] | null | undefined>,
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
    (periodos.value ?? [])
      .filter(periodo => periodo.horario_tipo_id === horarioTipoId.value)
      .map(periodo => ({
        label: `${periodo.hora_inicio}–${periodo.hora_fin}`,
        value: periodo.id
      }))
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
    const franjas = seleccion.value
      .flatMap(s => s.franjas)
      .filter(franja => franja.periodoId)

    for (let i = 0; i < franjas.length; i++) {
      for (let j = i + 1; j < franjas.length; j++) {
        const a = franjas[i]!
        const b = franjas[j]!
        if (a.diaSemana === b.diaSemana && a.periodoId === b.periodoId) {
          return true
        }
      }
    }
    return false
  })

  return { seleccion, seleccionDe, alternarAsignatura, agregarFranja, eliminarFranja, opcionesPeriodo, haySolape }
}
