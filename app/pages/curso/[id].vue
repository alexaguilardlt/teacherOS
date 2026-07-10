<script setup lang="ts">
const route = useRoute()
const cursoId = route.params.id as string

const supabase = useSupabaseClient()

const { data: curso } = await useAsyncData(`curso-${cursoId}`, async () => {
  const { data } = await supabase
    .from('cursos')
    .select('id, nombre, fecha_inicio, fecha_fin')
    .eq('id', cursoId)
    .single()
  return data
})

if (!curso.value) {
  throw createError({ statusCode: 404, statusMessage: 'Curso no encontrado' })
}

const { data: festivosIniciales } = await useAsyncData(`curso-${cursoId}-festivos`, async () => {
  const { data } = await supabase
    .from('dias_no_lectivos')
    .select('nombre, fecha_inicio, fecha_fin')
    .eq('curso_id', cursoId)
    .order('fecha_inicio', { ascending: true })
  return data ?? []
})

const state = reactive({
  nombre: curso.value.nombre,
  fechaInicio: curso.value.fecha_inicio,
  fechaFin: curso.value.fecha_fin
})

const festivos = ref((festivosIniciales.value ?? []).map(festivo => ({
  clienteId: crypto.randomUUID(),
  nombre: festivo.nombre ?? '',
  fechaInicio: festivo.fecha_inicio,
  fechaFin: festivo.fecha_fin
})))

function agregarFestivo() {
  festivos.value.push({ clienteId: crypto.randomUUID(), nombre: '', fechaInicio: '', fechaFin: '' })
}

function eliminarFestivo(clienteId: string) {
  festivos.value = festivos.value.filter(festivo => festivo.clienteId !== clienteId)
}

const guardando = ref(false)
const errorMessage = ref('')

async function guardar() {
  guardando.value = true
  errorMessage.value = ''

  try {
    const { error: errorCurso } = await supabase
      .from('cursos')
      .update({
        nombre: state.nombre,
        fecha_inicio: state.fechaInicio,
        fecha_fin: state.fechaFin
      })
      .eq('id', cursoId)
    if (errorCurso) throw errorCurso

    const { error: errorBorrar } = await supabase
      .from('dias_no_lectivos')
      .delete()
      .eq('curso_id', cursoId)
    if (errorBorrar) throw errorBorrar

    if (festivos.value.length) {
      const { error: errorFestivos } = await supabase
        .from('dias_no_lectivos')
        .insert(festivos.value.map(festivo => ({
          curso_id: cursoId,
          nombre: festivo.nombre || null,
          fecha_inicio: festivo.fechaInicio,
          fecha_fin: festivo.fechaFin
        })))
      if (errorFestivos) throw errorFestivos
    }

    await navigateTo('/dashboard')
  } catch (e) {
    errorMessage.value = (e as { message?: string })?.message || 'No se han podido guardar los cambios. Inténtalo de nuevo.'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <UContainer class="py-10">
    <h1 class="mb-6 text-lg font-semibold">
      Editar curso
    </h1>

    <UCard class="mb-6">
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField
          label="Nombre del curso"
          class="sm:col-span-3"
        >
          <UInput
            v-model="state.nombre"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Inicio del curso">
          <UInput
            v-model="state.fechaInicio"
            type="date"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Fin del curso">
          <UInput
            v-model="state.fechaFin"
            type="date"
            class="w-full"
          />
        </UFormField>
      </div>
    </UCard>

    <UCard class="mb-6">
      <template #header>
        <h2 class="text-lg font-semibold">
          Días o periodos festivos
        </h2>
      </template>

      <div class="flex flex-col gap-4">
        <p
          v-if="!festivos.length"
          class="text-sm text-muted"
        >
          No hay festivos añadidos.
        </p>

        <div
          v-for="festivo in festivos"
          :key="festivo.clienteId"
          class="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <UFormField label="Nombre">
            <UInput
              v-model="festivo.nombre"
              placeholder="Navidad"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Desde">
            <UInput
              v-model="festivo.fechaInicio"
              type="date"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Hasta">
            <UInput
              v-model="festivo.fechaFin"
              type="date"
              class="w-full"
            />
          </UFormField>

          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            aria-label="Eliminar festivo"
            @click="eliminarFestivo(festivo.clienteId)"
          />
        </div>

        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          class="self-start"
          @click="agregarFestivo()"
        >
          Añadir festivo
        </UButton>
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
        to="/dashboard"
        color="neutral"
        variant="ghost"
        leading-icon="i-lucide-arrow-left"
        :disabled="guardando"
      >
        Cancelar
      </UButton>

      <UButton
        :loading="guardando"
        @click="guardar"
      >
        Guardar cambios
      </UButton>
    </div>
  </UContainer>
</template>
