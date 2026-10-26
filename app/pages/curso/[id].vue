<script setup lang="ts">
import type { PreviewGrupoAsignatura } from '~/composables/useRedistribucion'
import { calendarioAfectaAlReparto, festivosARangos, planificarGuardadoCurso, vigenciasPorHorarioTipo, type PlanGuardadoCurso } from '~/utils/curso'

const route = useRoute()
const cursoId = route.params.id as string

const supabase = useSupabaseClient()
const { previsualizarCambioCurso } = useRedistribucion()

const { data: curso } = await useAsyncData(`curso-${cursoId}`, async () => {
  const { data } = await supabase
    .from('cursos')
    .select('id, nombre, fecha_inicio, fecha_fin')
    .eq('id', cursoId)
    .single()
  return data
})

if (!curso.value) {
  throw createError({ statusCode: 404, statusMessage: 'Curso no encontrado' })
}

const { data: festivosIniciales } = await useAsyncData(`curso-${cursoId}-festivos`, async () => {
  const { data } = await supabase
    .from('dias_no_lectivos')
    .select('nombre, fecha_inicio, fecha_fin')
    .eq('curso_id', cursoId)
    .order('fecha_inicio', { ascending: true })
  return data ?? []
})

const { data: horariosTipoIniciales } = await useAsyncData(`curso-${cursoId}-horarios-tipo`, async () => {
  const { data } = await supabase
    .from('horarios_tipo')
    .select('id, nombre')
    .eq('curso_id', cursoId)
    .order('creado_en', { ascending: true })
  return data ?? []
})

const htIds = (horariosTipoIniciales.value ?? []).map(ht => ht.id)

const { data: periodosIniciales } = await useAsyncData(`curso-${cursoId}-periodos`, async () => {
  if (!htIds.length) return []
  const { data } = await supabase
    .from('periodos_horarios')
    .select('id, horario_tipo_id, hora_inicio, hora_fin')
    .in('horario_tipo_id', htIds)
    .order('orden', { ascending: true })
  return data ?? []
})

const { data: vigenciasIniciales } = await useAsyncData(`curso-${cursoId}-vigencias`, async () => {
  if (!htIds.length) return []
  const { data } = await supabase
    .from('horario_tipo_vigencias')
    .select('id, horario_tipo_id, fecha_inicio, fecha_fin')
    .in('horario_tipo_id', htIds)
  return data ?? []
})

// Qué grupos usan cada franja horaria: una franja en uso no se puede quitar
// (se borrarían en cascada las franjas de esos grupos y sus sesiones).
const { data: franjasEnUso } = await useAsyncData(`curso-${cursoId}-franjas-en-uso`, async () => {
  const { data: grupos } = await supabase.from('grupos').select('id, nombre').eq('curso_id', cursoId)
  if (!grupos?.length) return []
  const { data: grupoAsignaturas } = await supabase
    .from('grupo_asignaturas')
    .select('id, grupo_id')
    .in('grupo_id', grupos.map(g => g.id))
  if (!grupoAsignaturas?.length) return []
  const { data: franjas } = await supabase
    .from('franjas_horarias')
    .select('periodo_id, grupo_asignatura_id')
    .in('grupo_asignatura_id', grupoAsignaturas.map(ga => ga.id))
  return (franjas ?? []).map(f => ({
    periodoId: f.periodo_id,
    grupo: grupos.find(g => g.id === grupoAsignaturas.find(ga => ga.id === f.grupo_asignatura_id)?.grupo_id)?.nombre ?? ''
  }))
})

function motivoEnUso(periodoIds: string[]) {
  const grupos = [...new Set((franjasEnUso.value ?? []).filter(f => periodoIds.includes(f.periodoId)).map(f => f.grupo))].sort()
  if (!grupos.length) return undefined
  return `La usan ${grupos.join(', ')}: quítala antes de sus horarios.`
}

const state = reactive({
  nombre: curso.value.nombre,
  fechaInicio: curso.value.fecha_inicio,
  fechaFin: curso.value.fecha_fin
})

const festivos = ref((festivosIniciales.value ?? []).map(festivo => ({
  clienteId: crypto.randomUUID(),
  nombre: festivo.nombre ?? '',
  fechaInicio: festivo.fecha_inicio,
  fechaFin: festivo.fecha_fin
})))

function agregarFestivo() {
  festivos.value.push({ clienteId: crypto.randomUUID(), nombre: '', fechaInicio: '', fechaFin: '' })
}

function eliminarFestivo(clienteId: string) {
  festivos.value = festivos.value.filter(festivo => festivo.clienteId !== clienteId)
}

