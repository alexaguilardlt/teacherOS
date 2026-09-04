<script setup lang="ts">
const store = useCursoWizardStore()
const user = useSupabaseUser()
const supabase = useSupabaseClient()

const guardando = ref(false)
const errorMessage = ref('')

const etiquetasDia: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo'
}

function nombreAsignatura(clienteId: string) {
  return store.asignaturas.find(asignatura => asignatura.clienteId === clienteId)?.nombre ?? ''
}

function etiquetaPeriodo(clienteId: string) {
  for (const ht of store.horariosTipo) {
    const periodo = ht.periodos.find(p => p.clienteId === clienteId)
    if (periodo) return `${ht.nombre}: ${periodo.horaInicio}–${periodo.horaFin}`
  }
  return ''
}

async function guardar() {
  if (!user.value) return

  guardando.value = true
  errorMessage.value = ''

  try {
    const { data: curso, error: errorCurso } = await supabase
      .from('cursos')
      .insert({
        profesor_id: user.value.sub,
        nombre: store.curso.nombre,
        fecha_inicio: store.curso.fechaInicio,
        fecha_fin: store.curso.fechaFin
      })
      .select('id')
      .single()
    if (errorCurso || !curso) throw errorCurso ?? new Error('curso')

    if (store.festivos.length) {
      const { error: errorFestivos } = await supabase
        .from('dias_no_lectivos')
        .insert(store.festivos.map(festivo => ({
          curso_id: curso.id,
          nombre: festivo.nombre || null,
          fecha_inicio: festivo.fechaInicio,
          fecha_fin: festivo.fechaFin || festivo.fechaInicio
        })))
      if (errorFestivos) throw errorFestivos
    }

    const periodoIdPorClienteId = new Map<string, string>()

    for (const horarioTipo of store.horariosTipo) {
      const { data: horarioTipoInsertado, error: errorHorarioTipo } = await supabase
        .from('horarios_tipo')
        .insert({
          curso_id: curso.id,
          nombre: horarioTipo.nombre
        })
        .select('id')
        .single()
      if (errorHorarioTipo || !horarioTipoInsertado) throw errorHorarioTipo ?? new Error('horario_tipo')

      if (horarioTipo.vigencias.length) {
        const { error: errorVigencias } = await supabase
          .from('horario_tipo_vigencias')
          .insert(horarioTipo.vigencias.map(vigencia => ({
            horario_tipo_id: horarioTipoInsertado.id,
            fecha_inicio: vigencia.fechaInicio,
            fecha_fin: vigencia.fechaFin
          })))
        if (errorVigencias) throw errorVigencias
      }

      for (const [periodoIndex, periodo] of horarioTipo.periodos.entries()) {
        const { data: periodoInsertado, error: errorPeriodo } = await supabase
          .from('periodos_horarios')
          .insert({
            horario_tipo_id: horarioTipoInsertado.id,
            hora_inicio: periodo.horaInicio,
            hora_fin: periodo.horaFin,
            orden: periodoIndex
          })
          .select('id')
          .single()
        if (errorPeriodo || !periodoInsertado) throw errorPeriodo ?? new Error('periodo')
        periodoIdPorClienteId.set(periodo.clienteId, periodoInsertado.id)
      }
    }

    const asignaturaIdPorClienteId = new Map<string, string>()

    for (const asignatura of store.asignaturas) {
      const { data: asignaturaInsertada, error: errorAsignatura } = await supabase
        .from('asignaturas')
        .insert({ profesor_id: user.value.sub, nombre: asignatura.nombre })
        .select('id')
        .single()
      if (errorAsignatura || !asignaturaInsertada) throw errorAsignatura ?? new Error('asignatura')
      asignaturaIdPorClienteId.set(asignatura.clienteId, asignaturaInsertada.id)

      // orden es una secuencia única por asignatura: temas (con sus
      // subtemas de contenido) y elementos sueltos (repaso, examen...) se
      // intercalan en el mismo orden en que se añadieron. El tema consume
      // su propia posición antes de que empiecen sus subtemas, para que la
      // secuencia (temas.orden + subtemas.orden) se pueda reconstruir sin
      // ambigüedad al editar la asignatura más tarde.
      let orden = 0
      for (const elemento of asignatura.elementos) {
        if (elemento.clase === 'tema') {
          const { data: temaInsertado, error: errorTema } = await supabase
            .from('temas')
            .insert({ asignatura_id: asignaturaInsertada.id, nombre: elemento.nombre, orden })
            .select('id')
            .single()
          if (errorTema || !temaInsertado) throw errorTema ?? new Error('tema')
          orden += 1

          if (elemento.subtemas.length) {
            const { error: errorSubtemas } = await supabase
              .from('subtemas')
              .insert(elemento.subtemas.map((subtema, i) => ({
                asignatura_id: asignaturaInsertada.id,
                tema_id: temaInsertado.id,
                nombre: subtema.nombre,
                tipo: 'contenido' as const,
                duracion_sesiones: subtema.duracionSesiones,
                orden: orden + i
              })))
            if (errorSubtemas) throw errorSubtemas
            orden += elemento.subtemas.length
          } else {
            // Tema sin puntos: se reparte como un único bloque con el
            // nombre y la duración del propio tema.
            const { error: errorSubtemaTema } = await supabase
              .from('subtemas')
              .insert({
                asignatura_id: asignaturaInsertada.id,
                tema_id: temaInsertado.id,
                nombre: elemento.nombre,
                tipo: 'contenido' as const,
                duracion_sesiones: elemento.duracionSesiones,
                orden
              })
            if (errorSubtemaTema) throw errorSubtemaTema
            orden += 1
          }
        } else {
          const { error: errorSuelto } = await supabase
            .from('subtemas')
            .insert({
              asignatura_id: asignaturaInsertada.id,
              tema_id: null,
              nombre: elemento.nombre,
              tipo: elemento.tipo,
              duracion_sesiones: elemento.duracionSesiones,
              orden
            })
          if (errorSuelto) throw errorSuelto
          orden += 1
        }
      }
    }

    for (const grupo of store.grupos) {
      const { data: grupoInsertado, error: errorGrupo } = await supabase
        .from('grupos')
        .insert({
          profesor_id: user.value.sub,
          curso_id: curso.id,
          nombre: grupo.nombre,
          color: grupo.color
        })
        .select('id')
        .single()
      if (errorGrupo || !grupoInsertado) throw errorGrupo ?? new Error('grupo')

      for (const ga of grupo.asignaturas) {
        const asignaturaId = asignaturaIdPorClienteId.get(ga.asignaturaClienteId)
        if (!asignaturaId) continue

        const { data: grupoAsignaturaInsertado, error: errorGrupoAsignatura } = await supabase
          .from('grupo_asignaturas')
          .insert({ grupo_id: grupoInsertado.id, asignatura_id: asignaturaId })
          .select('id')
          .single()
        if (errorGrupoAsignatura || !grupoAsignaturaInsertado) throw errorGrupoAsignatura ?? new Error('grupo_asignatura')

        if (ga.franjas.length) {
          const { error: errorFranjas } = await supabase
            .from('franjas_horarias')
            .insert(ga.franjas.map(franja => ({
              grupo_asignatura_id: grupoAsignaturaInsertado.id,
              dia_semana: franja.diaSemana,
              periodo_id: periodoIdPorClienteId.get(franja.periodoClienteId)!
            })))
          if (errorFranjas) throw errorFranjas
        }
      }
    }

    store.reset()
    await navigateTo('/dashboard')
  } catch (e) {
    errorMessage.value = (e as { message?: string })?.message || 'No se ha podido guardar el curso. Inténtalo de nuevo.'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <UContainer class="py-10">
    <CursoWizardSteps :paso="4" />

    <UCard class="mb-6">
      <template #header>
        <h2 class="font-semibold">
          Curso
        </h2>
      </template>
      <p>{{ store.curso.nombre }}</p>
      <p class="text-sm text-muted">
        {{ store.curso.fechaInicio }} – {{ store.curso.fechaFin }}
      </p>

      <div
        v-if="store.festivos.length"
        class="mt-4"
      >
        <p class="mb-1 text-sm font-medium">
          Festivos
        </p>
        <ul class="text-sm text-muted">
          <li
            v-for="festivo in store.festivos"
            :key="festivo.clienteId"
          >
            {{ festivo.nombre || 'Sin nombre' }} ({{ festivo.fechaFin && festivo.fechaFin !== festivo.fechaInicio ? `${festivo.fechaInicio} – ${festivo.fechaFin}` : festivo.fechaInicio }})
          </li>
        </ul>
      </div>

      <div
        v-for="horarioTipo in store.horariosTipo"
        :key="horarioTipo.clienteId"
        class="mt-4"
      >
        <p class="mb-1 text-sm font-medium">
          {{ horarioTipo.nombre }}
          <span
            v-if="horarioTipo.vigencias.length"
            class="text-xs font-normal text-muted"
          >
            ({{ horarioTipo.vigencias.map(v => `${v.fechaInicio} – ${v.fechaFin}`).join(', ') }})
          </span>
        </p>
        <ul class="text-sm text-muted">
          <li
            v-for="periodo in horarioTipo.periodos"
            :key="periodo.clienteId"
          >
            {{ periodo.horaInicio }}–{{ periodo.horaFin }}
          </li>
        </ul>
      </div>
    </UCard>

    <UCard class="mb-6">
      <template #header>
        <h2 class="font-semibold">
          Asignaturas
        </h2>
      </template>

      <div class="flex flex-col gap-4">
        <div
          v-for="asignatura in store.asignaturas"
          :key="asignatura.clienteId"
        >
          <p class="font-medium">
            {{ asignatura.nombre }}
          </p>
          <ul class="mt-1 flex flex-col gap-1 pl-4 text-sm text-muted">
            <li
              v-for="elemento in asignatura.elementos"
              :key="elemento.clienteId"
            >
              <template v-if="elemento.clase === 'tema'">
                {{ elemento.nombre }}
                <span
                  v-if="elemento.subtemas.length"
                  class="text-xs"
                >
                  ({{ elemento.subtemas.map(s => `${s.nombre} · ${s.duracionSesiones} ses.`).join(', ') }})
                </span>
                <span
                  v-else
                  class="text-xs"
                >
                  ({{ elemento.duracionSesiones }} ses.)
                </span>
              </template>
              <template v-else>
                {{ elemento.nombre }}
                <span class="text-xs">({{ elemento.duracionSesiones }} ses.)</span>
              </template>
            </li>
          </ul>
        </div>
      </div>
    </UCard>

    <UCard class="mb-6">
      <template #header>
        <h2 class="font-semibold">
          Grupos
        </h2>
      </template>

      <div class="flex flex-col gap-4">
        <div
          v-for="grupo in store.grupos"
          :key="grupo.clienteId"
        >
          <p class="flex items-center gap-2 font-medium">
            <span
              class="size-2.5 rounded-full"
              :style="{ backgroundColor: grupo.color }"
            />
            {{ grupo.nombre }}
          </p>
          <ul class="mt-1 flex flex-col gap-1 pl-4 text-sm text-muted">
            <li
              v-for="ga in grupo.asignaturas"
              :key="ga.asignaturaClienteId"
            >
              {{ nombreAsignatura(ga.asignaturaClienteId) }} —
              {{ ga.franjas.map(f => `${etiquetasDia[f.diaSemana]} ${etiquetaPeriodo(f.periodoClienteId)}`).join(', ') }}
            </li>
          </ul>
        </div>
      </div>
    </UCard>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
      class="mb-6"
    />

    <div class="flex justify-between">
      <UButton
        to="/curso/nuevo/grupos"
        color="neutral"
        variant="ghost"
        leading-icon="i-lucide-arrow-left"
        :disabled="guardando"
      >
        Anterior
      </UButton>

      <UButton
        :loading="guardando"
        @click="guardar"
      >
        Guardar curso
      </UButton>
    </div>
  </UContainer>
</template>
