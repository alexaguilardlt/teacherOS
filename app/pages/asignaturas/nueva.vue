<script setup lang="ts">
const user = useSupabaseUser()
const supabase = useSupabaseClient()

const nombre = ref('')
const guardando = ref(false)
const errorMessage = ref('')

async function guardar() {
  if (!user.value) return

  guardando.value = true
  errorMessage.value = ''

  try {
    const { data: asignaturaInsertada, error } = await supabase
      .from('asignaturas')
      .insert({ profesor_id: user.value.sub, nombre: nombre.value })
      .select('id')
      .single()
    if (error || !asignaturaInsertada) throw error ?? new Error('asignatura')

    await navigateTo(`/asignaturas/${asignaturaInsertada.id}`)
  } catch (e) {
    errorMessage.value = (e as { message?: string })?.message || 'No se ha podido crear la asignatura. Inténtalo de nuevo.'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <UContainer class="py-10">
    <h1 class="mb-6 text-lg font-semibold">
      Nueva asignatura
    </h1>

    <UCard class="mb-6">
      <UFormField label="Nombre de la asignatura">
        <UInput
          v-model="nombre"
          placeholder="Biología 4º ESO"
          class="w-full"
        />
      </UFormField>
    </UCard>

    <p class="mb-6 text-sm text-muted">
      Después de crearla podrás añadir sus temas y puntos del temario.
    </p>

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
        :disabled="!nombre"
        :loading="guardando"
        @click="guardar"
      >
        Crear asignatura
      </UButton>
    </div>
  </UContainer>
</template>
