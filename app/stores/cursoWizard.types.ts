export type DificultadSubtema = 'baja' | 'media' | 'alta'
export type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'

export interface SubtemaWizard {
  clienteId: string
  nombre: string
  dificultad: DificultadSubtema
}

export interface TemaWizard {
  clienteId: string
  nombre: string
  subtemas: SubtemaWizard[]
}

export interface AsignaturaWizard {
  clienteId: string
  nombre: string
  temas: TemaWizard[]
}

export interface FestivoWizard {
  clienteId: string
  nombre: string
  fechaInicio: string
  fechaFin: string
}

export interface PeriodoWizard {
  clienteId: string
  horaInicio: string
  horaFin: string
}

export interface HorarioTipoWizard {
  clienteId: string
  nombre: string
  periodos: PeriodoWizard[]
}

export interface FranjaWizard {
  clienteId: string
  diaSemana: DiaSemana
  periodoClienteId: string
}

export interface GrupoAsignaturaWizard {
  asignaturaClienteId: string
  franjas: FranjaWizard[]
}

export interface GrupoWizard {
  clienteId: string
  nombre: string
  color: string
  horarioTipoClienteId: string
  asignaturas: GrupoAsignaturaWizard[]
}
