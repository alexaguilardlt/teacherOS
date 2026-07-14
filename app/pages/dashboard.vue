<script setup lang="ts">
const {
  profesor,
  cursos,
  asignaturas,
  grupos,
  sesiones,
  etiquetaEstado,
  colorEstado,
  actualizandoEstadoId,
  alternarImpartida,
  detalleSesion,
  mesesCalendario,
  DIAS_SEMANA_CALENDARIO,
  diasSemanaHorario: dias,
  filasHorario,
  celdas,
  sinNada
} = useDashboardReparto()

const sidebarAbierto = ref(true)
const vistaReparto = ref<'lista' | 'calendario'>('lista')
const opcionesVistaReparto = [
  { label: 'Lista', value: 'lista' },
  { label: 'Calendario', value: 'calendario' }
]

const diaSeleccionado = ref<string | null>(null)

function alternarDia(fecha: string) {
  diaSeleccionado.value = diaSeleccionado.value === fecha ? null : fecha
}

function onClickCelda(celda: CeldaCalendario | null) {
  if (celda) alternarDia(celda.fecha)
}

const sesionesDelDiaSeleccionado = computed(() => {
  if (!diaSeleccionado.value) return []
  return (sesiones.value ?? [])
    .filter(s => s.fecha === diaSeleccionado.value)
    .map(s => detalleSesion(s))
})
</script>

