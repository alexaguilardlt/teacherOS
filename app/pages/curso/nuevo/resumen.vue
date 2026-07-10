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
          fecha_fin: festivo.fechaFin
        })))
      if (errorFestivos) throw errorFestivos
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

      for (const [temaIndex, tema] of asignatura.temas.entries()) {
        const { data: temaInsertado, error: errorTema } = await supabase
          .from('temas')
          .insert({ asignatura_id: asignaturaInsertada.id, nombre: tema.nombre, orden: temaIndex })
          .select('id')
          .single()
        if (errorTema || !temaInsertado) throw errorTema ?? new Error('tema')

        if (tema.subtemas.length) {
          const { error: errorSubtemas } = await supabase
            .from('subtemas')
            .insert(tema.subtemas.map((subtema, subtemaIndex) => ({
              tema_id: temaInsertado.id,
              nombre: subtema.nombre,
              dificultad: subtema.dificultad,
              orden: subtemaIndex
            })))
          if (errorSubtemas) throw errorSubtemas
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
              hora_inicio: franja.horaInicio,
              hora_fin: franja.horaFin
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
            {{ festivo.nombre || 'Sin nombre' }} ({{ festivo.fechaInicio }} – {{ festivo.fechaFin }})
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
              v-for="tema in asignatura.temas"
              :key="tema.clienteId"
            >
              {{ tema.nombre }}
              <span
                v-if="tema.subtemas.length"
                class="text-xs"
              >
                ({{ tema.subtemas.map(s => `${s.nombre} · ${s.dificultad}`).join(', ') }})
              </span>
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
              {{ ga.franjas.map(f => `${etiquetasDia[f.diaSemana]} ${f.horaInicio}-${f.horaFin}`).join(', ') }}
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
