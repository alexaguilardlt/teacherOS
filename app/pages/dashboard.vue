<script setup lang="ts">
const user = useSupabaseUser()
const supabase = useSupabaseClient()

const { data: profesor } = await useAsyncData('dashboard-profesor', async () => {
  if (!user.value) return null
  const { data } = await supabase
    .from('profesores')
    .select('nombre')
    .eq('id', user.value.sub)
    .single()
  return data
}, { watch: [user] })

const { data: cursos } = await useAsyncData('dashboard-cursos', async () => {
  const { data } = await supabase
    .from('cursos')
    .select('id, nombre, fecha_inicio, fecha_fin')
    .order('creado_en', { ascending: false })
  return data ?? []
})

const { data: asignaturas } = await useAsyncData('dashboard-asignaturas', async () => {
  const { data } = await supabase
    .from('asignaturas')
    .select('id, nombre')
    .order('creado_en', { ascending: false })
  return data ?? []
})

const { data: grupos } = await useAsyncData('dashboard-grupos', async () => {
  const { data } = await supabase
    .from('grupos')
    .select('id, nombre, color')
    .order('creado_en', { ascending: false })
  return data ?? []
})

const { data: grupoAsignaturas } = await useAsyncData('dashboard-grupo-asignaturas', async () => {
  const { data } = await supabase
    .from('grupo_asignaturas')
    .select('id, grupo_id, asignatura_id')
  return data ?? []
})

const { data: periodos } = await useAsyncData('dashboard-periodos', async () => {
  const { data } = await supabase
    .from('periodos_horarios')
    .select('id, hora_inicio, hora_fin')
  return data ?? []
})

const { data: horarios } = await useAsyncData('dashboard-horarios', async () => {
  const { data } = await supabase
    .from('franjas_horarias')
    .select('id, grupo_asignatura_id, dia_semana, periodo_id')
  return data ?? []
})

const dias = [
  { value: 'lunes', label: 'Lunes' },
  { value: 'martes', label: 'Martes' },
  { value: 'miercoles', label: 'Miércoles' },
  { value: 'jueves', label: 'Jueves' },
  { value: 'viernes', label: 'Viernes' }
]

// Distintos horarios tipo pueden definir franjas con el mismo rango
// de horas (ej. el período de 10:30-11:20 en dos ciclos distintos):
// se agrupan en una sola fila de la cuadrícula por hora real.
const filasHorario = computed(() => {
  const vistos = new Map<string, { horaInicio: string, horaFin: string }>()
  for (const periodo of periodos.value ?? []) {
    vistos.set(`${periodo.hora_inicio}-${periodo.hora_fin}`, {
      horaInicio: periodo.hora_inicio,
      horaFin: periodo.hora_fin
    })
  }
  return [...vistos.values()].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
})

const celdas = computed(() => {
  const map = new Map<string, { asignatura: string, grupo: string, color: string }>()
  for (const franja of horarios.value ?? []) {
    const periodo = periodos.value?.find(item => item.id === franja.periodo_id)
    if (!periodo) continue
    const ga = grupoAsignaturas.value?.find(item => item.id === franja.grupo_asignatura_id)
    const grupo = grupos.value?.find(item => item.id === ga?.grupo_id)
    map.set(`${periodo.hora_inicio}-${periodo.hora_fin}-${franja.dia_semana}`, {
      asignatura: asignaturas.value?.find(item => item.id === ga?.asignatura_id)?.nombre ?? '',
      grupo: grupo?.nombre ?? '',
      color: grupo?.color ?? '#94a3b8'
    })
  }
  return map
})

const sinNada = computed(() =>
  (cursos.value?.length ?? 0) === 0
  && (asignaturas.value?.length ?? 0) === 0
  && (grupos.value?.length ?? 0) === 0
  && (horarios.value?.length ?? 0) === 0
)
</script>

<template>
  <UContainer class="py-10">
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

    <div v-else>
      <UCard
        v-if="cursos?.length"
        class="mb-6"
      >
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
            <span class="text-sm text-muted">
              ({{ curso.fecha_inicio }} – {{ curso.fecha_fin }})
            </span>
          </li>
        </ul>
      </UCard>

      <div class="mb-6 grid gap-6 md:grid-cols-2">
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
      </div>

      <UCard>
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
    </div>
  </UContainer>
</template>
