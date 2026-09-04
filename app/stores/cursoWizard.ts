import { defineStore } from 'pinia'
import { moverEnLista } from '../utils/listas'
import type {
  AsignaturaWizard,
  DiaSemana,
  ElementoTemarioWizard,
  FestivoWizard,
  GrupoWizard,
  HorarioTipoWizard,
  PeriodoWizard,
  TemaWizard,
  TipoElementoSuelto
} from './cursoWizard.types'

const COLORES_GRUPO = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899']

// La duración se introduce en bloques de 0.5 sesiones (0.5, 1, 1.5, 2...).
function esDuracionValida(duracion: number) {
  return duracion > 0 && Math.round(duracion * 2) === duracion * 2
}

function esTema(elemento: ElementoTemarioWizard): elemento is TemaWizard {
  return elemento.clase === 'tema'
}

// Dos horarios tipo "se solapan" en el tiempo si, tratando una vigencia
// vacía como "todo el curso", sus rangos de fechas se cruzan. Sin esto, dos
// franjas del mismo día y hora pero de horarios tipo que nunca coinciden en
// el calendario real (ej. "Reducido" en septiembre vs. "Normal" en octubre)
// se marcarían como conflicto sin serlo.
function vigenciasSolapan(a: HorarioTipoWizard, b: HorarioTipoWizard) {
  const aIni = a.vigenciaInicio || '0001-01-01'
  const aFin = a.vigenciaFin || '9999-12-31'
  const bIni = b.vigenciaInicio || '0001-01-01'
  const bFin = b.vigenciaFin || '9999-12-31'
  return aIni <= bFin && bIni <= aFin
}

