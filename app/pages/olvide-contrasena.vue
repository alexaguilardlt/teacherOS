<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  middleware: 'guest'
})

const supabase = useSupabaseClient()
const requestUrl = useRequestURL()

const state = reactive({
  email: ''
})

const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)

function validate(formState: typeof state): FormError[] {
  const errors: FormError[] = []
  if (!formState.email) {
    errors.push({ name: 'email', message: 'El email es obligatorio' })
  }
  return errors
}

async function onSubmit(event: FormSubmitEvent<typeof state>) {
  errorMessage.value = ''
  successMessage.value = ''
  loading.value = true

  const { error } = await supabase.auth.resetPasswordForEmail(event.data.email, {
    redirectTo: `${requestUrl.origin}/restablecer-contrasena`
  })

  loading.value = false

  if (error) {
    errorMessage.value = 'No se ha podido enviar el email. Inténtalo de nuevo.'
    return
  }

  successMessage.value = 'Si existe una cuenta con ese email, te hemos enviado un enlace para restablecer la contraseña.'
}
</script>

<template>
  <UContainer class="flex min-h-[calc(100vh-4rem)] items-center justify-center">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-lg font-semibold">
          Restablecer contraseña
        </h1>
      </template>

      <UForm
        :state="state"
        :validate="validate"
        class="flex flex-col gap-4"
        @submit="onSubmit"
      >
        <UFormField
          label="Email"
          name="email"
        >
          <UInput
            v-model="state.email"
            type="email"
            autocomplete="email"
            placeholder="tu@email.com"
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :title="errorMessage"
        />

        <UAlert
          v-if="successMessage"
          color="success"
          variant="subtle"
          :title="successMessage"
        />

        <UButton
          type="submit"
          block
          :loading="loading"
        >
          Enviar enlace
        </UButton>
      </UForm>

      <template #footer>
        <p class="text-sm text-muted">
          <NuxtLink
            to="/login"
            class="text-primary font-medium"
          >
            Volver a iniciar sesión
          </NuxtLink>
        </p>
      </template>
    </UCard>
  </UContainer>
</template>
