<script setup lang="ts">
const route = useRoute()
const cursoId = route.params.id as string

const supabase = useSupabaseClient()

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

const horariosTipo = ref((horariosTipoIniciales.value ?? []).map(ht => ({
  id: ht.id as string | null,
  clienteId: crypto.randomUUID(),
  nombre: ht.nombre,
  vigencias: (vigenciasIniciales.value ?? [])
    .filter(v => v.horario_tipo_id === ht.id)
    .map(v => ({
      id: v.id as string | null,
      clienteId: crypto.randomUUID(),
      fechaInicio: v.fecha_inicio,
      fechaFin: v.fecha_fin
    })),
  periodos: (periodosIniciales.value ?? [])
    .filter(periodo => periodo.horario_tipo_id === ht.id)
    .map(periodo => ({
      id: periodo.id as string | null,
      clienteId: crypto.randomUUID(),
      horaInicio: periodo.hora_inicio,
      horaFin: periodo.hora_fin
    }))
})))

function agregarHorarioTipo() {
  horariosTipo.value.push({
    id: null,
    clienteId: crypto.randomUUID(),
    nombre: '',
    vigencias: [],
    periodos: []
  })
}

function eliminarHorarioTipo(clienteId: string) {
  horariosTipo.value = horariosTipo.value.filter(ht => ht.clienteId !== clienteId)
}

// Copia las franjas horarias a un horario tipo nuevo (sin id ni vigencias),
// por si el profesor prefiere seguir usando horarios separados para épocas
// distintas en vez de añadir varios tramos al mismo horario.
function duplicarHorarioTipo(clienteId: string) {
  const original = horariosTipo.value.find(ht => ht.clienteId === clienteId)
  if (!original) return
  horariosTipo.value.push({
    id: null,
    clienteId: crypto.randomUUID(),
    nombre: `${original.nombre} (copia)`,
    vigencias: [],
    periodos: original.periodos.map(periodo => ({
      id: null,
      clienteId: crypto.randomUUID(),
      horaInicio: periodo.horaInicio,
      horaFin: periodo.horaFin
    }))
  })
}

function agregarVigencia(horarioTipoClienteId: string) {
  const ht = horariosTipo.value.find(h => h.clienteId === horarioTipoClienteId)
  ht?.vigencias.push({ id: null, clienteId: crypto.randomUUID(), fechaInicio: '', fechaFin: '' })
}

function eliminarVigencia(horarioTipoClienteId: string, vigenciaClienteId: string) {
  const ht = horariosTipo.value.find(h => h.clienteId === horarioTipoClienteId)
  if (!ht) return
  ht.vigencias = ht.vigencias.filter(v => v.clienteId !== vigenciaClienteId)
}