<template>
  <div class="px-4 py-10 sm:px-6 lg:px-8">
    <h1 class="mb-8 text-2xl font-bold">
      Hola{{ profesor?.nombre ? `, ${profesor.nombre}` : '' }}
    </h1>

    <div
      v-if="sinNada"
      class="flex flex-col items-center gap-4 py-16 text-center"
    >
      <p class="text-lg text-muted">
        Todavía no tienes ninguna asignatura, grupo ni horario configurado.
      </p>
      <UButton
        to="/curso/nuevo"
        size="xl"
      >
        Empezar a crear tu curso
      </UButton>
    </div>

    <div
      v-else
      class="flex items-start gap-6"
    >
      <aside
        v-if="sidebarAbierto"
        class="flex w-72 shrink-0 flex-col gap-6"
      >
        <UButton
          icon="i-lucide-panel-left-close"
          color="neutral"
          variant="ghost"
          size="sm"
          class="self-start"
          aria-label="Ocultar menú"
          @click="sidebarAbierto = false"
        >
          Ocultar menú
        </UButton>

        <UCard v-if="cursos?.length">
          <template #header>
            <h2 class="font-semibold">
              Curso
            </h2>
          </template>
          <ul class="flex flex-col gap-2">
            <li
              v-for="curso in cursos"
              :key="curso.id"
            >
              <NuxtLink
                :to="`/curso/${curso.id}`"
                class="text-primary font-medium"
              >
                {{ curso.nombre }}
              </NuxtLink>
              <p class="text-sm text-muted">
                {{ curso.fecha_inicio }} – {{ curso.fecha_fin }}
              </p>
            </li>
          </ul>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-semibold">
              Asignaturas
            </h2>
          </template>
          <ul
            v-if="asignaturas?.length"
            class="flex flex-col gap-2"
          >
            <li
              v-for="asignatura in asignaturas"
              :key="asignatura.id"
            >
              <NuxtLink
                :to="`/asignaturas/${asignatura.id}`"
                class="text-primary"
              >
                {{ asignatura.nombre }}
              </NuxtLink>
            </li>
          </ul>
          <p
            v-else
            class="text-sm text-muted"
          >
            Aún no tienes asignaturas.
          </p>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-semibold">
              Grupos
            </h2>
          </template>
          <ul
            v-if="grupos?.length"
            class="flex flex-col gap-2"
          >
            <li
              v-for="grupo in grupos"
              :key="grupo.id"
              class="flex items-center gap-2"
            >
              <span
                class="size-2.5 shrink-0 rounded-full"
                :style="{ backgroundColor: grupo.color }"
              />
              <NuxtLink
                :to="`/grupos/${grupo.id}`"
                class="text-primary"
              >
                {{ grupo.nombre }}
              </NuxtLink>
            </li>
          </ul>
          <p
            v-else
            class="text-sm text-muted"
          >
            Aún no tienes grupos.
          </p>
        </UCard>
      </aside>

      <UButton
        v-else
        icon="i-lucide-panel-left-open"
        color="neutral"
        variant="subtle"
        size="sm"
        aria-label="Mostrar menú"
        @click="sidebarAbierto = true"
      />

      <main class="min-w-0 flex-1">
        <UCard class="mb-6">
          <template #header>
            <h2 class="font-semibold">
              Horario semanal
            </h2>
          </template>

          <div
            v-if="filasHorario.length"
            class="overflow-x-auto"
          >
            <table class="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th class="p-2 text-left text-muted">
                    Hora
                  </th>
                  <th
                    v-for="dia in dias"
                    :key="dia.value"
                    class="p-2 text-left text-muted"
                  >
                    {{ dia.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="fila in filasHorario"
                  :key="`${fila.horaInicio}-${fila.horaFin}`"
                  class="border-t border-default"
                >
                  <td class="p-2 align-top whitespace-nowrap text-muted">
                    {{ fila.horaInicio }}–{{ fila.horaFin }}
                  </td>
                  <td
                    v-for="dia in dias"
                    :key="dia.value"
                    class="p-2 align-top"
                  >
                    <div
                      v-if="celdas.get(`${fila.horaInicio}-${fila.horaFin}-${dia.value}`)"
                      class="rounded-md px-2 py-1 text-white"
                      :style="{ backgroundColor: celdas.get(`${fila.horaInicio}-${fila.horaFin}-${dia.value}`)!.color }"
                    >
                      <p class="font-medium">
                        {{ celdas.get(`${fila.horaInicio}-${fila.horaFin}-${dia.value}`)!.asignatura }}
                      </p>
                      <p class="text-xs opacity-90">
                        {{ celdas.get(`${fila.horaInicio}-${fila.horaFin}-${dia.value}`)!.grupo }}
                      </p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p
            v-else
            class="text-sm text-muted"
          >
            Aún no tienes horarios.
          </p>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="font-semibold">
                Reparto del curso
              </h2>
              <UTabs
                v-if="sesiones?.length"
                v-model="vistaReparto"
                :items="opcionesVistaReparto"
                :content="false"
                size="xs"
              />
            </div>
          </template>

          <div v-if="sesiones?.length">
            <div
              v-if="vistaReparto === 'lista'"
              class="max-h-[36rem] overflow-y-auto overflow-x-auto"
            >
              <table class="w-full min-w-[640px] text-sm">
                <thead>
                  <tr class="sticky top-0 bg-default text-left text-muted">
                    <th class="p-2">
                      Fecha
                    </th>
                    <th class="p-2">
                      Grupo
                    </th>
                    <th class="p-2">
                      Asignatura
                    </th>
                    <th class="p-2">
                      Contenido
                    </th>
                    <th class="p-2">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="sesion in sesiones"
                    :key="sesion.id"
                    class="border-t border-default"
                  >
                    <td class="p-2 whitespace-nowrap">
                      {{ sesion.fecha }}
                    </td>
                    <td class="p-2 whitespace-nowrap">
                      <span class="inline-flex items-center gap-2">
                        <span
                          class="size-2.5 shrink-0 rounded-full"
                          :style="{ backgroundColor: detalleSesion(sesion).color }"
                        />
                        {{ detalleSesion(sesion).grupo }}
                      </span>
                    </td>
                    <td class="p-2 whitespace-nowrap">
                      {{ detalleSesion(sesion).asignatura }}
                    </td>
                    <td class="p-2">
                      {{ detalleSesion(sesion).contenido }}
                    </td>
                    <td class="p-2">
                      <div class="flex items-center gap-2">
                        <UBadge
                          :color="colorEstado[sesion.estado] ?? 'neutral'"
                          variant="subtle"
                        >
                          {{ etiquetaEstado[sesion.estado] }}
                        </UBadge>
                        <UButton
                          :icon="sesion.estado === 'impartida' ? 'i-lucide-rotate-ccw' : 'i-lucide-check'"
                          color="neutral"
                          variant="ghost"
                          size="xs"
                          :loading="actualizandoEstadoId === sesion.id"
                          :aria-label="sesion.estado === 'impartida' ? 'Desmarcar como impartida' : 'Marcar como impartida'"
                          @click="alternarImpartida(sesion.id, sesion.estado)"
                        />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              v-else
              class="flex flex-col gap-6 lg:flex-row lg:items-start"
            >
              <div class="max-h-[46rem] flex-1 overflow-y-auto">
                <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div
                    v-for="mes in mesesCalendario"
                    :key="mes.etiqueta"
                    class="rounded-lg border border-default p-3"
                  >
                    <p class="mb-2 text-sm font-medium">
                      {{ mes.etiqueta }}
                    </p>
                    <div class="grid grid-cols-5 gap-1 text-center text-xs text-muted">
                      <span
                        v-for="d in DIAS_SEMANA_CALENDARIO"
                        :key="d"
                      >
                        {{ d }}
                      </span>
                    </div>
                    <div
                      v-for="(semana, i) in mes.semanas"
                      :key="i"
                      class="mt-1 grid grid-cols-5 gap-1"
                    >
                      <button
                        v-for="(celda, j) in semana"
                        :key="j"
                        type="button"
                        class="flex min-h-[4.5rem] flex-col items-start gap-0.5 rounded p-1 text-left text-xs"
                        :class="[
                          celda?.festivo
                            ? 'bg-error/10 hover:bg-error/20'
                            : (celda?.sesiones.length ? 'bg-primary/10 hover:bg-primary/20' : ''),
                          diaSeleccionado === celda?.fecha ? 'ring-2 ring-primary' : ''
                        ]"
                        :disabled="!celda"
                        :title="celda?.festivo ?? undefined"
                        @click="onClickCelda(celda)"
                      >
                        <template v-if="celda">
                          <span :class="celda.festivo ? 'font-medium text-error' : 'text-muted'">{{ celda.dia }}</span>
                          <span
                            v-if="celda.festivo"
                            class="block w-full truncate text-[10px] text-error"
                          >
                            {{ celda.festivo }}
                          </span>
                          <span
                            v-for="(s, k) in celda.sesiones.slice(0, 3)"
                            :key="k"
                            class="block w-full truncate rounded px-1 text-[10px] text-white"
                            :style="{ backgroundColor: s.color }"
                          >
                            {{ s.grupo }}
                          </span>
                          <span
                            v-if="celda.sesiones.length > 3"
                            class="text-[10px] text-muted"
                          >
                            +{{ celda.sesiones.length - 3 }} más
                          </span>
                        </template>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="w-full shrink-0 lg:w-80">
                <UCard>
                  <template #header>
                    <h3 class="text-sm font-semibold">
                      {{ diaSeleccionado ?? 'Selecciona un día' }}
                    </h3>
                  </template>

                  <p
                    v-if="!diaSeleccionado"
                    class="text-sm text-muted"
                  >
                    Haz clic en un día del calendario para ver el detalle de sus sesiones.
                  </p>
                  <p
                    v-else-if="!sesionesDelDiaSeleccionado.length"
                    class="text-sm text-muted"
                  >
                    Ese día no tiene sesiones.
                  </p>
                  <div
                    v-else
                    class="flex flex-col gap-4"
                  >
                    <div
                      v-for="(detalle, i) in sesionesDelDiaSeleccionado"
                      :key="i"
                      class="border-b border-default pb-3 last:border-b-0 last:pb-0"
                    >
                      <p class="flex items-center gap-2 font-medium">
                        <span
                          class="size-2.5 shrink-0 rounded-full"
                          :style="{ backgroundColor: detalle.color }"
                        />
                        {{ detalle.grupo }}
                      </p>
                      <p class="text-sm text-muted">
                        {{ detalle.asignatura }}
                      </p>
                      <ul class="mt-1 flex flex-col gap-1 text-sm">
                        <li
                          v-for="(punto, j) in detalle.puntos"
                          :key="j"
                        >
                          <span class="text-muted">{{ punto.tema }} — </span>{{ punto.subtema }}<span v-if="punto.fraccion < 1"> (½)</span>
                        </li>
                      </ul>
                      <div class="mt-2 flex items-center gap-2">
                        <UBadge
                          :color="colorEstado[detalle.estado] ?? 'neutral'"
                          variant="subtle"
                        >
                          {{ etiquetaEstado[detalle.estado] }}
                        </UBadge>
                        <UButton
                          :icon="detalle.estado === 'impartida' ? 'i-lucide-rotate-ccw' : 'i-lucide-check'"
                          color="neutral"
                          variant="ghost"
                          size="xs"
                          :loading="actualizandoEstadoId === detalle.id"
                          @click="alternarImpartida(detalle.id, detalle.estado)"
                        >
                          {{ detalle.estado === 'impartida' ? 'Desmarcar' : 'Marcar impartida' }}
                        </UButton>
                      </div>
                    </div>
                  </div>
                </UCard>
              </div>
            </div>
          </div>
          <p
            v-else
            class="text-sm text-muted"
          >
            Todavía no se ha generado el reparto de ninguna asignatura. Entra en un grupo y pulsa "Ver reparto" en la asignatura que quieras repartir.
          </p>
        </UCard>
      </main>
    </div>
  </div>
</template>
