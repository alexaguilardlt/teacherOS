<script setup lang="ts">
const route = useRoute()
const asignaturaId = route.params.id as string

const supabase = useSupabaseClient()

const opcionesDificultad = [
  { label: 'Baja', value: 'baja' },
  { label: 'Media', value: 'media' },
  { label: 'Alta', value: 'alta' }
]

const { data: asignatura } = await useAsyncData(`asignatura-${asignaturaId}`, async () => {
  const { data } = await supabase
    .from('asignaturas')
    .select('id, nombre')
    .eq('id', asignaturaId)
    .single()
  return data
})

if (!asignatura.value) {
  throw createError({ statusCode: 404, statusMessage: 'Asignatura no encontrada' })
}

const { data: temasIniciales } = await useAsyncData(`asignatura-${asignaturaId}-temas`, async () => {
  const { data } = await supabase
    .from('temas')
    .select('id, nombre, orden')
    .eq('asignatura_id', asignaturaId)
    .order('orden', { ascending: true })
  return data ?? []
})

const temaIds = (temasIniciales.value ?? []).map(tema => tema.id)

const { data: subtemasIniciales } = await useAsyncData(`asignatura-${asignaturaId}-subtemas`, async () => {
  if (!temaIds.length) return []
  const { data } = await supabase
    .from('subtemas')
    .select('id, tema_id, nombre, dificultad, orden')
    .in('tema_id', temaIds)
    .order('orden', { ascending: true })
  return data ?? []
})

const nombre = ref(asignatura.value.nombre)

const temas = ref((temasIniciales.value ?? []).map(tema => ({
  clienteId: crypto.randomUUID(),
  nombre: tema.nombre,
  subtemas: (subtemasIniciales.value ?? [])
    .filter(subtema => subtema.tema_id === tema.id)
    .map(subtema => ({
      clienteId: crypto.randomUUID(),
      nombre: subtema.nombre,
      dificultad: subtema.dificultad as 'baja' | 'media' | 'alta'
    }))
})))

function agregarTema() {
  temas.value.push({ clienteId: crypto.randomUUID(), nombre: '', subtemas: [] })
}

function eliminarTema(temaClienteId: string) {
  temas.value = temas.value.filter(tema => tema.clienteId !== temaClienteId)
}

function agregarSubtema(temaClienteId: string) {
  const tema = temas.value.find(t => t.clienteId === temaClienteId)
  tema?.subtemas.push({ clienteId: crypto.randomUUID(), nombre: '', dificultad: 'media' })
}

function eliminarSubtema(temaClienteId: string, subtemaClienteId: string) {
  const tema = temas.value.find(t => t.clienteId === temaClienteId)
  if (!tema) return
  tema.subtemas = tema.subtemas.filter(subtema => subtema.clienteId !== subtemaClienteId)
}

const guardando = ref(false)
const errorMessage = ref('')

async function guardar() {
  guardando.value = true
  errorMessage.value = ''

  try {
    const { error: errorAsignatura } = await supabase
      .from('asignaturas')
      .update({ nombre: nombre.value })
      .eq('id', asignaturaId)
    if (errorAsignatura) throw errorAsignatura

    const { error: errorBorrarTemas } = await supabase
      .from('temas')
      .delete()
      .eq('asignatura_id', asignaturaId)
    if (errorBorrarTemas) throw errorBorrarTemas

    for (const [temaIndex, tema] of temas.value.entries()) {
      const { data: temaInsertado, error: errorTema } = await supabase
        .from('temas')
        .insert({ asignatura_id: asignaturaId, nombre: tema.nombre, orden: temaIndex })
        .select('id')
        .single()
      if (errorTema || !temaInsertado) throw errorTema ?? new Error('tema')

      if (tema.subtemas.length) {
        const { error: errorSubtemas } = await supabase
          .from('subtemas')
          .insert(tema.subtemas.map((subtema, subtemaIndex) => ({
            tema_id: temaInsertado.id,
            nombre: subtema.nombre,
            dificultad: subtema.dificultad,
            orden: subtemaIndex
          })))
        if (errorSubtemas) throw errorSubtemas
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

async function eliminarAsignatura() {
  if (!confirm('¿Eliminar esta asignatura? Se borrarán también sus temas y su asignación a grupos.')) return

  eliminando.value = true
  const { error } = await supabase.from('asignaturas').delete().eq('id', asignaturaId)
  eliminando.value = false

  if (error) {
    errorMessage.value = 'No se ha podido eliminar la asignatura.'
    return
  }

  await navigateTo('/dashboard')
}
</script>

<template>
  <UContainer class="py-10">
    <h1 class="mb-6 text-lg font-semibold">
      Editar asignatura
    </h1>

    <UCard class="mb-6">
      <UFormField label="Nombre de la asignatura">
        <UInput
          v-model="nombre"
          class="w-full"
        />
      </UFormField>
    </UCard>

    <p
      v-if="!temas.length"
      class="mb-4 text-sm text-muted"
    >
      Todavía no has añadido ningún tema.
    </p>

    <div
      v-for="tema in temas"
      :key="tema.clienteId"
      class="mb-4 rounded-lg border border-default p-4"
    >
      <div class="mb-3 flex items-end gap-3">
        <UFormField
          label="Tema"
          class="flex-1"
        >
          <UInput
            v-model="tema.nombre"
            placeholder="Nombre del tema"
            class="w-full"
          />
        </UFormField>
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          aria-label="Eliminar tema"
          @click="eliminarTema(tema.clienteId)"
        />
      </div>

      <div class="flex flex-col gap-2 pl-4">
        <div
          v-for="subtema in tema.subtemas"
          :key="subtema.clienteId"
          class="grid items-end gap-3 sm:grid-cols-[1fr_10rem_auto]"
        >
          <UFormField label="Punto del tema">
            <UInput
              v-model="subtema.nombre"
              placeholder="Ecuaciones de primer grado"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Dificultad">
            <USelect
              v-model="subtema.dificultad"
              :items="opcionesDificultad"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            aria-label="Eliminar punto del tema"
            @click="eliminarSubtema(tema.clienteId, subtema.clienteId)"
          />
        </div>

        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="subtle"
          size="sm"
          class="self-start"
          @click="agregarSubtema(tema.clienteId)"
        >
          Añadir punto del tema
        </UButton>
      </div>
    </div>

    <UButton
      icon="i-lucide-plus"
      color="neutral"
      variant="subtle"
      class="mb-8"
      @click="agregarTema()"
    >
      Añadir tema
    </UButton>

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
          @click="eliminarAsignatura"
        >
          Eliminar asignatura
        </UButton>

        <UButton
          :loading="guardando"
          @click="guardar"
        >
          Guardar cambios
        </UButton>
      </div>
    </div>
  </UContainer>
</template>
