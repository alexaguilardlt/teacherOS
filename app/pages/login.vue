<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  middleware: 'guest'
})

const supabase = useSupabaseClient()

const state = reactive({
  email: '',
  password: ''
})

const errorMessage = ref('')
const loading = ref(false)

function validate(formState: typeof state): FormError[] {
  const errors: FormError[] = []
  if (!formState.email) {
    errors.push({ name: 'email', message: 'El email es obligatorio' })
  }
  if (!formState.password) {
    errors.push({ name: 'password', message: 'La contraseña es obligatoria' })
  }
  return errors
}

async function onSubmit(event: FormSubmitEvent<typeof state>) {
  errorMessage.value = ''
  loading.value = true

  const { error } = await supabase.auth.signInWithPassword({
    email: event.data.email,
    password: event.data.password
  })

  loading.value = false

  if (error) {
    errorMessage.value = 'Email o contraseña incorrectos'
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
          Iniciar sesión
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

        <UFormField
          label="Contraseña"
          name="password"
        >
          <UInput
            v-model="state.password"
            type="password"
            autocomplete="current-password"
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
          Entrar
        </UButton>
      </UForm>

      <template #footer>
        <p class="text-sm text-muted">
          ¿No tienes cuenta?
          <NuxtLink
            to="/registro"
            class="text-primary font-medium"
          >
            Regístrate
          </NuxtLink>
        </p>
      </template>
    </UCard>
  </UContainer>
</template>
