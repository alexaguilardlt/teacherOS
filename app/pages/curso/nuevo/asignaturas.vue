<script setup lang="ts">
import type { TipoElementoSuelto } from '~/stores/cursoWizard.types'

const store = useCursoWizardStore()

const etiquetaTipoSuelto: Record<TipoElementoSuelto, string> = {
  repaso: 'Repaso',
  examen: 'Examen',
  exposicion_oral: 'Exposición oral',
  otro: 'Otro'
}

const opcionesTipoSuelto: { tipo: TipoElementoSuelto, etiqueta: string }[] = [
  { tipo: 'repaso', etiqueta: 'Añadir repaso' },
  { tipo: 'examen', etiqueta: 'Añadir examen' },
  { tipo: 'exposicion_oral', etiqueta: 'Añadir exposición oral' },
  { tipo: 'otro', etiqueta: 'Añadir otro' }
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
          v-for="(elemento, indiceElemento) in asignatura.elementos"
          :key="elemento.clienteId"
          class="rounded-lg border border-default p-4"
        >
          <template v-if="elemento.clase === 'tema'">
            <div class="mb-3 flex items-end gap-3">
              <UFormField
                label="Tema"
                class="flex-1"
              >
                <UInput
                  v-model="elemento.nombre"
                  placeholder="Nombre del tema"
                  class="w-full"
                />
              </UFormField>
              <UButton
                icon="i-lucide-chevron-up"
                color="neutral"
                variant="ghost"
                :disabled="indiceElemento === 0"
                aria-label="Mover arriba"
                @click="store.moverElemento(asignatura.clienteId, elemento.clienteId, 'arriba')"
              />
              <UButton
                icon="i-lucide-chevron-down"
                color="neutral"
                variant="ghost"
                :disabled="indiceElemento === asignatura.elementos.length - 1"
                aria-label="Mover abajo"
                @click="store.moverElemento(asignatura.clienteId, elemento.clienteId, 'abajo')"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                aria-label="Eliminar tema"
                @click="store.eliminarElemento(asignatura.clienteId, elemento.clienteId)"
              />
            </div>

            <UFormField
              v-if="!elemento.subtemas.length"
              label="Duración del tema entero (sesiones)"
              class="mb-3 max-w-xs"
              help="Si añades puntos del tema, la duración pasa a ser la suma de cada uno."
            >
              <UInput
                v-model.number="elemento.duracionSesiones"
                type="number"
                step="0.5"
                min="0.5"
                class="w-full"
              />
            </UFormField>

            <div class="flex flex-col gap-2 pl-4">
              <div
                v-for="(subtema, indiceSubtema) in elemento.subtemas"
                :key="subtema.clienteId"
                class="grid items-end gap-3 sm:grid-cols-[1fr_10rem_auto_auto_auto]"
              >
                <UFormField label="Punto del tema">
                  <UInput
                    v-model="subtema.nombre"
                    placeholder="Ecuaciones de primer grado"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Duración (sesiones)">
                  <UInput
                    v-model.number="subtema.duracionSesiones"
                    type="number"
                    step="0.5"
                    min="0.5"
                    class="w-full"
                  />
                </UFormField>

                <UButton
                  icon="i-lucide-chevron-up"
                  color="neutral"
                  variant="ghost"
                  :disabled="indiceSubtema === 0"
                  aria-label="Mover arriba"
                  @click="store.moverSubtema(asignatura.clienteId, elemento.clienteId, subtema.clienteId, 'arriba')"
                />
                <UButton
                  icon="i-lucide-chevron-down"
                  color="neutral"
                  variant="ghost"
                  :disabled="indiceSubtema === elemento.subtemas.length - 1"
                  aria-label="Mover abajo"
                  @click="store.moverSubtema(asignatura.clienteId, elemento.clienteId, subtema.clienteId, 'abajo')"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="neutral"
                  variant="ghost"
                  aria-label="Eliminar punto del tema"
                  @click="store.eliminarSubtema(asignatura.clienteId, elemento.clienteId, subtema.clienteId)"
                />
              </div>

              <UButton
                icon="i-lucide-plus"
                color="neutral"
                variant="subtle"
                size="sm"
                class="self-start"
                @click="store.agregarSubtema(asignatura.clienteId, elemento.clienteId)"
              >
                Añadir punto del tema
              </UButton>
            </div>
          </template>

          <div
            v-else
            class="grid items-end gap-3 sm:grid-cols-[8rem_1fr_10rem_auto_auto_auto]"
          >
            <p class="text-sm text-muted">
              {{ etiquetaTipoSuelto[elemento.tipo] }}
            </p>

            <UFormField label="Nombre">
              <UInput
                v-model="elemento.nombre"
                placeholder="Examen parcial 2ª evaluación"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Duración (sesiones)">
              <UInput
                v-model.number="elemento.duracionSesiones"
                type="number"
                step="0.5"
                min="0.5"
                class="w-full"
              />
            </UFormField>

            <UButton
              icon="i-lucide-chevron-up"
              color="neutral"
              variant="ghost"
              :disabled="indiceElemento === 0"
              aria-label="Mover arriba"
              @click="store.moverElemento(asignatura.clienteId, elemento.clienteId, 'arriba')"
            />
            <UButton
              icon="i-lucide-chevron-down"
              color="neutral"
              variant="ghost"
              :disabled="indiceElemento === asignatura.elementos.length - 1"
              aria-label="Mover abajo"
              @click="store.moverElemento(asignatura.clienteId, elemento.clienteId, 'abajo')"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              aria-label="Eliminar elemento"
              @click="store.eliminarElemento(asignatura.clienteId, elemento.clienteId)"
            />
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            icon="i-lucide-plus"
            color="neutral"
            variant="subtle"
            @click="store.agregarTema(asignatura.clienteId)"
          >
            Añadir tema
          </UButton>

          <UButton
            v-for="opcion in opcionesTipoSuelto"
            :key="opcion.tipo"
            icon="i-lucide-plus"
            color="neutral"
            variant="subtle"
            @click="store.agregarElementoSuelto(asignatura.clienteId, opcion.tipo)"
          >
            {{ opcion.etiqueta }}
          </UButton>
        </div>
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
