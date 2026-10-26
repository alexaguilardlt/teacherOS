<script setup lang="ts">
const route = useRoute()
const grupoAsignaturaId = route.params.grupoAsignaturaId as string

const supabase = useSupabaseClient()
const { generar, eliminarTodas } = useReparto()
const { previsualizarUnaAsignatura, previsualizarRecuperarClase, confirmarUnaAsignatura } = useRedistribucion()

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

const { data: sesiones, refresh: refreshSesiones } = await useAsyncData(`reparto-sesiones-${grupoAsignaturaId}`, async () => {
  if (!franjaIds.value?.length) return []
  const { data } = await supabase
    .from('sesiones')
    .select('id, fecha, estado')
    .in('franja_horaria_id', franjaIds.value)
    .order('fecha', { ascending: true })
  return data ?? []
})

const { data: sesionSubtemas, refresh: refreshSesionSubtemas } = await useAsyncData(`reparto-sesion-subtemas-${grupoAsignaturaId}`, async () => {
  const sesionIds = (sesiones.value ?? []).map(s => s.id)
  if (!sesionIds.length) return []
  const { data } = await supabase
    .from('sesion_subtemas')
    .select('sesion_id, subtema_id, fraccion')
    .in('sesion_id', sesionIds)
  return data ?? []
})

// Por asignatura_id y no por tema: los exámenes, repasos y demás elementos
// sueltos no pertenecen a ningún tema y se quedarían sin nombre.
const { data: subtemas } = await useAsyncData(`reparto-subtemas-${grupoAsignaturaId}`, async () => {
  const { data } = await supabase.from('subtemas').select('id, nombre').eq('asignatura_id', ga.value!.asignatura_id)
  return data ?? []
})

// Los enlaces sesión-subtema se piden a partir de las sesiones: si se
// recargan a la vez (refreshNuxtData()), se pedirían con la lista de
// sesiones vieja y las nuevas saldrían sin contenido.
async function recargarSesiones() {
  await refreshSesiones()
  await refreshSesionSubtemas()
}

function nombreSubtema(id: string) {
  return subtemas.value?.find(s => s.id === id)?.nombre ?? ''
}

function subtemasDeSesion(sesionId: string) {
  return (sesionSubtemas.value ?? []).filter(ss => ss.sesion_id === sesionId)
}

// Recuperar una clase saltada por error (o una excursión que al final no se
// hace): ese día vuelve a tener clase y el reparto se recoloca desde ahí.
const hoy = fechaLocalISO()
const modalRecuperarAbierto = ref(false)
const previewRecuperar = ref<PreviewGrupoAsignatura | null>(null)
const fechaARecuperar = ref('')
const recuperandoId = ref<string | null>(null)
const confirmandoRecuperar = ref(false)
const errorRecuperar = ref('')

async function onRecuperar(sesion: { id: string, fecha: string }) {
  recuperandoId.value = sesion.id
  errorMessage.value = ''
  try {
    previewRecuperar.value = await previsualizarRecuperarClase(grupoAsignaturaId, sesion.id)
    fechaARecuperar.value = sesion.fecha
    errorRecuperar.value = ''
    modalRecuperarAbierto.value = true
  } catch (e) {
    errorMessage.value = (e as { message?: string })?.message || 'No se ha podido calcular cómo quedaría el reparto.'
  } finally {
    recuperandoId.value = null
  }
}

async function onConfirmarRecuperar() {
  if (!previewRecuperar.value) return
  confirmandoRecuperar.value = true
  errorRecuperar.value = ''
  try {
    await confirmarUnaAsignatura(previewRecuperar.value)
    modalRecuperarAbierto.value = false
    await recargarSesiones()
  } catch (e) {
    errorRecuperar.value = (e as { message?: string })?.message || 'No se ha podido recuperar la clase.'
  } finally {
    confirmandoRecuperar.value = false
  }
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
    // Si ya había reparto, generar lo sustituye en la misma transacción.
    const resultado = await generar(grupoAsignaturaId)
    await recargarSesiones()
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
    await recargarSesiones()
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
    await recargarSesiones()
  } catch (e) {
    errorMessage.value = (e as { message?: string })?.message || 'No se han podido confirmar las sesiones.'
  } finally {
    confirmando.value = false
  }
}

// Saltar una fecha concreta solo para esta asignatura-grupo: no marca el
// día como no lectivo para el resto del curso (para eso está "marcar día
// no lectivo" en el dashboard).
const modalSaltarAbierto = ref(false)
const fechaASaltar = ref('')
const previewSalto = ref<PreviewGrupoAsignatura | null>(null)
const previsualizandoSalto = ref(false)
const confirmandoSalto = ref(false)
const errorSalto = ref('')

