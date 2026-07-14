<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'alternate icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'es'
  }
})

const title = 'teacherOS'
const description = 'Gestiona asignaturas, grupos y horarios, y reparte el temario del curso automáticamente.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary_large_image'
})

const user = useSupabaseUser()
const supabase = useSupabaseClient()

async function logout() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink
          :to="user ? '/dashboard' : '/'"
          class="text-lg font-bold"
        >
          teacherOS
        </NuxtLink>
      </template>

      <template #right>
        <UColorModeButton />

        <UButton
          v-if="user"
          label="Cerrar sesión"
          color="neutral"
          variant="ghost"
          @click="logout"
        />
        <template v-else>
          <UButton
            to="/login"
            label="Iniciar sesión"
            color="neutral"
            variant="ghost"
          />
          <UButton
            to="/registro"
            label="Crear cuenta"
          />
        </template>
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          © {{ new Date().getFullYear() }} teacherOS
        </p>
      </template>
    </UFooter>
  </UApp>
</template>
