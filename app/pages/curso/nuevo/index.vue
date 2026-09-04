<script setup lang="ts">
const store = useCursoWizardStore()

const motivosInvalidos = computed(() => {
  const motivos: string[] = []

  if (!store.curso.nombre) motivos.push('Falta el nombre del curso.')
  if (!store.curso.fechaInicio || !store.curso.fechaFin) motivos.push('Falta la fecha de inicio o de fin del curso.')
  else if (store.curso.fechaFin <= store.curso.fechaInicio) motivos.push('La fecha de fin debe ser posterior a la de inicio.')

  store.horariosTipo.forEach((ht, i) => {
    const etiqueta = ht.nombre || `Horario tipo ${i + 1}`
    if (!ht.nombre) motivos.push(`"${etiqueta}": falta el nombre.`)
    if (!ht.periodos.length) motivos.push(`"${etiqueta}": no tiene ninguna franja horaria añadida.`)
    if (ht.periodos.some(p => !p.horaInicio || !p.horaFin || p.horaFin <= p.horaInicio)) {
      motivos.push(`"${etiqueta}": alguna franja horaria tiene la hora de inicio o fin vacía o incorrecta.`)
    }
    if (Boolean(ht.vigenciaInicio) !== Boolean(ht.vigenciaFin)) {
      motivos.push(`"${etiqueta}": la vigencia solo tiene un extremo relleno (o los dos, o ninguno).`)
    } else if (ht.vigenciaInicio && ht.vigenciaFin <= ht.vigenciaInicio) {
      motivos.push(`"${etiqueta}": la fecha de fin de la vigencia debe ser posterior a la de inicio.`)
    }
  })

  store.festivos.forEach((festivo, i) => {
    const etiqueta = festivo.nombre || `Festivo ${i + 1}`
    if (!festivo.fechaInicio) {
      motivos.push(`"${etiqueta}": falta la fecha.`)
    } else if (festivo.fechaFin && festivo.fechaFin < festivo.fechaInicio) {
      motivos.push(`"${etiqueta}": la fecha de fin no puede ser anterior a la de inicio.`)
    }
  })

  return motivos
})
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
      Crea un horario tipo por cada patrón de horas distinto: por ejemplo, uno para cuando no todos los grupos salen a la misma hora (1º-2º de ESO frente a 3º-4º y Bachillerato), y otro si en algunos meses hay jornada reducida (ej. septiembre y junio de 8 a 13, frente al resto del curso). Cada franja horaria de una asignatura elegirá qué período de qué horario tipo sigue. Si todavía no conoces el horario definitivo, puedes dejarlo para más tarde y añadirlo cuando lo sepas.
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
            icon="i-lucide-copy"
            color="neutral"
            variant="ghost"
            aria-label="Duplicar horario tipo"
            @click="store.duplicarHorarioTipo(horarioTipo.clienteId)"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            aria-label="Eliminar horario tipo"
            @click="store.eliminarHorarioTipo(horarioTipo.clienteId)"
          />
        </div>

        <p class="mt-1 text-xs text-muted">
          Si el mismo patrón de horas aplica en dos épocas del curso (ej. septiembre y junio), duplica este horario y pon la otra vigencia en la copia.
        </p>

        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <UFormField label="Vigente desde (opcional, vacío = todo el curso)">
            <UInput
              v-model="horarioTipo.vigenciaInicio"
              type="date"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Vigente hasta (opcional, vacío = todo el curso)">
            <UInput
              v-model="horarioTipo.vigenciaFin"
              type="date"
              class="w-full"
            />
          </UFormField>
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

          <UFormField label="Hasta (opcional, solo si dura varios días)">
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

    <UAlert
      v-if="motivosInvalidos.length"
      color="error"
      variant="subtle"
      title="Completa esto antes de continuar:"
      class="mb-6"
    >
      <template #description>
        <ul class="list-inside list-disc">
          <li
            v-for="motivo in motivosInvalidos"
            :key="motivo"
          >
            {{ motivo }}
          </li>
        </ul>
      </template>
    </UAlert>

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
