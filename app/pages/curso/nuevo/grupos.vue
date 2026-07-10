<script setup lang="ts">
const store = useCursoWizardStore()

const opcionesDia = [
  { label: 'Lunes', value: 'lunes' },
  { label: 'Martes', value: 'martes' },
  { label: 'Miércoles', value: 'miercoles' },
  { label: 'Jueves', value: 'jueves' },
  { label: 'Viernes', value: 'viernes' },
  { label: 'Sábado', value: 'sabado' },
  { label: 'Domingo', value: 'domingo' }
]

function asignaturaEnGrupo(grupoClienteId: string, asignaturaClienteId: string) {
  const grupo = store.grupos.find(g => g.clienteId === grupoClienteId)
  return grupo?.asignaturas.find(ga => ga.asignaturaClienteId === asignaturaClienteId)
}
</script>

<template>
  <UContainer class="py-10">
    <CursoWizardSteps :paso="3" />

    <p
      v-if="!store.asignaturas.length"
      class="mb-6 text-sm text-muted"
    >
      Añade primero al menos una asignatura en el paso anterior.
    </p>

    <p
      v-else-if="!store.grupos.length"
      class="mb-6 text-sm text-muted"
    >
      Todavía no has añadido ningún grupo.
    </p>

    <UCard
      v-for="grupo in store.grupos"
      :key="grupo.clienteId"
      class="mb-6"
    >
      <template #header>
        <div class="flex items-end gap-3">
          <UFormField
            label="Nombre del grupo"
            class="flex-1"
          >
            <UInput
              v-model="grupo.nombre"
              placeholder="2º ESO A"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Color">
            <input
              v-model="grupo.color"
              type="color"
              class="h-9 w-14 cursor-pointer rounded border border-default bg-transparent"
            >
          </UFormField>

          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            aria-label="Eliminar grupo"
            @click="store.eliminarGrupo(grupo.clienteId)"
          />
        </div>
      </template>

      <div class="flex flex-col gap-4">
        <div
          v-for="asignatura in store.asignaturas"
          :key="asignatura.clienteId"
          class="rounded-lg border border-default p-4"
        >
          <UCheckbox
            :model-value="Boolean(asignaturaEnGrupo(grupo.clienteId, asignatura.clienteId))"
            :label="asignatura.nombre || 'Asignatura sin nombre'"
            @update:model-value="store.alternarAsignaturaEnGrupo(grupo.clienteId, asignatura.clienteId)"
          />

          <div
            v-if="asignaturaEnGrupo(grupo.clienteId, asignatura.clienteId)"
            class="mt-3 flex flex-col gap-2 pl-6"
          >
            <div
              v-for="franja in asignaturaEnGrupo(grupo.clienteId, asignatura.clienteId)!.franjas"
              :key="franja.clienteId"
              class="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <UFormField label="Día">
                <USelect
                  v-model="franja.diaSemana"
                  :items="opcionesDia"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Hora inicio">
                <UInput
                  v-model="franja.horaInicio"
                  type="time"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Hora fin">
                <UInput
                  v-model="franja.horaFin"
                  type="time"
                  class="w-full"
                />
              </UFormField>

              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                aria-label="Eliminar franja horaria"
                @click="store.eliminarFranja(grupo.clienteId, asignatura.clienteId, franja.clienteId)"
              />
            </div>

            <UButton
              icon="i-lucide-plus"
              color="neutral"
              variant="subtle"
              size="sm"
              class="self-start"
              @click="store.agregarFranja(grupo.clienteId, asignatura.clienteId)"
            >
              Añadir franja horaria
            </UButton>
          </div>
        </div>
      </div>
    </UCard>

    <UButton
      v-if="store.asignaturas.length"
      icon="i-lucide-plus"
      variant="subtle"
      class="mb-8"
      @click="store.agregarGrupo()"
    >
      Añadir grupo
    </UButton>

    <UAlert
      v-if="store.haySolape"
      color="error"
      variant="subtle"
      title="Hay franjas horarias que se solapan el mismo día. Revísalas antes de continuar."
      class="mb-6"
    />

    <div class="flex justify-between">
      <UButton
        to="/curso/nuevo/asignaturas"
        color="neutral"
        variant="ghost"
        leading-icon="i-lucide-arrow-left"
      >
        Anterior
      </UButton>

      <UButton
        to="/curso/nuevo/resumen"
        :disabled="!store.gruposValidos || store.haySolape"
        trailing-icon="i-lucide-arrow-right"
      >
        Siguiente
      </UButton>
    </div>
  </UContainer>
</template>
