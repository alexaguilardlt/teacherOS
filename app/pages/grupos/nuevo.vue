<script setup lang="ts">
const user = useSupabaseUser()
const supabase = useSupabaseClient()

const { data: cursos } = await useAsyncData('grupo-nuevo-cursos', async () => {
  const { data } = await supabase
    .from('cursos')
    .select('id, nombre')
    .order('creado_en', { ascending: false })
  return data ?? []
})

if (!cursos.value?.length) {
  throw createError({ statusCode: 404, statusMessage: 'Todavía no tienes ningún curso creado' })
}

const cursoId = ref(cursos.value[0]!.id)

const opcionesCurso = computed(() =>
  (cursos.value ?? []).map(curso => ({ label: curso.nombre, value: curso.id }))
)

const { data: horariosTipo } = await useAsyncData('grupo-nuevo-horarios-tipo', async () => {
  const { data } = await supabase
    .from('horarios_tipo')
    .select('id, curso_id, nombre')
    .order('creado_en', { ascending: true })
  return data ?? []
})

const { data: periodos } = await useAsyncData('grupo-nuevo-periodos', async () => {
  const htIds = (horariosTipo.value ?? []).map(ht => ht.id)
  if (!htIds.length) return []
  const { data } = await supabase
    .from('periodos_horarios')
    .select('id, horario_tipo_id, hora_inicio, hora_fin')
    .in('horario_tipo_id', htIds)
    .order('orden', { ascending: true })
  return data ?? []
})

const { data: asignaturas } = await useAsyncData('grupo-nuevo-asignaturas', async () => {
  const { data } = await supabase
    .from('asignaturas')
    .select('id, nombre')
    .order('creado_en', { ascending: false })
  return data ?? []
})

const horarioTipoId = ref('')

watch(cursoId, () => {
  horarioTipoId.value = ''
})

const opcionesHorarioTipo = computed(() =>
  (horariosTipo.value ?? [])
    .filter(ht => ht.curso_id === cursoId.value)
    .map(ht => ({ label: ht.nombre, value: ht.id }))
)

const nombre = ref('')
const color = ref('#3b82f6')

const { seleccion, seleccionDe, alternarAsignatura, agregarFranja, eliminarFranja, opcionesPeriodo, haySolape }
  = useSeleccionAsignaturas(horarioTipoId, periodos)

const guardando = ref(false)
const errorMessage = ref('')

async function guardar() {
  if (!user.value) return

  guardando.value = true
  errorMessage.value = ''

  try {
    const { data: grupoInsertado, error: errorGrupo } = await supabase
      .from('grupos')
      .insert({
        profesor_id: user.value.sub,
        curso_id: cursoId.value,
        nombre: nombre.value,
        color: color.value,
        horario_tipo_id: horarioTipoId.value || null
      })
      .select('id')
      .single()
    if (errorGrupo || !grupoInsertado) throw errorGrupo ?? new Error('grupo')

    for (const s of seleccion.value) {
      const { data: gaInsertada, error: errorGa } = await supabase
        .from('grupo_asignaturas')
        .insert({ grupo_id: grupoInsertado.id, asignatura_id: s.asignaturaId })
        .select('id')
        .single()
      if (errorGa || !gaInsertada) throw errorGa ?? new Error('grupo_asignatura')

      if (s.franjas.length) {
        const { error: errorFranjas } = await supabase
          .from('franjas_horarias')
          .insert(s.franjas.map(franja => ({
            grupo_asignatura_id: gaInsertada.id,
            dia_semana: franja.diaSemana,
            periodo_id: franja.periodoId
          })))
        if (errorFranjas) throw errorFranjas
      }
    }

    await navigateTo('/dashboard')
  } catch (e) {
    errorMessage.value = (e as { message?: string })?.message || 'No se ha podido crear el grupo. Inténtalo de nuevo.'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <UContainer class="py-10">
    <h1 class="mb-6 text-lg font-semibold">
      Nuevo grupo
    </h1>

    <UCard class="mb-6">
      <UFormField
        label="Curso"
        class="mb-3"
      >
        <USelect
          v-model="cursoId"
          :items="opcionesCurso"
          value-key="value"
          class="w-full"
        />
      </UFormField>

      <div class="flex items-end gap-3">
        <UFormField
          label="Nombre del grupo"
          class="flex-1"
        >
          <UInput
            v-model="nombre"
            placeholder="1º ESO A"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Color">
          <input
            v-model="color"
            type="color"
            class="h-9 w-14 cursor-pointer rounded border border-default bg-transparent"
          >
        </UFormField>
      </div>

      <UFormField
        label="Horario que sigue este grupo"
        class="mt-3"
      >
        <USelect
          v-model="horarioTipoId"
          :items="opcionesHorarioTipo"
          value-key="value"
          class="w-full"
        />
      </UFormField>
    </UCard>

    <p
      v-if="!asignaturas?.length"
      class="mb-4 text-sm text-muted"
    >
      No tienes asignaturas todavía.
    </p>

    <div
      v-for="asignatura in asignaturas"
      :key="asignatura.id"
      class="mb-4 rounded-lg border border-default p-4"
    >
      <UCheckbox
        :model-value="Boolean(seleccionDe(asignatura.id))"
        :label="asignatura.nombre"
        @update:model-value="alternarAsignatura(asignatura.id)"
      />

      <div
        v-if="seleccionDe(asignatura.id)"
        class="mt-3 flex flex-col gap-2 pl-6"
      >
        <div
          v-for="franja in seleccionDe(asignatura.id)!.franjas"
          :key="franja.clienteId"
          class="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <UFormField label="Día">
            <USelect
              v-model="franja.diaSemana"
              :items="OPCIONES_DIA"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Franja horaria">
            <USelect
              v-model="franja.periodoId"
              :items="opcionesPeriodo"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            aria-label="Eliminar franja horaria"
            @click="eliminarFranja(asignatura.id, franja.clienteId)"
          />
        </div>

        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          size="sm"
          class="self-start"
          @click="agregarFranja(asignatura.id)"
        >
          Añadir franja horaria
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="haySolape"
      color="error"
      variant="subtle"
      title="Hay franjas horarias que se solapan el mismo día en este grupo. Revísalas antes de guardar."
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
        :disabled="haySolape || !nombre || !horarioTipoId"
        :loading="guardando"
        @click="guardar"
      >
        Crear grupo
      </UButton>
    </div>
  </UContainer>
</template>
