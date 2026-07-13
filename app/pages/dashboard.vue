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

const { data: festivos } = await useAsyncData('dashboard-festivos', async () => {
  const { data } = await supabase
    .from('dias_no_lectivos')
    .select('id, nombre, fecha_inicio, fecha_fin')
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
  const { data } = await supabase.from('subtemas').select('id, nombre, tema_id').in('id', subtemaIds)
  return data ?? []
})

const { data: temasReparto } = await useAsyncData('dashboard-temas-reparto', async () => {
  const temaIds = [...new Set((subtemasReparto.value ?? []).map(s => s.tema_id))]
  if (!temaIds.length) return []
  const { data } = await supabase.from('temas').select('id, nombre').in('id', temaIds)
  return data ?? []
})

const etiquetaEstado: Record<string, string> = {
  propuesta: 'Propuesta',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  impartida: 'Impartida'
}

function detalleSesion(sesion: { id: string, fecha: string, estado: string, franja_horaria_id: string }) {
  const franja = horarios.value?.find(f => f.id === sesion.franja_horaria_id)
  const ga = grupoAsignaturas.value?.find(item => item.id === franja?.grupo_asignatura_id)
  const grupo = grupos.value?.find(item => item.id === ga?.grupo_id)
  const asignatura = asignaturas.value?.find(item => item.id === ga?.asignatura_id)
  const puntos = (sesionSubtemas.value ?? [])
    .filter(ss => ss.sesion_id === sesion.id)
    .map((ss) => {
      const subtema = subtemasReparto.value?.find(s => s.id === ss.subtema_id)
      const tema = temasReparto.value?.find(t => t.id === subtema?.tema_id)
      return {
        tema: tema?.nombre ?? '',
        subtema: subtema?.nombre ?? '',
        fraccion: ss.fraccion
      }
    })
  const contenido = puntos
    .map(p => (p.fraccion < 1 ? `${p.subtema} (½)` : p.subtema))
    .join(', ')
  return {
    fecha: sesion.fecha,
    estado: sesion.estado,
    grupo: grupo?.nombre ?? '',
    color: grupo?.color ?? '#94a3b8',
    asignatura: asignatura?.nombre ?? '',
    contenido,
    puntos
  }
}

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

const DIAS_SEMANA_CALENDARIO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

interface CeldaCalendario {
  fecha: string
  dia: number
  sesiones: { color: string, grupo: string, asignatura: string }[]
  festivo: string | null
}

function festivoDe(fechaISO: string) {
  return (festivos.value ?? []).find(f => fechaISO >= f.fecha_inicio && fechaISO <= f.fecha_fin)
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
        sesiones: sesionesPorFecha.get(fechaISO) ?? [],
        festivo: festivoDe(fechaISO)?.nombre || (festivoDe(fechaISO) ? 'Festivo' : null)
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
                      <UBadge
                        :color="detalle.estado === 'confirmada' ? 'success' : 'neutral'"
                        variant="subtle"
                        class="mt-2"
                      >
                        {{ etiquetaEstado[detalle.estado] }}
                      </UBadge>
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
