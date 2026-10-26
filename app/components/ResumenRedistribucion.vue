<script setup lang="ts">
import type { PreviewGrupoAsignatura } from '~/composables/useRedistribucion'

defineProps<{
  previews: PreviewGrupoAsignatura[]
}>()
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      v-for="preview in previews"
      :key="preview.grupoAsignaturaId"
      class="rounded-lg border border-default p-3 text-sm"
    >
      <p class="font-medium">
        {{ preview.asignaturaNombre }} · {{ preview.grupoNombre }}
      </p>
      <p class="text-muted">
        {{ preview.sesionesAEliminarIds.length }} sesiones futuras se reorganizan en {{ preview.sesionesNuevas.length }} nuevas sesiones.
      </p>
      <p
        v-if="preview.subtemasNoAsignados.length"
        class="text-error"
      >
        No caben en lo que queda de curso: {{ preview.subtemasNoAsignados.join(', ') }}.
      </p>
    </div>
  </div>
</template>