// Lo que ya existe usa su id de la base de datos como clienteId: al guardar
// se actualiza en vez de borrarse y recrearse.
const horariosTipo = ref((horariosTipoIniciales.value ?? []).map(ht => ({
  clienteId: ht.id,
  nombre: ht.nombre,
  vigencias: (vigenciasIniciales.value ?? [])
    .filter(v => v.horario_tipo_id === ht.id)
    .map(v => ({ clienteId: v.id, fechaInicio: v.fecha_inicio, fechaFin: v.fecha_fin })),
  periodos: (periodosIniciales.value ?? [])
    .filter(periodo => periodo.horario_tipo_id === ht.id)
    .map(periodo => ({ clienteId: periodo.id, horaInicio: periodo.hora_inicio, horaFin: periodo.hora_fin }))
})))

function agregarHorarioTipo() {
  horariosTipo.value.push({ clienteId: crypto.randomUUID(), nombre: '', vigencias: [], periodos: [] })
}

function eliminarHorarioTipo(clienteId: string) {
  horariosTipo.value = horariosTipo.value.filter(ht => ht.clienteId !== clienteId)
}

// Copia las franjas horarias a un horario tipo nuevo (sin vigencias), por si
// el profesor prefiere seguir usando horarios separados para épocas
// distintas en vez de añadir varios tramos al mismo horario.
function duplicarHorarioTipo(clienteId: string) {
  const original = horariosTipo.value.find(ht => ht.clienteId === clienteId)
  if (!original) return
  horariosTipo.value.push({
    clienteId: crypto.randomUUID(),
    nombre: `${original.nombre} (copia)`,
    vigencias: [],
    periodos: original.periodos.map(periodo => ({
      clienteId: crypto.randomUUID(),
      horaInicio: periodo.horaInicio,
      horaFin: periodo.horaFin
    }))
  })
}

function agregarVigencia(horarioTipoClienteId: string) {
  const ht = horariosTipo.value.find(h => h.clienteId === horarioTipoClienteId)
  ht?.vigencias.push({ clienteId: crypto.randomUUID(), fechaInicio: '', fechaFin: '' })
}

function eliminarVigencia(horarioTipoClienteId: string, vigenciaClienteId: string) {
  const ht = horariosTipo.value.find(h => h.clienteId === horarioTipoClienteId)
  if (!ht) return
  ht.vigencias = ht.vigencias.filter(v => v.clienteId !== vigenciaClienteId)
}

function agregarPeriodo(horarioTipoClienteId: string) {
  const ht = horariosTipo.value.find(h => h.clienteId === horarioTipoClienteId)
  ht?.periodos.push({ clienteId: crypto.randomUUID(), horaInicio: '', horaFin: '' })
}

function eliminarPeriodo(horarioTipoClienteId: string, periodoClienteId: string) {
  const ht = horariosTipo.value.find(h => h.clienteId === horarioTipoClienteId)
  if (!ht) return
  ht.periodos = ht.periodos.filter(periodo => periodo.clienteId !== periodoClienteId)
}

const horariosTipoValidos = computed(() =>
  horariosTipo.value.every(ht =>
    Boolean(ht.nombre)
    && ht.periodos.every(periodo => periodo.horaInicio && periodo.horaFin && periodo.horaFin > periodo.horaInicio)
    && ht.vigencias.every(v => Boolean(v.fechaInicio && v.fechaFin) && v.fechaFin > v.fechaInicio)
  )
)

// dias_no_lectivos exige fecha_fin >= fecha_inicio en base de datos: si no
// se valida aquí, el error solo aparece al guardar.
const festivosValidos = computed(() =>
  festivos.value.every(festivo =>
    Boolean(festivo.fechaInicio) && (!festivo.fechaFin || festivo.fechaFin >= festivo.fechaInicio)
  )
)

const guardando = ref(false)
const errorMessage = ref('')

// Si cambian fechas, festivos o vigencias y eso mueve algún reparto ya
// generado, antes de guardar se enseña cómo quedarían las sesiones a partir
// de hoy, y el curso y el reparto se guardan juntos.
const planPendiente = ref<PlanGuardadoCurso | null>(null)
const previewsRecolocacion = ref<PreviewGrupoAsignatura[]>([])
const modalRecolocarAbierto = ref(false)
const recolocando = ref(false)
const errorRecolocacion = ref('')

