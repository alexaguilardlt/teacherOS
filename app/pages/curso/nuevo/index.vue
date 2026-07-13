<script setup lang="ts">
const store = useCursoWizardStore()
</script>

<template>
  <UContainer class="py-10">
    <CursoWizardSteps :paso="1" />

    <UCard class="mb-6">
      <template #header>
        <h1 class="text-lg font-semibold">
          Datos del curso
        </h1>
      </template>

      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField
          label="Nombre del curso"
          class="sm:col-span-3"
        >
          <UInput
            v-model="store.curso.nombre"
            placeholder="2º ESO — Curso 2025/2026"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Inicio del curso">
          <UInput
            v-model="store.curso.fechaInicio"
            type="date"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Fin del curso">
          <UInput
            v-model="store.curso.fechaFin"
            type="date"
            class="w-full"
          />
        </UFormField>
      </div>
    </UCard>

    <p class="mb-2 text-sm text-muted">
      Si en tu centro no todos los grupos salen a la misma hora (ej. 1º y 2º de ESO frente a 3º-4º y Bachillerato), crea un horario tipo por cada patrón distinto. Luego cada grupo elegirá cuál sigue.
    </p>

    <p
      v-if="!store.horariosTipo.length"
      class="mb-6 text-sm text-muted"
    >
      Todavía no has añadido ningún horario tipo.
    </p>

    <UCard
      v-for="horarioTipo in store.horariosTipo"
      :key="horarioTipo.clienteId"
      class="mb-6"
    >
      <template #header>
        <div class="flex items-end gap-3">
          <UFormField
            label="Nombre del horario"
            class="flex-1"
          >
            <UInput
              v-model="horarioTipo.nombre"
              placeholder="ESO 1º-2º"
              class="w-full"
            />
          </UFormField>
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            aria-label="Eliminar horario tipo"
            @click="store.eliminarHorarioTipo(horarioTipo.clienteId)"
          />
        </div>
      </template>

      <div class="flex flex-col gap-4">
        <p
          v-if="!horarioTipo.periodos.length"
          class="text-sm text-muted"
        >
          Todavía no has añadido ninguna franja. Por ejemplo: 8:00–8:50, 8:50–9:40...
        </p>

        <div
          v-for="periodo in horarioTipo.periodos"
          :key="periodo.clienteId"
          class="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <UFormField label="Hora inicio">
            <UInput
              v-model="periodo.horaInicio"
              type="time"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Hora fin">
            <UInput
              v-model="periodo.horaFin"
              type="time"
              class="w-full"
            />
          </UFormField>

          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            aria-label="Eliminar franja"
            @click="store.eliminarPeriodo(horarioTipo.clienteId, periodo.clienteId)"
          />
        </div>

        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          class="self-start"
          @click="store.agregarPeriodo(horarioTipo.clienteId)"
        >
          Añadir franja horaria
        </UButton>
      </div>
    </UCard>

    <UButton
      icon="i-lucide-plus"
      variant="subtle"
      class="mb-8"
      @click="store.agregarHorarioTipo()"
    >
      Añadir horario tipo
    </UButton>

    <UCard class="mb-6">
      <template #header>
        <h2 class="text-lg font-semibold">
          Días o periodos festivos
        </h2>
      </template>

      <div class="flex flex-col gap-4">
        <p
          v-if="!store.festivos.length"
          class="text-sm text-muted"
        >
          Todavía no has añadido ningún festivo.
        </p>

        <div
          v-for="festivo in store.festivos"
          :key="festivo.clienteId"
          class="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <UFormField label="Nombre">
            <UInput
              v-model="festivo.nombre"
              placeholder="Navidad"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Desde">
            <UInput
              v-model="festivo.fechaInicio"
              type="date"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Hasta">
            <UInput
              v-model="festivo.fechaFin"
              type="date"
              class="w-full"
            />
          </UFormField>

          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            aria-label="Eliminar festivo"
            @click="store.eliminarFestivo(festivo.clienteId)"
          />
        </div>

        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          class="self-start"
          @click="store.agregarFestivo()"
        >
          Añadir festivo
        </UButton>
      </div>
    </UCard>

    <div class="flex justify-end">
      <UButton
        to="/curso/nuevo/asignaturas"
        :disabled="!store.cursoValido"
        trailing-icon="i-lucide-arrow-right"
      >
        Siguiente
      </UButton>
    </div>
  </UContainer>
</template>
