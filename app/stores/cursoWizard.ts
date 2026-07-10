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

export interface FranjaWizard {
  clienteId: string
  diaSemana: DiaSemana
  horaInicio: string
  horaFin: string
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

const COLORES_GRUPO = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899']

export const useCursoWizardStore = defineStore('curso-wizard', {
  state: () => ({
    curso: {
      nombre: '',
      fechaInicio: '',
      fechaFin: ''
    },
    festivos: [] as FestivoWizard[],
    asignaturas: [] as AsignaturaWizard[],
    grupos: [] as GrupoWizard[]
  }),

  getters: {
    cursoValido: state =>
      Boolean(state.curso.nombre && state.curso.fechaInicio && state.curso.fechaFin)
      && state.curso.fechaFin > state.curso.fechaInicio,

    asignaturasValidas: state =>
      state.asignaturas.length > 0
      && state.asignaturas.every(asignatura => Boolean(asignatura.nombre)),

    gruposValidos: state =>
      state.grupos.length > 0
      && state.grupos.every(grupo =>
        Boolean(grupo.nombre)
        && grupo.asignaturas.length > 0
        && grupo.asignaturas.every(ga =>
          ga.franjas.length > 0
          && ga.franjas.every(franja => franja.horaFin > franja.horaInicio)
        )
      ),

    haySolape: (state) => {
      const franjas = state.grupos.flatMap(grupo =>
        grupo.asignaturas.flatMap(ga => ga.franjas)
      ).filter(franja => franja.horaInicio && franja.horaFin)

      for (let i = 0; i < franjas.length; i++) {
        for (let j = i + 1; j < franjas.length; j++) {
          const a = franjas[i]!
          const b = franjas[j]!
          if (a.diaSemana === b.diaSemana && a.horaInicio < b.horaFin && b.horaInicio < a.horaFin) {
            return true
          }
        }
      }
      return false
    }
  },

  actions: {
    reset() {
      this.curso = { nombre: '', fechaInicio: '', fechaFin: '' }
      this.festivos = []
      this.asignaturas = []
      this.grupos = []
    },

    agregarFestivo() {
      this.festivos.push({
        clienteId: crypto.randomUUID(),
        nombre: '',
        fechaInicio: '',
        fechaFin: ''
      })
    },

    eliminarFestivo(clienteId: string) {
      this.festivos = this.festivos.filter(festivo => festivo.clienteId !== clienteId)
    },

    agregarAsignatura() {
      this.asignaturas.push({
        clienteId: crypto.randomUUID(),
        nombre: '',
        temas: []
      })
    },

    eliminarAsignatura(clienteId: string) {
      this.asignaturas = this.asignaturas.filter(asignatura => asignatura.clienteId !== clienteId)
      for (const grupo of this.grupos) {
        grupo.asignaturas = grupo.asignaturas.filter(ga => ga.asignaturaClienteId !== clienteId)
      }
    },

    agregarTema(asignaturaClienteId: string) {
      const asignatura = this.asignaturas.find(a => a.clienteId === asignaturaClienteId)
      asignatura?.temas.push({
        clienteId: crypto.randomUUID(),
        nombre: '',
        subtemas: []
      })
    },

    eliminarTema(asignaturaClienteId: string, temaClienteId: string) {
      const asignatura = this.asignaturas.find(a => a.clienteId === asignaturaClienteId)
      if (!asignatura) return
      asignatura.temas = asignatura.temas.filter(tema => tema.clienteId !== temaClienteId)
    },

    agregarSubtema(asignaturaClienteId: string, temaClienteId: string) {
      const asignatura = this.asignaturas.find(a => a.clienteId === asignaturaClienteId)
      const tema = asignatura?.temas.find(t => t.clienteId === temaClienteId)
      tema?.subtemas.push({
        clienteId: crypto.randomUUID(),
        nombre: '',
        dificultad: 'media'
      })
    },

    eliminarSubtema(asignaturaClienteId: string, temaClienteId: string, subtemaClienteId: string) {
      const asignatura = this.asignaturas.find(a => a.clienteId === asignaturaClienteId)
      const tema = asignatura?.temas.find(t => t.clienteId === temaClienteId)
      if (!tema) return
      tema.subtemas = tema.subtemas.filter(subtema => subtema.clienteId !== subtemaClienteId)
    },

    agregarGrupo() {
      const color = COLORES_GRUPO[this.grupos.length % COLORES_GRUPO.length]!
      this.grupos.push({
        clienteId: crypto.randomUUID(),
        nombre: '',
        color,
        asignaturas: []
      })
    },

    eliminarGrupo(clienteId: string) {
      this.grupos = this.grupos.filter(grupo => grupo.clienteId !== clienteId)
    },

    alternarAsignaturaEnGrupo(grupoClienteId: string, asignaturaClienteId: string) {
      const grupo = this.grupos.find(g => g.clienteId === grupoClienteId)
      if (!grupo) return
      const existente = grupo.asignaturas.find(ga => ga.asignaturaClienteId === asignaturaClienteId)
      if (existente) {
        grupo.asignaturas = grupo.asignaturas.filter(ga => ga.asignaturaClienteId !== asignaturaClienteId)
      } else {
        grupo.asignaturas.push({ asignaturaClienteId, franjas: [] })
      }
    },

    agregarFranja(grupoClienteId: string, asignaturaClienteId: string) {
      const grupo = this.grupos.find(g => g.clienteId === grupoClienteId)
      const ga = grupo?.asignaturas.find(a => a.asignaturaClienteId === asignaturaClienteId)
      ga?.franjas.push({
        clienteId: crypto.randomUUID(),
        diaSemana: 'lunes',
        horaInicio: '',
        horaFin: ''
      })
    },

    eliminarFranja(grupoClienteId: string, asignaturaClienteId: string, franjaClienteId: string) {
      const grupo = this.grupos.find(g => g.clienteId === grupoClienteId)
      const ga = grupo?.asignaturas.find(a => a.asignaturaClienteId === asignaturaClienteId)
      if (!ga) return
      ga.franjas = ga.franjas.filter(franja => franja.clienteId !== franjaClienteId)
    }
  }
})
