<script setup lang="ts">
const store = useCursoWizardStore()

const opcionesDificultad = [
  { label: 'Baja', value: 'baja' },
  { label: 'Media', value: 'media' },
  { label: 'Alta', value: 'alta' }
]
</script>

<template>
  <UContainer class="py-10">
    <CursoWizardSteps :paso="2" />

    <p
      v-if="!store.asignaturas.length"
      class="mb-6 text-sm text-muted"
    >
      Todavía no has añadido ninguna asignatura.
    </p>

    <UCard
      v-for="asignatura in store.asignaturas"
      :key="asignatura.clienteId"
      class="mb-6"
    >
      <template #header>
        <div class="flex items-end gap-3">
          <UFormField
            label="Nombre de la asignatura"
            class="flex-1"
          >
            <UInput
              v-model="asignatura.nombre"
              placeholder="Matemáticas"
              class="w-full"
            />
          </UFormField>
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            aria-label="Eliminar asignatura"
            @click="store.eliminarAsignatura(asignatura.clienteId)"
          />
        </div>
      </template>

      <div class="flex flex-col gap-4">
        <div
          v-for="tema in asignatura.temas"
          :key="tema.clienteId"
          class="rounded-lg border border-default p-4"
        >
          <div class="mb-3 flex items-end gap-3">
            <UFormField
              label="Tema"
              class="flex-1"
            >
              <UInput
                v-model="tema.nombre"
                placeholder="Nombre del tema"
                class="w-full"
              />
            </UFormField>
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              aria-label="Eliminar tema"
              @click="store.eliminarTema(asignatura.clienteId, tema.clienteId)"
            />
          </div>

          <div class="flex flex-col gap-2 pl-4">
            <div
              v-for="subtema in tema.subtemas"
              :key="subtema.clienteId"
              class="grid items-end gap-3 sm:grid-cols-[1fr_10rem_auto]"
            >
              <UFormField label="Punto del tema">
                <UInput
                  v-model="subtema.nombre"
                  placeholder="Ecuaciones de primer grado"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Dificultad">
                <USelect
                  v-model="subtema.dificultad"
                  :items="opcionesDificultad"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>

              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                aria-label="Eliminar punto del tema"
                @click="store.eliminarSubtema(asignatura.clienteId, tema.clienteId, subtema.clienteId)"
              />
            </div>

            <UButton
              icon="i-lucide-plus"
              color="neutral"
              variant="subtle"
              size="sm"
              class="self-start"
              @click="store.agregarSubtema(asignatura.clienteId, tema.clienteId)"
            >
              Añadir punto del tema
            </UButton>
          </div>
        </div>

        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          class="self-start"
          @click="store.agregarTema(asignatura.clienteId)"
        >
          Añadir tema
        </UButton>
      </div>
    </UCard>

    <UButton
      icon="i-lucide-plus"
      variant="subtle"
      class="mb-8"
      @click="store.agregarAsignatura()"
    >
      Añadir asignatura
    </UButton>

    <div class="flex justify-between">
      <UButton
        to="/curso/nuevo"
        color="neutral"
        variant="ghost"
        leading-icon="i-lucide-arrow-left"
      >
        Anterior
      </UButton>

      <UButton
        to="/curso/nuevo/grupos"
        :disabled="!store.asignaturasValidas"
        trailing-icon="i-lucide-arrow-right"
      >
        Siguiente
      </UButton>
    </div>
  </UContainer>
</template>
