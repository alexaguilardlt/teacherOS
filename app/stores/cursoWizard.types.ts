export type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'

// Los elementos sueltos no pertenecen a ningún tema: se reparten igual que
// un subtema de contenido, pero con nombre y duración propios.
export type TipoElementoSuelto = 'repaso' | 'examen' | 'exposicion_oral' | 'otro'

export interface SubtemaWizard {
  clienteId: string
  nombre: string
  // En bloques de 0.5 sesiones (0.5, 1, 1.5, 2...).
  duracionSesiones: number
}

export interface TemaWizard {
  clienteId: string
  clase: 'tema'
  nombre: string
  subtemas: SubtemaWizard[]
  // Solo se usa si no se añade ningún punto del tema: permite repartir el
  // tema entero en X sesiones sin tener que desglosarlo en subtemas.
  duracionSesiones: number
}

export interface ElementoSueltoWizard {
  clienteId: string
  clase: 'suelto'
  tipo: TipoElementoSuelto
  nombre: string
  duracionSesiones: number
}

export type ElementoTemarioWizard = TemaWizard | ElementoSueltoWizard

export interface AsignaturaWizard {
  clienteId: string
  nombre: string
  // Secuencia única y ordenada: temas (con sus subtemas de contenido) y
  // elementos sueltos (repaso, examen, exposición oral, otro) se pueden
  // intercalar libremente.
  elementos: ElementoTemarioWizard[]
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

export interface VigenciaWizard {
  clienteId: string
  fechaInicio: string
  fechaFin: string
}

export interface HorarioTipoWizard {
  clienteId: string
  nombre: string
  // Tramos de vigencia opcionales (ej. un horario "Reducido" vigente en
  // dos tramos: septiembre y junio). Sin ningún tramo significa "todo el
  // curso".
  vigencias: VigenciaWizard[]
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
  asignaturas: GrupoAsignaturaWizard[]
}
