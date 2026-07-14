<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui'

const supabase = useSupabaseClient()
const user = useSupabaseUser()

const state = reactive({
  password: '',
  confirmarPassword: ''
})

const errorMessage = ref('')
const loading = ref(false)

function validate(formState: typeof state): FormError[] {
  const errors: FormError[] = []
  if (!formState.password || formState.password.length < 6) {
    errors.push({ name: 'password', message: 'La contraseña debe tener al menos 6 caracteres' })
  }
  if (formState.confirmarPassword !== formState.password) {
    errors.push({ name: 'confirmarPassword', message: 'Las contraseñas no coinciden' })
  }
  return errors
}

async function onSubmit(event: FormSubmitEvent<typeof state>) {
  errorMessage.value = ''
  loading.value = true

  const { error } = await supabase.auth.updateUser({ password: event.data.password })

  loading.value = false

  if (error) {
    errorMessage.value = 'No se ha podido actualizar la contraseña. Puede que el enlace haya caducado; solicita uno nuevo.'
    return
  }

  await navigateTo('/dashboard')
}
</script>

<template>
  <UContainer class="flex min-h-[calc(100vh-4rem)] items-center justify-center">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-lg font-semibold">
          Nueva contraseña
        </h1>
      </template>

      <div v-if="!user">
        <p class="text-sm text-muted">
          Este enlace no es válido o ha caducado.
          <NuxtLink
            to="/olvide-contrasena"
            class="text-primary font-medium"
          >
            Solicita uno nuevo
          </NuxtLink>.
        </p>
      </div>

      <UForm
        v-else
        :state="state"
        :validate="validate"
        class="flex flex-col gap-4"
        @submit="onSubmit"
      >
        <UFormField
          label="Nueva contraseña"
          name="password"
        >
          <UInput
            v-model="state.password"
            type="password"
            autocomplete="new-password"
            placeholder="••••••••"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Confirmar contraseña"
          name="confirmarPassword"
        >
          <UInput
            v-model="state.confirmarPassword"
            type="password"
            autocomplete="new-password"
            placeholder="••••••••"
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :title="errorMessage"
        />

        <UButton
          type="submit"
          block
          :loading="loading"
        >
          Guardar contraseña
        </UButton>
      </UForm>
    </UCard>
  </UContainer>
</template>
