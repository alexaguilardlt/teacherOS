<script setup lang="ts">
const route = useRoute()
const grupoId = route.params.id as string

const supabase = useSupabaseClient()

const { data: grupo } = await useAsyncData(`grupo-${grupoId}`, async () => {
  const { data } = await supabase
    .from('grupos')
    .select('id, nombre, color, curso_id')
    .eq('id', grupoId)
    .single()
  return data
})

if (!grupo.value) {
  throw createError({ statusCode: 404, statusMessage: 'Grupo no encontrado' })
}

const { data: asignaturas } = await useAsyncData('grupo-edit-asignaturas', async () => {
  const { data } = await supabase
    .from('asignaturas')
    .select('id, nombre')
    .order('creado_en', { ascending: false })
  return data ?? []
})

const { data: horariosTipoBase } = await useAsyncData(`grupo-${grupoId}-horarios-tipo`, async () => {
  const { data } = await supabase
    .from('horarios_tipo')
    .select('id, nombre')
    .eq('curso_id', grupo.value!.curso_id)
    .order('creado_en', { ascending: true })
  return data ?? []
})

const htIds = (horariosTipoBase.value ?? []).map(ht => ht.id)

const { data: vigenciasHorariosTipo } = await useAsyncData(`grupo-${grupoId}-vigencias`, async () => {
  if (!htIds.length) return []
  const { data } = await supabase
    .from('horario_tipo_vigencias')
    .select('horario_tipo_id, fecha_inicio, fecha_fin')
    .in('horario_tipo_id', htIds)
  return data ?? []
})

const horariosTipo = computed(() =>
  (horariosTipoBase.value ?? []).map(ht => ({
    ...ht,
    vigencias: (vigenciasHorariosTipo.value ?? []).filter(v => v.horario_tipo_id === ht.id)
  }))
)

const { data: periodos } = await useAsyncData(`grupo-${grupoId}-periodos`, async () => {
  if (!htIds.length) return []
  const { data } = await supabase
    .from('periodos_horarios')
    .select('id, horario_tipo_id, hora_inicio, hora_fin')
    .in('horario_tipo_id', htIds)
    .order('orden', { ascending: true })
  return data ?? []
})

const { data: grupoAsignaturasIniciales } = await useAsyncData(`grupo-${grupoId}-grupo-asignaturas`, async () => {
  const { data } = await supabase
    .from('grupo_asignaturas')
    .select('id, asignatura_id')
    .eq('grupo_id', grupoId)
  return data ?? []
})

const gaIds = (grupoAsignaturasIniciales.value ?? []).map(ga => ga.id)

const { data: franjasIniciales } = await useAsyncData(`grupo-${grupoId}-franjas`, async () => {
  if (!gaIds.length) return []
  const { data } = await supabase
    .from('franjas_horarias')
    .select('id, grupo_asignatura_id, dia_semana, periodo_id')
    .in('grupo_asignatura_id', gaIds)
  return data ?? []
})

const nombre = ref(grupo.value.nombre)
const color = ref(grupo.value.color)

const seleccionInicial = (grupoAsignaturasIniciales.value ?? []).map(ga => ({
  asignaturaId: ga.asignatura_id,
  franjas: (franjasIniciales.value ?? [])
    .filter(franja => franja.grupo_asignatura_id === ga.id)
    .map(franja => ({
      clienteId: crypto.randomUUID(),
      diaSemana: franja.dia_semana,
      periodoId: franja.periodo_id
    }))
}))

const { seleccion, seleccionDe, alternarAsignatura, agregarFranja, eliminarFranja, opcionesPeriodo, haySolape }
  = useSeleccionAsignaturas(periodos, horariosTipo, seleccionInicial)

function grupoAsignaturaGuardadaId(asignaturaId: string) {
  return grupoAsignaturasIniciales.value?.find(ga => ga.asignatura_id === asignaturaId)?.id
}

const guardando = ref(false)
const errorMessage = ref('')

async function guardar() {
  guardando.value = true
  errorMessage.value = ''

  try {
    const { error: errorGrupo } = await supabase
      .from('grupos')
      .update({ nombre: nombre.value, color: color.value })
      .eq('id', grupoId)
    if (errorGrupo) throw errorGrupo

    const { error: errorBorrar } = await supabase
      .from('grupo_asignaturas')
      .delete()
      .eq('grupo_id', grupoId)
    if (errorBorrar) throw errorBorrar

    for (const s of seleccion.value) {
      const { data: gaInsertada, error: errorGa } = await supabase
        .from('grupo_asignaturas')
        .insert({ grupo_id: grupoId, asignatura_id: s.asignaturaId })
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
    errorMessage.value = (e as { message?: string })?.message || 'No se han podido guardar los cambios. Inténtalo de nuevo.'
  } finally {
    guardando.value = false
  }
}

const eliminando = ref(false)

async function eliminarGrupo() {
  if (!confirm('¿Eliminar este grupo y sus horarios?')) return

  eliminando.value = true
  const { error } = await supabase.from('grupos').delete().eq('id', grupoId)
  eliminando.value = false

  if (error) {
    errorMessage.value = 'No se ha podido eliminar el grupo.'
    return
  }

  await navigateTo('/dashboard')
}
</script>

<template>
  <UContainer class="py-10">
    <h1 class="mb-6 text-lg font-semibold">
      Editar grupo
    </h1>

    <UCard class="mb-6">
      <div class="flex items-end gap-3">
        <UFormField
          label="Nombre del grupo"
          class="flex-1"
        >
          <UInput
            v-model="nombre"
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
      <div class="flex items-center justify-between">
        <UCheckbox
          :model-value="Boolean(seleccionDe(asignatura.id))"
          :label="asignatura.nombre"
          @update:model-value="alternarAsignatura(asignatura.id)"
        />

        <NuxtLink
          v-if="grupoAsignaturaGuardadaId(asignatura.id)"
          :to="`/reparto/${grupoAsignaturaGuardadaId(asignatura.id)}`"
          class="text-primary text-sm"
        >
          Ver reparto →
        </NuxtLink>
      </div>

      <div
        v-if="seleccionDe(asignatura.id)"
        class="mt-3 flex flex-col gap-2 pl-6"
      >
        <p
          v-if="!opcionesPeriodo.length"
          class="text-sm text-muted"
        >
          Este curso todavía no tiene ningún horario tipo. Añade uno desde
          la ficha del curso para poder fijar días y horas.
        </p>

        <template v-else>
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
        </template>
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
        :disabled="guardando || eliminando"
      >
        Cancelar
      </UButton>

      <div class="flex gap-3">
        <UButton
          color="error"
          variant="subtle"
          :loading="eliminando"
          @click="eliminarGrupo"
        >
          Eliminar grupo
        </UButton>

        <UButton
          :disabled="haySolape"
          :loading="guardando"
          @click="guardar"
        >
          Guardar cambios
        </UButton>
      </div>
    </div>
  </UContainer>
</template>