function abrirModalSaltar() {
  fechaASaltar.value = ''
  previewSalto.value = null
  errorSalto.value = ''
  modalSaltarAbierto.value = true
}

async function onPrevisualizarSalto() {
  if (!fechaASaltar.value) return
  previsualizandoSalto.value = true
  errorSalto.value = ''
  previewSalto.value = null
  try {
    const preview = await previsualizarUnaAsignatura(grupoAsignaturaId, fechaASaltar.value)
    if (!preview) {
      errorSalto.value = 'Esta asignatura no tiene clase ese día, no hay nada que redistribuir.'
      return
    }
    previewSalto.value = preview
  } catch (e) {
    errorSalto.value = (e as { message?: string })?.message || 'No se ha podido calcular la redistribución.'
  } finally {
    previsualizandoSalto.value = false
  }
}

async function onConfirmarSalto() {
  if (!previewSalto.value) return
  confirmandoSalto.value = true
  errorSalto.value = ''
  try {
    await confirmarUnaAsignatura(previewSalto.value)
    modalSaltarAbierto.value = false
    await recargarSesiones()
  } catch (e) {
    errorSalto.value = (e as { message?: string })?.message || 'No se ha podido confirmar la redistribución.'
  } finally {
    confirmandoSalto.value = false
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

      <UButton
        v-if="sesiones?.length"
        color="neutral"
        variant="subtle"
        @click="abrirModalSaltar"
      >
        Saltar una fecha (solo esta asignatura)
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
                <div class="flex items-center gap-2">
                  <UBadge
                    :color="sesion.estado === 'confirmada' ? 'success' : 'neutral'"
                    variant="subtle"
                  >
                    {{ etiquetaEstado[sesion.estado] }}
                  </UBadge>
                  <UButton
                    v-if="sesion.estado === 'cancelada' && sesion.fecha >= hoy"
                    icon="i-lucide-undo-2"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :loading="recuperandoId === sesion.id"
                    @click="onRecuperar(sesion)"
                  >
                    Recuperar clase
                  </UButton>
                </div>
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

    <UModal
      v-model:open="modalSaltarAbierto"
      title="Saltar una fecha para esta asignatura"
    >
      <template #body>
        <div class="flex flex-col gap-4">
          <p class="text-sm text-muted">
            Solo se reorganiza esta asignatura-grupo; el resto del curso no se toca.
            Las sesiones ya pasadas se mantienen igual.
          </p>

          <UFormField label="Fecha a saltar">
            <UInput
              v-model="fechaASaltar"
              type="date"
              :min="fechaLocalISO()"
              class="w-full"
            />
          </UFormField>

          <UButton
            :disabled="!fechaASaltar"
            :loading="previsualizandoSalto"
            @click="onPrevisualizarSalto"
          >
            Previsualizar
          </UButton>

          <div v-if="previewSalto">
            <p class="mb-2 text-sm font-medium">
              La clase de ese día queda cancelada, y {{ previewSalto.sesionesAEliminarIds.length }} sesiones futuras se reorganizan en {{ previewSalto.sesionesNuevas.length }} nuevas sesiones.
            </p>
            <p
              v-if="previewSalto.subtemasNoAsignados.length"
              class="text-sm text-warning"
            >
              No caben en el curso: {{ previewSalto.subtemasNoAsignados.join(', ') }}.
            </p>
          </div>

          <UAlert
            v-if="errorSalto"
            color="error"
            variant="subtle"
            :title="errorSalto"
          />
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-between">
          <UButton
            color="neutral"
            variant="ghost"
            @click="modalSaltarAbierto = false"
          >
            Cancelar
          </UButton>
          <UButton
            :disabled="!previewSalto"
            :loading="confirmandoSalto"
            @click="onConfirmarSalto"
          >
            Confirmar
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="modalRecuperarAbierto"
      title="Recuperar la clase"
      :dismissible="!confirmandoRecuperar"
    >
      <template #body>
        <div class="flex flex-col gap-4">
          <p class="text-sm text-muted">
            El {{ fechaARecuperar.split('-').reverse().join('/') }} vuelve a tener clase, y el reparto se recoloca desde ese día.
            Las sesiones anteriores y las ya impartidas no se tocan.
          </p>
          <ResumenRedistribucion
            v-if="previewRecuperar"
            :previews="[previewRecuperar]"
          />
          <UAlert
            v-if="errorRecuperar"
            color="error"
            variant="subtle"
            :title="errorRecuperar"
          />
        </div>
      </template>

      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="confirmandoRecuperar"
          @click="modalRecuperarAbierto = false"
        >
          Cancelar
        </UButton>
        <UButton
          :loading="confirmandoRecuperar"
          @click="onConfirmarRecuperar"
        >
          Recuperar y recolocar
        </UButton>
      </template>
    </UModal>
  </UContainer>
</template>