function agregarPeriodo(horarioTipoClienteId: string) {
  const ht = horariosTipo.value.find(h => h.clienteId === horarioTipoClienteId)
  ht?.periodos.push({ id: null, clienteId: crypto.randomUUID(), horaInicio: '', horaFin: '' })
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

async function guardar() {
  guardando.value = true
  errorMessage.value = ''

  try {
    const { error: errorCurso } = await supabase
      .from('cursos')
      .update({
        nombre: state.nombre,
        fecha_inicio: state.fechaInicio,
        fecha_fin: state.fechaFin
      })
      .eq('id', cursoId)
    if (errorCurso) throw errorCurso

    const { error: errorBorrar } = await supabase
      .from('dias_no_lectivos')
      .delete()
      .eq('curso_id', cursoId)
    if (errorBorrar) throw errorBorrar

    if (festivos.value.length) {
      const { error: errorFestivos } = await supabase
        .from('dias_no_lectivos')
        .insert(festivos.value.map(festivo => ({
          curso_id: cursoId,
          nombre: festivo.nombre || null,
          fecha_inicio: festivo.fechaInicio,
          fecha_fin: festivo.fechaFin || festivo.fechaInicio
        })))
      if (errorFestivos) throw errorFestivos
    }

    // Los horarios tipo y sus períodos se actualizan en vez de
    // borrar-y-recrear: si se recreasen con un id nuevo, los grupos
    // que ya siguen ese horario, o las franjas que ya usan ese
    // período (FKs con ON DELETE CASCADE / SET NULL), se romperían.
    const idsOriginalesHT = new Set((horariosTipoIniciales.value ?? []).map(ht => ht.id))
    const idsActualesHT = new Set(horariosTipo.value.filter(ht => ht.id).map(ht => ht.id as string))
    const idsAEliminarHT = [...idsOriginalesHT].filter(id => !idsActualesHT.has(id))

    if (idsAEliminarHT.length) {
      const { error: errorEliminarHT } = await supabase
        .from('horarios_tipo')
        .delete()
        .in('id', idsAEliminarHT)
      if (errorEliminarHT) throw errorEliminarHT
    }

    for (const horarioTipo of horariosTipo.value) {
      let horarioTipoId = horarioTipo.id

      if (horarioTipoId) {
        const { error: errorActualizarHT } = await supabase
          .from('horarios_tipo')
          .update({ nombre: horarioTipo.nombre })
          .eq('id', horarioTipoId)
        if (errorActualizarHT) throw errorActualizarHT
      } else {
        const { data: htInsertado, error: errorNuevoHT } = await supabase
          .from('horarios_tipo')
          .insert({
            curso_id: cursoId,
            nombre: horarioTipo.nombre
          })
          .select('id')
          .single()
        if (errorNuevoHT || !htInsertado) throw errorNuevoHT ?? new Error('horario_tipo')
        horarioTipoId = htInsertado.id
      }

      const idsOriginalesV = new Set(
        (vigenciasIniciales.value ?? []).filter(v => v.horario_tipo_id === horarioTipo.id).map(v => v.id)
      )
      const idsActualesV = new Set(horarioTipo.vigencias.filter(v => v.id).map(v => v.id as string))
      const idsAEliminarV = [...idsOriginalesV].filter(id => !idsActualesV.has(id))

      if (idsAEliminarV.length) {
        const { error: errorEliminarV } = await supabase
          .from('horario_tipo_vigencias')
          .delete()
          .in('id', idsAEliminarV)
        if (errorEliminarV) throw errorEliminarV
      }

      for (const vigencia of horarioTipo.vigencias) {
        if (vigencia.id) {
          const { error: errorActualizarVigencia } = await supabase
            .from('horario_tipo_vigencias')
            .update({ fecha_inicio: vigencia.fechaInicio, fecha_fin: vigencia.fechaFin })
            .eq('id', vigencia.id)
          if (errorActualizarVigencia) throw errorActualizarVigencia
        } else {
          const { error: errorNuevaVigencia } = await supabase
            .from('horario_tipo_vigencias')
            .insert({
              horario_tipo_id: horarioTipoId,
              fecha_inicio: vigencia.fechaInicio,
              fecha_fin: vigencia.fechaFin
            })
          if (errorNuevaVigencia) throw errorNuevaVigencia
        }
      }

      const idsOriginalesP = new Set(
        (periodosIniciales.value ?? []).filter(p => p.horario_tipo_id === horarioTipo.id).map(p => p.id)
      )
      const idsActualesP = new Set(horarioTipo.periodos.filter(p => p.id).map(p => p.id as string))
      const idsAEliminarP = [...idsOriginalesP].filter(id => !idsActualesP.has(id))

      if (idsAEliminarP.length) {
        const { error: errorEliminarP } = await supabase
          .from('periodos_horarios')
          .delete()
          .in('id', idsAEliminarP)
        if (errorEliminarP) throw errorEliminarP
      }

      for (const [periodoIndex, periodo] of horarioTipo.periodos.entries()) {
        if (periodo.id) {
          const { error: errorActualizarPeriodo } = await supabase
            .from('periodos_horarios')
            .update({ hora_inicio: periodo.horaInicio, hora_fin: periodo.horaFin, orden: periodoIndex })
            .eq('id', periodo.id)
          if (errorActualizarPeriodo) throw errorActualizarPeriodo
        } else {
          const { error: errorNuevoPeriodo } = await supabase
            .from('periodos_horarios')
            .insert({
              horario_tipo_id: horarioTipoId,
              hora_inicio: periodo.horaInicio,
              hora_fin: periodo.horaFin,
              orden: periodoIndex
            })
          if (errorNuevoPeriodo) throw errorNuevoPeriodo
        }
      }
    }

    await navigateTo('/dashboard')
  } catch (e) {
    errorMessage.value = (e as { message?: string })?.message || 'No se han podido guardar los cambios. Inténtalo de nuevo.'
  } finally {
    guardando.value = false
  }
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
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            aria-label="Eliminar horario tipo"
            @click="eliminarHorarioTipo(horarioTipo.clienteId)"
          />
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

          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            aria-label="Eliminar franja"
            @click="eliminarPeriodo(horarioTipo.clienteId, periodo.clienteId)"
          />
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
  </UContainer>
</template>