async function guardar() {
  guardando.value = true
  errorMessage.value = ''

  try {
    const plan = planificarGuardadoCurso(horariosTipo.value, {
      horarioTipoIds: (horariosTipoIniciales.value ?? []).map(ht => ht.id),
      vigenciaIds: (vigenciasIniciales.value ?? []).map(v => v.id),
      periodoIds: (periodosIniciales.value ?? []).map(p => p.id)
    })

    const periodosQuitados = [
      ...plan.periodoIdsABorrar,
      ...(periodosIniciales.value ?? []).filter(p => plan.horarioTipoIdsABorrar.includes(p.horario_tipo_id)).map(p => p.id)
    ]
    const enUso = motivoEnUso(periodosQuitados)
    if (enUso) throw new Error(`No se puede quitar una franja horaria que usan grupos. ${enUso}`)

    const antes = {
      fechaInicio: curso.value!.fecha_inicio,
      fechaFin: curso.value!.fecha_fin,
      festivos: festivosARangos((festivosIniciales.value ?? []).map(f => ({ fechaInicio: f.fecha_inicio, fechaFin: f.fecha_fin }))),
      vigencias: vigenciasPorHorarioTipo(vigenciasIniciales.value ?? [])
    }
    const despues = {
      fechaInicio: state.fechaInicio,
      fechaFin: state.fechaFin,
      festivos: festivosARangos(festivos.value),
      vigencias: vigenciasPorHorarioTipo(plan.vigencias)
    }
    if (calendarioAfectaAlReparto(antes, despues)) {
      const previews = await previsualizarCambioCurso(cursoId, despues)
      if (previews.length) {
        planPendiente.value = plan
        previewsRecolocacion.value = previews
        errorRecolocacion.value = ''
        modalRecolocarAbierto.value = true
        return
      }
    }

    await guardarCurso(plan, [])
  } catch (e) {
    errorMessage.value = (e as { message?: string })?.message || 'No se han podido guardar los cambios. Inténtalo de nuevo.'
  } finally {
    guardando.value = false
  }
}

async function confirmarRecolocacion() {
  if (!planPendiente.value) return
  recolocando.value = true
  errorRecolocacion.value = ''
  try {
    await guardarCurso(planPendiente.value, previewsRecolocacion.value)
  } catch (e) {
    // Si falla no se ha guardado nada: la vista previa sigue valiendo y se
    // puede reintentar desde aquí mismo.
    errorRecolocacion.value = (e as { message?: string })?.message || 'No se han podido guardar los cambios. Inténtalo de nuevo.'
  } finally {
    recolocando.value = false
  }
}

// Todo en una transacción (función de Postgres guardar_curso, migración
// 018): o se guardan el curso, sus horarios y el reparto recolocado, o nada.
async function guardarCurso(plan: PlanGuardadoCurso, previews: PreviewGrupoAsignatura[]) {
  const { error } = await supabase.rpc('guardar_curso', {
    p_curso_id: cursoId,
    p_nombre: state.nombre,
    p_fecha_inicio: state.fechaInicio,
    p_fecha_fin: state.fechaFin,
    p_festivos: festivosARangos(festivos.value).map((rango, i) => ({
      nombre: festivos.value[i]!.nombre || null,
      fecha_inicio: rango.inicio,
      fecha_fin: rango.fin
    })),
    p_horarios_tipo: plan.horarios_tipo,
    p_vigencias: plan.vigencias.map(v => ({ ...v })),
    p_periodos: plan.periodos,
    p_horario_tipo_ids_a_borrar: plan.horarioTipoIdsABorrar,
    p_vigencia_ids_a_borrar: plan.vigenciaIdsABorrar,
    p_periodo_ids_a_borrar: plan.periodoIdsABorrar,
    p_recolocaciones: recolocacionesConfirmadas(previews)
  })
  if (error) throw error

  await navigateTo('/dashboard')
}
</script>

