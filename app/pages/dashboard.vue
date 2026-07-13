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

const { data: sesiones } = await useAsyncData('dashboard-sesiones', async () => {
  const { data } = await supabase
    .from('sesiones')
    .select('id, fecha, estado, franja_horaria_id')
    .order('fecha', { ascending: true })
  return data ?? []
})

const { data: sesionSubtemas } = await useAsyncData('dashboard-sesion-subtemas', async () => {
  const sesionIds = (sesiones.value ?? []).map(s => s.id)
  if (!sesionIds.length) return []
  const { data } = await supabase
    .from('sesion_subtemas')
    .select('sesion_id, subtema_id, fraccion')
    .in('sesion_id', sesionIds)
  return data ?? []
})

const { data: subtemasReparto } = await useAsyncData('dashboard-subtemas-reparto', async () => {
  const subtemaIds = [...new Set((sesionSubtemas.value ?? []).map(ss => ss.subtema_id))]
  if (!subtemaIds.length) return []
  const { data } = await supabase.from('subtemas').select('id, nombre').in('id', subtemaIds)
  return data ?? []
})

const etiquetaEstado: Record<string, string> = {
  propuesta: 'Propuesta',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  impartida: 'Impartida'
}

function detalleSesion(sesion: { id: string, franja_horaria_id: string }) {
  const franja = horarios.value?.find(f => f.id === sesion.franja_horaria_id)
  const ga = grupoAsignaturas.value?.find(item => item.id === franja?.grupo_asignatura_id)
  const grupo = grupos.value?.find(item => item.id === ga?.grupo_id)
  const asignatura = asignaturas.value?.find(item => item.id === ga?.asignatura_id)
  const contenido = (sesionSubtemas.value ?? [])
    .filter(ss => ss.sesion_id === sesion.id)
    .map((ss) => {
      const nombre = subtemasReparto.value?.find(s => s.id === ss.subtema_id)?.nombre ?? ''
      return ss.fraccion < 1 ? `${nombre} (½)` : nombre
    })
    .join(', ')
  return {
    grupo: grupo?.nombre ?? '',
    color: grupo?.color ?? '#94a3b8',
    asignatura: asignatura?.nombre ?? '',
    contenido
  }
}

const vistaReparto = ref<'lista' | 'calendario'>('lista')
const opcionesVistaReparto = [
  { label: 'Lista', value: 'lista' },
  { label: 'Calendario', value: 'calendario' }
]

const DIAS_SEMANA_CALENDARIO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

interface CeldaCalendario {
  fecha: string
  dia: number
  sesiones: { color: string, grupo: string, asignatura: string }[]
}

interface MesCalendario {
  etiqueta: string
  semanas: (CeldaCalendario | null)[][]
}

const mesesCalendario = computed<MesCalendario[]>(() => {
  const fechas = (sesiones.value ?? []).map(s => s.fecha)
  if (!fechas.length) return []

  const sesionesPorFecha = new Map<string, { color: string, grupo: string, asignatura: string }[]>()
  for (const sesion of sesiones.value ?? []) {
    const detalle = detalleSesion(sesion)
    if (!sesionesPorFecha.has(sesion.fecha)) sesionesPorFecha.set(sesion.fecha, [])
    sesionesPorFecha.get(sesion.fecha)!.push({ color: detalle.color, grupo: detalle.grupo, asignatura: detalle.asignatura })
  }

  const minFecha = fechas.reduce((a, b) => (a < b ? a : b))
  const maxFecha = fechas.reduce((a, b) => (a > b ? a : b))

  let cursorAnio = Number(minFecha.slice(0, 4))
  let cursorMes = Number(minFecha.slice(5, 7)) - 1
  const finAnio = Number(maxFecha.slice(0, 4))
  const finMes = Number(maxFecha.slice(5, 7)) - 1

  const meses: MesCalendario[] = []

  while (cursorAnio < finAnio || (cursorAnio === finAnio && cursorMes <= finMes)) {
    const primerDia = new Date(Date.UTC(cursorAnio, cursorMes, 1))
    const ultimoDia = new Date(Date.UTC(cursorAnio, cursorMes + 1, 0))

    const semanas: (CeldaCalendario | null)[][] = []
    let semanaActual: (CeldaCalendario | null)[] = []

    const diaSemanaInicial = (primerDia.getUTCDay() + 6) % 7
    if (diaSemanaInicial < 5) {
      for (let i = 0; i < diaSemanaInicial; i++) semanaActual.push(null)
    }

    for (const d = new Date(primerDia); d <= ultimoDia; d.setUTCDate(d.getUTCDate() + 1)) {
      const diaSemana = (d.getUTCDay() + 6) % 7
      if (diaSemana > 4) continue

      if (diaSemana === 0 && semanaActual.length > 0) {
        semanas.push(semanaActual)
        semanaActual = []
      }

      const fechaISO = d.toISOString().slice(0, 10)
      semanaActual.push({
        fecha: fechaISO,
        dia: d.getUTCDate(),
        sesiones: sesionesPorFecha.get(fechaISO) ?? []
      })
    }
    if (semanaActual.length > 0) {
      while (semanaActual.length < 5) semanaActual.push(null)
      semanas.push(semanaActual)
    }

    meses.push({ etiqueta: `${NOMBRES_MES[cursorMes]} ${cursorAnio}`, semanas })

    cursorMes++
    if (cursorMes > 11) {
      cursorMes = 0
      cursorAnio++
    }
  }

  return meses
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

      <UCard class="mt-6">
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
            class="max-h-[32rem] overflow-y-auto overflow-x-auto"
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
                    <UBadge
                      :color="sesion.estado === 'confirmada' ? 'success' : 'neutral'"
                      variant="subtle"
                    >
                      {{ etiquetaEstado[sesion.estado] }}
                    </UBadge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-else
            class="max-h-[42rem] overflow-y-auto"
          >
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                  <div
                    v-for="(celda, j) in semana"
                    :key="j"
                    class="flex aspect-square flex-col items-center justify-center rounded text-xs"
                    :class="celda?.sesiones.length ? 'bg-primary/10' : ''"
                  >
                    <template v-if="celda">
                      <span class="text-muted">{{ celda.dia }}</span>
                      <span
                        v-if="celda.sesiones.length"
                        class="mt-0.5 flex gap-0.5"
                      >
                        <span
                          v-for="(s, k) in celda.sesiones.slice(0, 4)"
                          :key="k"
                          class="size-1.5 rounded-full"
                          :style="{ backgroundColor: s.color }"
                          :title="`${s.grupo} · ${s.asignatura}`"
                        />
                      </span>
                    </template>
                  </div>
                </div>
              </div>
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
    </div>
  </UContainer>
</template>
