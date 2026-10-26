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
    // Todo el curso en una transacción (función de Postgres crear_curso,
    // migración 017): o se crea entero, o nada.
    const { error } = await supabase.rpc('crear_curso', {
      p_datos: construirCursoNuevo({
        curso: store.curso,
        festivos: store.festivos,
        horariosTipo: store.horariosTipo,
        asignaturas: store.asignaturas,
        grupos: store.grupos
      })
    })
    if (error) throw error

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
              {{ ga.franjas.map(f => `${etiquetasDia[f.diaSemana]} ${etiquetaPeriodo(f.periodoClienteId)}${f.propia ? '' : ' (no la impartes tú)'}`).join(', ') }}
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
