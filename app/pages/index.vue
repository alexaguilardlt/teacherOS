<script setup lang="ts">
const user = useSupabaseUser()

watch(user, (value) => {
  if (value) {
    navigateTo('/dashboard')
  }
}, { immediate: true })
</script>

<template>
  <UPageHero
    title="Organiza el temario de tus asignaturas sin esfuerzo"
    description="Gestiona asignaturas, grupos y horarios, y deja que teacherOS reparta el temario a lo largo del curso según los días lectivos disponibles."
    :links="[{
      label: 'Crear cuenta',
      to: '/registro',
      size: 'xl'
    }, {
      label: 'Iniciar sesión',
      to: '/login',
      size: 'xl',
      color: 'neutral',
      variant: 'subtle'
    }]"
  />
</template>