export const useCursoWizardStore = defineStore('curso-wizard', {
  state: () => ({
    curso: {
      nombre: '',
      fechaInicio: '',
      fechaFin: ''
    },
    festivos: [] as FestivoWizard[],
    horariosTipo: [] as HorarioTipoWizard[],
    asignaturas: [] as AsignaturaWizard[],
    grupos: [] as GrupoWizard[]
  }),

  getters: {
    cursoValido: state =>
      Boolean(state.curso.nombre && state.curso.fechaInicio && state.curso.fechaFin)
      && state.curso.fechaFin > state.curso.fechaInicio
      && state.horariosTipo.every(ht =>
        Boolean(ht.nombre)
        && ht.periodos.length > 0
        && ht.periodos.every(periodo => periodo.horaInicio && periodo.horaFin && periodo.horaFin > periodo.horaInicio)
        // La vigencia es opcional, pero si se rellena un extremo hay que rellenar el otro.
        && Boolean(ht.vigenciaInicio) === Boolean(ht.vigenciaFin)
        && (!ht.vigenciaInicio || ht.vigenciaFin > ht.vigenciaInicio)
      )
      // dias_no_lectivos exige fecha_fin >= fecha_inicio en base de datos:
      // si no se valida aquí, el error solo aparece al guardar. La fecha de
      // fin es opcional: vacía significa "festivo de un solo día" (se
      // guarda igual a la de inicio).
      && state.festivos.every(festivo =>
        Boolean(festivo.fechaInicio) && (!festivo.fechaFin || festivo.fechaFin >= festivo.fechaInicio)
      ),

    asignaturasValidas: state =>
      state.asignaturas.length > 0
      && state.asignaturas.every(asignatura =>
        Boolean(asignatura.nombre)
        && asignatura.elementos.every((elemento) => {
          if (elemento.clase === 'tema') {
            return Boolean(elemento.nombre)
              && elemento.subtemas.every(subtema => Boolean(subtema.nombre) && esDuracionValida(subtema.duracionSesiones))
          }
          return Boolean(elemento.nombre) && esDuracionValida(elemento.duracionSesiones)
        })
      ),

    // Las franjas horarias son opcionales: un profesor puede no conocer
    // todavía el horario definitivo del curso y añadirlo más tarde
    // editando el grupo.
    gruposValidos: state =>
      state.grupos.length > 0
      && state.grupos.every(grupo =>
        Boolean(grupo.nombre)
        && grupo.asignaturas.length > 0
        && grupo.asignaturas.every(ga =>
          ga.franjas.every(franja => Boolean(franja.periodoClienteId))
        )
      ),

    haySolape: (state) => {
      const periodosPorClienteId = new Map<string, PeriodoWizard>()
      const horarioTipoPorPeriodoClienteId = new Map<string, HorarioTipoWizard>()
      for (const ht of state.horariosTipo) {
        for (const periodo of ht.periodos) {
          periodosPorClienteId.set(periodo.clienteId, periodo)
          horarioTipoPorPeriodoClienteId.set(periodo.clienteId, ht)
        }
      }

      const franjas = state.grupos.flatMap(grupo =>
        grupo.asignaturas.flatMap(ga => ga.franjas)
      )
        .map(franja => ({
          diaSemana: franja.diaSemana,
          periodo: periodosPorClienteId.get(franja.periodoClienteId),
          horarioTipo: horarioTipoPorPeriodoClienteId.get(franja.periodoClienteId)
        }))
        .filter((franja): franja is { diaSemana: DiaSemana, periodo: PeriodoWizard, horarioTipo: HorarioTipoWizard } =>
          Boolean(franja.periodo?.horaInicio && franja.periodo?.horaFin && franja.horarioTipo)
        )

      for (let i = 0; i < franjas.length; i++) {
        for (let j = i + 1; j < franjas.length; j++) {
          const a = franjas[i]!
          const b = franjas[j]!
          if (
            a.diaSemana === b.diaSemana
            && a.periodo.horaInicio < b.periodo.horaFin
            && b.periodo.horaInicio < a.periodo.horaFin
            && vigenciasSolapan(a.horarioTipo, b.horarioTipo)
          ) {
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
      this.horariosTipo = []
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

    agregarHorarioTipo() {
      this.horariosTipo.push({
        clienteId: crypto.randomUUID(),
        nombre: '',
        vigenciaInicio: '',
        vigenciaFin: '',
        periodos: []
      })
    },

    // Copia las franjas horarias de un horario tipo a uno nuevo, sin
    // vigencia (para que el profesor solo tenga que poner las fechas):
    // pensado para el caso de "Reducido en septiembre y en junio", donde
    // hay que repetir el mismo patrón de horas en dos vigencias distintas.
    duplicarHorarioTipo(clienteId: string) {
      const original = this.horariosTipo.find(ht => ht.clienteId === clienteId)
      if (!original) return
      this.horariosTipo.push({
        clienteId: crypto.randomUUID(),
        nombre: `${original.nombre} (copia)`,
        vigenciaInicio: '',
        vigenciaFin: '',
        periodos: original.periodos.map(periodo => ({
          clienteId: crypto.randomUUID(),
          horaInicio: periodo.horaInicio,
          horaFin: periodo.horaFin
        }))
      })
    },

    eliminarHorarioTipo(clienteId: string) {
      const periodoIds = new Set(
        this.horariosTipo.find(ht => ht.clienteId === clienteId)?.periodos.map(p => p.clienteId) ?? []
      )
      this.horariosTipo = this.horariosTipo.filter(ht => ht.clienteId !== clienteId)
      for (const grupo of this.grupos) {
        for (const ga of grupo.asignaturas) {
          ga.franjas = ga.franjas.filter(franja => !periodoIds.has(franja.periodoClienteId))
        }
      }
    },

    agregarPeriodo(horarioTipoClienteId: string) {
      const ht = this.horariosTipo.find(h => h.clienteId === horarioTipoClienteId)
      ht?.periodos.push({ clienteId: crypto.randomUUID(), horaInicio: '', horaFin: '' })
    },

    eliminarPeriodo(horarioTipoClienteId: string, periodoClienteId: string) {
      const ht = this.horariosTipo.find(h => h.clienteId === horarioTipoClienteId)
      if (!ht) return
      ht.periodos = ht.periodos.filter(periodo => periodo.clienteId !== periodoClienteId)
      for (const grupo of this.grupos) {
        for (const ga of grupo.asignaturas) {
          ga.franjas = ga.franjas.filter(franja => franja.periodoClienteId !== periodoClienteId)
        }
      }
    },

    agregarAsignatura() {
      this.asignaturas.push({
        clienteId: crypto.randomUUID(),
        nombre: '',
        elementos: []
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
      asignatura?.elementos.push({
        clienteId: crypto.randomUUID(),
        clase: 'tema',
        nombre: '',
        subtemas: []
      })
    },

    agregarElementoSuelto(asignaturaClienteId: string, tipo: TipoElementoSuelto) {
      const asignatura = this.asignaturas.find(a => a.clienteId === asignaturaClienteId)
      asignatura?.elementos.push({
        clienteId: crypto.randomUUID(),
        clase: 'suelto',
        tipo,
        nombre: '',
        duracionSesiones: 1
      })
    },

    eliminarElemento(asignaturaClienteId: string, elementoClienteId: string) {
      const asignatura = this.asignaturas.find(a => a.clienteId === asignaturaClienteId)
      if (!asignatura) return
      asignatura.elementos = asignatura.elementos.filter(elemento => elemento.clienteId !== elementoClienteId)
    },

    moverElemento(asignaturaClienteId: string, elementoClienteId: string, direccion: 'arriba' | 'abajo') {
      const asignatura = this.asignaturas.find(a => a.clienteId === asignaturaClienteId)
      if (!asignatura) return
      moverEnLista(asignatura.elementos, elementoClienteId, direccion)
    },

    agregarSubtema(asignaturaClienteId: string, temaClienteId: string) {
      const asignatura = this.asignaturas.find(a => a.clienteId === asignaturaClienteId)
      const tema = asignatura?.elementos.find((e): e is TemaWizard => e.clienteId === temaClienteId && esTema(e))
      tema?.subtemas.push({
        clienteId: crypto.randomUUID(),
        nombre: '',
        duracionSesiones: 1
      })
    },

    eliminarSubtema(asignaturaClienteId: string, temaClienteId: string, subtemaClienteId: string) {
      const asignatura = this.asignaturas.find(a => a.clienteId === asignaturaClienteId)
      const tema = asignatura?.elementos.find((e): e is TemaWizard => e.clienteId === temaClienteId && esTema(e))
      if (!tema) return
      tema.subtemas = tema.subtemas.filter(subtema => subtema.clienteId !== subtemaClienteId)
    },

    moverSubtema(asignaturaClienteId: string, temaClienteId: string, subtemaClienteId: string, direccion: 'arriba' | 'abajo') {
      const asignatura = this.asignaturas.find(a => a.clienteId === asignaturaClienteId)
      const tema = asignatura?.elementos.find((e): e is TemaWizard => e.clienteId === temaClienteId && esTema(e))
      if (!tema) return
      moverEnLista(tema.subtemas, subtemaClienteId, direccion)
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
      if (!grupo || !ga) return
      const primerPeriodo = this.horariosTipo.flatMap(ht => ht.periodos)[0]
      ga.franjas.push({
        clienteId: crypto.randomUUID(),
        diaSemana: 'lunes',
        periodoClienteId: primerPeriodo?.clienteId ?? ''
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
