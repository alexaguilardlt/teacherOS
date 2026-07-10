<script setup lang="ts">
defineProps<{
  paso: number
}>()

const pasos = [
  { label: 'Curso', to: '/curso/nuevo' },
  { label: 'Asignaturas', to: '/curso/nuevo/asignaturas' },
  { label: 'Grupos', to: '/curso/nuevo/grupos' },
  { label: 'Resumen', to: '/curso/nuevo/resumen' }
]
</script>

<template>
  <nav class="mb-8 flex flex-wrap items-center gap-1">
    <template
      v-for="(item, index) in pasos"
      :key="item.to"
    >
      <NuxtLink
        :to="item.to"
        class="rounded-full px-3 py-1 text-sm"
        :class="paso === index + 1
          ? 'bg-primary text-inverted font-medium'
          : 'text-muted hover:text-default'"
      >
        {{ index + 1 }}. {{ item.label }}
      </NuxtLink>
      <UIcon
        v-if="index < pasos.length - 1"
        name="i-lucide-chevron-right"
        class="text-muted size-4"
      />
    </template>
  </nav>
</template>
