<script setup lang="ts">
const user = useSupabaseUser()

watch(user, (value) => {
  if (value) {
    navigateTo('/dashboard')
  }
}, { immediate: true })
</script>

<template>
  <UContainer class="flex min-h-[calc(100vh-4rem)] items-center justify-center">
    <div class="flex flex-col items-center gap-2 text-center">
      <UIcon
        name="i-lucide-loader-circle"
        class="size-6 animate-spin"
      />
      <p class="text-muted">
        Confirmando tu cuenta...
      </p>
    </div>
  </UContainer>
</template>
