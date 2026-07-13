<script setup lang="ts">
const route = useRoute()
const grupoAsignaturaId = route.params.grupoAsignaturaId as string

const supabase = useSupabaseClient()
const { generar, eliminarTodas } = useReparto()

const { data: ga } = await useAsyncData(`reparto-ga-${grupoAsignaturaId}`, async () => {
  const { data } = await supabase
    .from('grupo_asignaturas')
    .select('id, grupo_id, asignatura_id')
    .eq('id', grupoAsignaturaId)
    .single()
  return data
})

if (!ga.value) {
  throw createError({ statusCode: 404, statusMessage: 'No encontrado' })
}

const { data: grupo } = await useAsyncData(`reparto-grupo-${grupoAsignaturaId}`, async () => {
  const { data } = await supabase.from('grupos').select('nombre').eq('id', ga.value!.grupo_id).single()
  return data
})

const { data: asignatura } = await useAsyncData(`reparto-asignatura-${grupoAsignaturaId}`, async () => {
  const { data } = await supabase.from('asignaturas').select('nombre').eq('id', ga.value!.asignatura_id).single()
  return data
})

const { data: franjaIds } = await useAsyncData(`reparto-franjas-${grupoAsignaturaId}`, async () => {
  const { data } = await supabase.from('franjas_horarias').select('id').eq('grupo_asignatura_id', grupoAsignaturaId)
  return (data ?? []).map(f => f.id)
})

const { data: sesiones } = await useAsyncData(`reparto-sesiones-${grupoAsignaturaId}`, async () => {
  if (!franjaIds.value?.length) return []
  const { data } = await supabase
    .from('sesiones')
    .select('id, fecha, estado')
    .in('franja_horaria_id', franjaIds.value)
    .order('fecha', { ascending: true })
  return data ?? []
})

const { data: sesionSubtemas } = await useAsyncData(`reparto-sesion-subtemas-${grupoAsignaturaId}`, async () => {
  const sesionIds = (sesiones.value ?? []).map(s => s.id)
  if (!sesionIds.length) return []
  const { data } = await supabase
    .from('sesion_subtemas')
    .select('sesion_id, subtema_id, fraccion')
    .in('sesion_id', sesionIds)
  return data ?? []
})

const { data: subtemas } = await useAsyncData(`reparto-subtemas-${grupoAsignaturaId}`, async () => {
  const { data: temas } = await supabase.from('temas').select('id').eq('asignatura_id', ga.value!.asignatura_id)
  const temaIds = (temas ?? []).map(t => t.id)
  if (!temaIds.length) return []
  const { data } = await supabase.from('subtemas').select('id, nombre').in('tema_id', temaIds)
  return data ?? []
})

function nombreSubtema(id: string) {
  return subtemas.value?.find(s => s.id === id)?.nombre ?? ''
}

function subtemasDeSesion(sesionId: string) {
  return (sesionSubtemas.value ?? []).filter(ss => ss.sesion_id === sesionId)
}

const etiquetaEstado: Record<string, string> = {
  propuesta: 'Propuesta',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  impartida: 'Impartida'
}

const generando = ref(false)
const eliminando = ref(false)
const confirmando = ref(false)
const mensaje = ref('')
const errorMessage = ref('')

async function onGenerar() {
  generando.value = true
  errorMessage.value = ''
  mensaje.value = ''
  try {
    if (sesiones.value?.length) {
      await eliminarTodas(grupoAsignaturaId)
    }
    const resultado = await generar(grupoAsignaturaId)
    await refreshNuxtData()
    mensaje.value = `Se han creado ${resultado.sesionesCreadas} sesiones.`
      + (resultado.subtemasNoAsignados.length
        ? ` No han cabido en el curso: ${resultado.subtemasNoAsignados.join(', ')}.`
        : '')
  } catch (e) {
    errorMessage.value = (e as { message?: string })?.message || 'No se ha podido generar el reparto.'
  } finally {
    generando.value = false
  }
}

async function onEliminar() {
  if (!confirm('¿Eliminar todas las sesiones generadas para esta asignatura y grupo?')) return

  eliminando.value = true
  errorMessage.value = ''
  mensaje.value = ''
  try {
    await eliminarTodas(grupoAsignaturaId)
    await refreshNuxtData()
  } catch (e) {
    errorMessage.value = (e as { message?: string })?.message || 'No se ha podido eliminar el reparto.'
  } finally {
    eliminando.value = false
  }
}

async function onConfirmarTodas() {
  confirmando.value = true
  errorMessage.value = ''
  try {
    const ids = (sesiones.value ?? []).filter(s => s.estado === 'propuesta').map(s => s.id)
    if (ids.length) {
      const { error } = await supabase.from('sesiones').update({ estado: 'confirmada' }).in('id', ids)
      if (error) throw error
    }
    await refreshNuxtData()
  } catch (e) {
    errorMessage.value = (e as { message?: string })?.message || 'No se han podido confirmar las sesiones.'
  } finally {
    confirmando.value = false
  }
}
</script>

<template>
  <UContainer class="py-10">
    <h1 class="mb-2 text-lg font-semibold">
      Reparto del temario
    </h1>
    <p class="mb-6 text-sm text-muted">
      {{ asignatura?.nombre }} · {{ grupo?.nombre }}
    </p>

    <UAlert
      v-if="mensaje"
      color="success"
      variant="subtle"
      :title="mensaje"
      class="mb-6"
    />
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
      class="mb-6"
    />

    <div class="mb-6 flex flex-wrap gap-3">
      <UButton
        :loading="generando"
        @click="onGenerar"
      >
        {{ sesiones?.length ? 'Regenerar reparto' : 'Generar reparto' }}
      </UButton>

      <UButton
        v-if="sesiones?.length"
        color="neutral"
        variant="subtle"
        :loading="confirmando"
        @click="onConfirmarTodas"
      >
        Confirmar todas las propuestas
      </UButton>

      <UButton
        v-if="sesiones?.length"
        color="error"
        variant="subtle"
        :loading="eliminando"
        @click="onEliminar"
      >
        Eliminar reparto
      </UButton>
    </div>

    <p
      v-if="!sesiones?.length"
      class="text-sm text-muted"
    >
      Todavía no se ha generado el reparto para esta asignatura y grupo.
    </p>

    <UCard v-else>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-muted">
              <th class="p-2">
                Fecha
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
              <td class="p-2">
                <template
                  v-for="(ss, i) in subtemasDeSesion(sesion.id)"
                  :key="ss.subtema_id"
                >
                  {{ nombreSubtema(ss.subtema_id) }}<span v-if="ss.fraccion < 1"> (½)</span><span v-if="i < subtemasDeSesion(sesion.id).length - 1">, </span>
                </template>
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
    </UCard>

    <div class="mt-6">
      <UButton
        to="/dashboard"
        color="neutral"
        variant="ghost"
        leading-icon="i-lucide-arrow-left"
      >
        Volver
      </UButton>
    </div>
  </UContainer>
</template>
