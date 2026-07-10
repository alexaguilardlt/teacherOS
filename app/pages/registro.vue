<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  middleware: 'guest'
})

const supabase = useSupabaseClient()
const requestUrl = useRequestURL()

const state = reactive({
  nombre: '',
  email: '',
  password: '',
  confirmarPassword: ''
})

const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)

function validate(formState: typeof state): FormError[] {
  const errors: FormError[] = []
  if (!formState.nombre) {
    errors.push({ name: 'nombre', message: 'El nombre es obligatorio' })
  }
  if (!formState.email) {
    errors.push({ name: 'email', message: 'El email es obligatorio' })
  }
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
  successMessage.value = ''
  loading.value = true

  const { data, error } = await supabase.auth.signUp({
    email: event.data.email,
    password: event.data.password,
    options: {
      data: { nombre: event.data.nombre },
      emailRedirectTo: `${requestUrl.origin}/confirm`
    }
  })

  loading.value = false

  if (error) {
    errorMessage.value = error.message === 'User already registered'
      ? 'Ya existe una cuenta con ese email'
      : 'No se ha podido completar el registro'
    return
  }

  if (data.session) {
    await navigateTo('/dashboard')
    return
  }

  successMessage.value = 'Te hemos enviado un email para confirmar tu cuenta'
}
</script>

<template>
  <UContainer class="flex min-h-[calc(100vh-4rem)] items-center justify-center">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-lg font-semibold">
          Crear cuenta
        </h1>
      </template>

      <UForm
        :state="state"
        :validate="validate"
        class="flex flex-col gap-4"
        @submit="onSubmit"
      >
        <UFormField
          label="Nombre"
          name="nombre"
        >
          <UInput
            v-model="state.nombre"
            autocomplete="name"
            placeholder="Tu nombre"
            class="w-full"
          />
        </UFormField>

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
          Registrarme
        </UButton>
      </UForm>

      <template #footer>
        <p class="text-sm text-muted">
          ¿Ya tienes cuenta?
          <NuxtLink
            to="/login"
            class="text-primary font-medium"
          >
            Inicia sesión
          </NuxtLink>
        </p>
      </template>
    </UCard>
  </UContainer>
</template>