<template>
  <UContainer class="py-10">
    <h1 class="mb-6 text-lg font-semibold">
      Editar curso
    </h1>

    <UCard class="mb-6">
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField
          label="Nombre del curso"
          class="sm:col-span-3"
        >
          <UInput
            v-model="state.nombre"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Inicio del curso">
          <UInput
            v-model="state.fechaInicio"
            type="date"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Fin del curso">
          <UInput
            v-model="state.fechaFin"
            type="date"
            class="w-full"
          />
        </UFormField>
      </div>
    </UCard>

    <p
      v-if="!horariosTipo.length"
      class="mb-6 text-sm text-muted"
    >
      No hay horarios tipo añadidos.
    </p>

    <UCard
      v-for="horarioTipo in horariosTipo"
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
            @click="duplicarHorarioTipo(horarioTipo.clienteId)"
          />
          <UTooltip
            :text="motivoEnUso(horarioTipo.periodos.map(p => p.clienteId))"
            :disabled="!motivoEnUso(horarioTipo.periodos.map(p => p.clienteId))"
          >
            <UButton
              :icon="motivoEnUso(horarioTipo.periodos.map(p => p.clienteId)) ? 'i-lucide-lock' : 'i-lucide-trash-2'"
              color="neutral"
              variant="ghost"
              :disabled="Boolean(motivoEnUso(horarioTipo.periodos.map(p => p.clienteId)))"
              :aria-label="motivoEnUso(horarioTipo.periodos.map(p => p.clienteId)) ?? 'Eliminar horario tipo'"
              @click="eliminarHorarioTipo(horarioTipo.clienteId)"
            />
          </UTooltip>
        </div>

        <p class="mt-1 text-xs text-muted">
          Añade un tramo de vigencia por cada época del curso en la que aplique este horario (ej. uno en septiembre y otro en junio). Sin ningún tramo, se aplica todo el curso.
        </p>

        <div class="mt-3 flex flex-col gap-3">
          <div
            v-for="vigencia in horarioTipo.vigencias"
            :key="vigencia.clienteId"
            class="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"
          >
            <UFormField label="Desde">
              <UInput
                v-model="vigencia.fechaInicio"
                type="date"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Hasta">
              <UInput
                v-model="vigencia.fechaFin"
                type="date"
                class="w-full"
              />
            </UFormField>

            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              aria-label="Eliminar tramo de vigencia"
              @click="eliminarVigencia(horarioTipo.clienteId, vigencia.clienteId)"
            />
          </div>

          <UButton
            icon="i-lucide-plus"
            color="neutral"
            variant="subtle"
            size="sm"
            class="self-start"
            @click="agregarVigencia(horarioTipo.clienteId)"
          >
            Añadir tramo de vigencia
          </UButton>
        </div>
      </template>

      <div class="flex flex-col gap-4">
        <p
          v-if="!horarioTipo.periodos.length"
          class="text-sm text-muted"
        >
          No hay franjas añadidas.
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

          <UTooltip
            :text="motivoEnUso([periodo.clienteId])"
            :disabled="!motivoEnUso([periodo.clienteId])"
          >
            <UButton
              :icon="motivoEnUso([periodo.clienteId]) ? 'i-lucide-lock' : 'i-lucide-trash-2'"
              color="neutral"
              variant="ghost"
              :disabled="Boolean(motivoEnUso([periodo.clienteId]))"
              :aria-label="motivoEnUso([periodo.clienteId]) ?? 'Eliminar franja'"
              @click="eliminarPeriodo(horarioTipo.clienteId, periodo.clienteId)"
            />
          </UTooltip>
        </div>

        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          class="self-start"
          @click="agregarPeriodo(horarioTipo.clienteId)"
        >
          Añadir franja horaria
        </UButton>
      </div>
    </UCard>

    <UButton
      icon="i-lucide-plus"
      variant="subtle"
      class="mb-8"
      @click="agregarHorarioTipo()"
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
          v-if="!festivos.length"
          class="text-sm text-muted"
        >
          No hay festivos añadidos.
        </p>

        <div
          v-for="festivo in festivos"
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
            @click="eliminarFestivo(festivo.clienteId)"
          />
        </div>

        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          class="self-start"
          @click="agregarFestivo()"
        >
          Añadir festivo
        </UButton>
      </div>
    </UCard>

    <UAlert
      v-if="!horariosTipoValidos"
      color="error"
      variant="subtle"
      title="Completa el nombre y las horas de inicio/fin de todos los horarios y franjas antes de guardar."
      class="mb-6"
    />

    <UAlert
      v-if="!festivosValidos"
      color="error"
      variant="subtle"
      title="Completa las fechas de todos los festivos: la de fin no puede ser anterior a la de inicio."
      class="mb-6"
    />

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
      class="mb-6"
    />

    <div class="flex justify-between">
      <UButton
        to="/dashboard"
        color="neutral"
        variant="ghost"
        leading-icon="i-lucide-arrow-left"
        :disabled="guardando"
      >
        Cancelar
      </UButton>

      <UButton
        :disabled="!horariosTipoValidos || !festivosValidos"
        :loading="guardando"
        @click="guardar"
      >
        Guardar cambios
      </UButton>
    </div>

    <UModal
      v-model:open="modalRecolocarAbierto"
      title="Recolocar el reparto"
      :dismissible="!recolocando"
    >
      <template #body>
        <div class="flex flex-col gap-4">
          <p class="text-sm text-muted">
            El calendario del curso ha cambiado. Con el calendario nuevo, las sesiones quedarán así a partir de hoy.
            Las sesiones anteriores y las ya impartidas no se tocan.
          </p>
          <ResumenRedistribucion :previews="previewsRecolocacion" />
          <UAlert
            v-if="errorRecolocacion"
            color="error"
            variant="subtle"
            :title="errorRecolocacion"
          />
        </div>
      </template>

      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="recolocando"
          @click="modalRecolocarAbierto = false"
        >
          Seguir editando
        </UButton>
        <UButton
          :loading="recolocando"
          @click="confirmarRecolocacion"
        >
          Guardar y recolocar
        </UButton>
      </template>
    </UModal>
  </UContainer>
</template>
