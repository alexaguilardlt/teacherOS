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

const { data: horarios } = await useAsyncData('dashboard-horarios', async () => {
  const { data } = await supabase
    .from('franjas_horarias')
    .select('id, grupo_asignatura_id, dia_semana, hora_inicio, hora_fin')
    .order('dia_semana', { ascending: true })
  return data ?? []
})

const etiquetasDia: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo'
}

function detalleFranja(grupoAsignaturaId: string) {
  const ga = grupoAsignaturas.value?.find(item => item.id === grupoAsignaturaId)
  const nombreAsignatura = asignaturas.value?.find(item => item.id === ga?.asignatura_id)?.nombre ?? ''
  const nombreGrupo = grupos.value?.find(item => item.id === ga?.grupo_id)?.nombre ?? ''
  return `${nombreAsignatura} · ${nombreGrupo}`
}

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

      <div class="grid gap-6 md:grid-cols-3">
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

        <UCard>
          <template #header>
            <h2 class="font-semibold">
              Horarios
            </h2>
          </template>
          <ul
            v-if="horarios?.length"
            class="flex flex-col gap-2"
          >
            <li
              v-for="franja in horarios"
              :key="franja.id"
            >
              <span class="font-medium">{{ etiquetasDia[franja.dia_semana] }}</span>
              {{ franja.hora_inicio }}–{{ franja.hora_fin }}
              <span class="text-muted">· {{ detalleFranja(franja.grupo_asignatura_id) }}</span>
            </li>
          </ul>
          <p
            v-else
            class="text-sm text-muted"
          >
            Aún no tienes horarios.
          </p>
        </UCard>
      </div>
    </div>
  </UContainer>
</template>
