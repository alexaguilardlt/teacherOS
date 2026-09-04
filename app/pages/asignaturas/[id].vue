<script setup lang="ts">
import type { ElementoTemarioWizard, TemaWizard, TipoElementoSuelto } from '~/stores/cursoWizard.types'
import { moverEnLista } from '~/utils/listas'

const route = useRoute()
const asignaturaId = route.params.id as string

const supabase = useSupabaseClient()

const etiquetaTipoSuelto: Record<TipoElementoSuelto, string> = {
  repaso: 'Repaso',
  examen: 'Examen',
  exposicion_oral: 'Exposición oral',
  otro: 'Otro'
}

const opcionesTipoSuelto: { tipo: TipoElementoSuelto, etiqueta: string }[] = [
  { tipo: 'repaso', etiqueta: 'Añadir repaso' },
  { tipo: 'examen', etiqueta: 'Añadir examen' },
  { tipo: 'exposicion_oral', etiqueta: 'Añadir exposición oral' },
  { tipo: 'otro', etiqueta: 'Añadir otro' }
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

const { data: subtemasIniciales } = await useAsyncData(`asignatura-${asignaturaId}-subtemas`, async () => {
  const { data } = await supabase
    .from('subtemas')
    .select('id, tema_id, nombre, tipo, duracion_sesiones, orden')
    .eq('asignatura_id', asignaturaId)
    .order('orden', { ascending: true })
  return data ?? []
})

const nombre = ref(asignatura.value.nombre)

// Reconstruye la secuencia única de la asignatura combinando temas.orden y
// subtemas.orden (comparten el mismo contador, ver guardar()): cada tema
// consume su propia posición antes de que empiecen sus subtemas de
// contenido, así que mezclando ambas listas por "orden" se recupera el
// orden exacto en el que se añadieron temas y elementos sueltos.
const contenidoPorTema = new Map<string, NonNullable<typeof subtemasIniciales.value>>()
for (const subtema of (subtemasIniciales.value ?? []).filter(s => s.tipo === 'contenido')) {
  const lista = contenidoPorTema.get(subtema.tema_id!) ?? []
  lista.push(subtema)
  contenidoPorTema.set(subtema.tema_id!, lista)
}

const elementosOrdenables = [
  ...(temasIniciales.value ?? []).map(tema => ({
    orden: tema.orden,
    elemento: {
      clienteId: crypto.randomUUID(),
      clase: 'tema' as const,
      nombre: tema.nombre,
      subtemas: (contenidoPorTema.get(tema.id) ?? [])
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .map(s => ({ clienteId: crypto.randomUUID(), nombre: s.nombre, duracionSesiones: Number(s.duracion_sesiones) })),
      duracionSesiones: 1
    } satisfies ElementoTemarioWizard
  })),
  ...(subtemasIniciales.value ?? []).filter(s => s.tipo !== 'contenido').map(s => ({
    orden: s.orden,
    elemento: {
      clienteId: crypto.randomUUID(),
      clase: 'suelto' as const,
      tipo: s.tipo as TipoElementoSuelto,
      nombre: s.nombre,
      duracionSesiones: Number(s.duracion_sesiones)
    } satisfies ElementoTemarioWizard
  }))
].sort((a, b) => a.orden - b.orden)

const elementos = ref<ElementoTemarioWizard[]>(elementosOrdenables.map(e => e.elemento))

function agregarTema() {
  elementos.value.push({ clienteId: crypto.randomUUID(), clase: 'tema', nombre: '', subtemas: [], duracionSesiones: 1 })
}

function agregarElementoSuelto(tipo: TipoElementoSuelto) {
  elementos.value.push({ clienteId: crypto.randomUUID(), clase: 'suelto', tipo, nombre: '', duracionSesiones: 1 })
}

function eliminarElemento(elementoClienteId: string) {
  elementos.value = elementos.value.filter(elemento => elemento.clienteId !== elementoClienteId)
}

function moverElemento(elementoClienteId: string, direccion: 'arriba' | 'abajo') {
  moverEnLista(elementos.value, elementoClienteId, direccion)
}

function agregarSubtema(temaClienteId: string) {
  const tema = elementos.value.find((e): e is TemaWizard => e.clienteId === temaClienteId && e.clase === 'tema')
  tema?.subtemas.push({ clienteId: crypto.randomUUID(), nombre: '', duracionSesiones: 1 })
}

function eliminarSubtema(temaClienteId: string, subtemaClienteId: string) {
  const tema = elementos.value.find((e): e is TemaWizard => e.clienteId === temaClienteId && e.clase === 'tema')
  if (!tema) return
  tema.subtemas = tema.subtemas.filter(subtema => subtema.clienteId !== subtemaClienteId)
}

function moverSubtema(temaClienteId: string, subtemaClienteId: string, direccion: 'arriba' | 'abajo') {
  const tema = elementos.value.find((e): e is TemaWizard => e.clienteId === temaClienteId && e.clase === 'tema')
  if (!tema) return
  moverEnLista(tema.subtemas, subtemaClienteId, direccion)
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

    const { error: errorBorrarSubtemas } = await supabase
      .from('subtemas')
      .delete()
      .eq('asignatura_id', asignaturaId)
    if (errorBorrarSubtemas) throw errorBorrarSubtemas

    const { error: errorBorrarTemas } = await supabase
      .from('temas')
      .delete()
      .eq('asignatura_id', asignaturaId)
    if (errorBorrarTemas) throw errorBorrarTemas

    let orden = 0
    for (const elemento of elementos.value) {
      if (elemento.clase === 'tema') {
        const { data: temaInsertado, error: errorTema } = await supabase
          .from('temas')
          .insert({ asignatura_id: asignaturaId, nombre: elemento.nombre, orden })
          .select('id')
          .single()
        if (errorTema || !temaInsertado) throw errorTema ?? new Error('tema')
        orden += 1

        if (elemento.subtemas.length) {
          const { error: errorSubtemas } = await supabase
            .from('subtemas')
            .insert(elemento.subtemas.map((subtema, i) => ({
              asignatura_id: asignaturaId,
              tema_id: temaInsertado.id,
              nombre: subtema.nombre,
              tipo: 'contenido' as const,
              duracion_sesiones: subtema.duracionSesiones,
              orden: orden + i
            })))
          if (errorSubtemas) throw errorSubtemas
          orden += elemento.subtemas.length
        } else {
          // Tema sin puntos: se reparte como un único bloque con el
          // nombre y la duración del propio tema.
          const { error: errorSubtemaTema } = await supabase
            .from('subtemas')
            .insert({
              asignatura_id: asignaturaId,
              tema_id: temaInsertado.id,
              nombre: elemento.nombre,
              tipo: 'contenido' as const,
              duracion_sesiones: elemento.duracionSesiones,
              orden
            })
          if (errorSubtemaTema) throw errorSubtemaTema
          orden += 1
        }
      } else {
        const { error: errorSuelto } = await supabase
          .from('subtemas')
          .insert({
            asignatura_id: asignaturaId,
            tema_id: null,
            nombre: elemento.nombre,
            tipo: elemento.tipo,
            duracion_sesiones: elemento.duracionSesiones,
            orden
          })
        if (errorSuelto) throw errorSuelto
        orden += 1
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
      v-if="!elementos.length"
      class="mb-4 text-sm text-muted"
    >
      Todavía no has añadido ningún tema.
    </p>

    <div
      v-for="(elemento, indiceElemento) in elementos"
      :key="elemento.clienteId"
      class="mb-4 rounded-lg border border-default p-4"
    >
      <template v-if="elemento.clase === 'tema'">
        <div class="mb-3 flex items-end gap-3">
          <UFormField
            label="Tema"
            class="flex-1"
          >
            <UInput
              v-model="elemento.nombre"
              placeholder="Nombre del tema"
              class="w-full"
            />
          </UFormField>
          <UButton
            icon="i-lucide-chevron-up"
            color="neutral"
            variant="ghost"
            :disabled="indiceElemento === 0"
            aria-label="Mover arriba"
            @click="moverElemento(elemento.clienteId, 'arriba')"
          />
          <UButton
            icon="i-lucide-chevron-down"
            color="neutral"
            variant="ghost"
            :disabled="indiceElemento === elementos.length - 1"
            aria-label="Mover abajo"
            @click="moverElemento(elemento.clienteId, 'abajo')"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            aria-label="Eliminar tema"
            @click="eliminarElemento(elemento.clienteId)"
          />
        </div>

        <UFormField
          v-if="!elemento.subtemas.length"
          label="Duración del tema entero (sesiones)"
          class="mb-3 max-w-xs"
          help="Si añades puntos del tema, la duración pasa a ser la suma de cada uno."
        >
          <UInput
            v-model.number="elemento.duracionSesiones"
            type="number"
            step="0.5"
            min="0.5"
            class="w-full"
          />
        </UFormField>

        <div class="flex flex-col gap-2 pl-4">
          <div
            v-for="(subtema, indiceSubtema) in elemento.subtemas"
            :key="subtema.clienteId"
            class="grid items-end gap-3 sm:grid-cols-[1fr_10rem_auto_auto_auto]"
          >
            <UFormField label="Punto del tema">
              <UInput
                v-model="subtema.nombre"
                placeholder="Ecuaciones de primer grado"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Duración (sesiones)">
              <UInput
                v-model.number="subtema.duracionSesiones"
                type="number"
                step="0.5"
                min="0.5"
                class="w-full"
              />
            </UFormField>

            <UButton
              icon="i-lucide-chevron-up"
              color="neutral"
              variant="ghost"
              :disabled="indiceSubtema === 0"
              aria-label="Mover arriba"
              @click="moverSubtema(elemento.clienteId, subtema.clienteId, 'arriba')"
            />
            <UButton
              icon="i-lucide-chevron-down"
              color="neutral"
              variant="ghost"
              :disabled="indiceSubtema === elemento.subtemas.length - 1"
              aria-label="Mover abajo"
              @click="moverSubtema(elemento.clienteId, subtema.clienteId, 'abajo')"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              aria-label="Eliminar punto del tema"
              @click="eliminarSubtema(elemento.clienteId, subtema.clienteId)"
            />
          </div>

          <UButton
            icon="i-lucide-plus"
            color="neutral"
            variant="subtle"
            size="sm"
            class="self-start"
            @click="agregarSubtema(elemento.clienteId)"
          >
            Añadir punto del tema
          </UButton>
        </div>
      </template>

      <div
        v-else
        class="grid items-end gap-3 sm:grid-cols-[8rem_1fr_10rem_auto_auto_auto]"
      >
        <p class="text-sm text-muted">
          {{ etiquetaTipoSuelto[elemento.tipo] }}
        </p>

        <UFormField label="Nombre">
          <UInput
            v-model="elemento.nombre"
            placeholder="Examen parcial 2ª evaluación"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Duración (sesiones)">
          <UInput
            v-model.number="elemento.duracionSesiones"
            type="number"
            step="0.5"
            min="0.5"
            class="w-full"
          />
        </UFormField>

        <UButton
          icon="i-lucide-chevron-up"
          color="neutral"
          variant="ghost"
          :disabled="indiceElemento === 0"
          aria-label="Mover arriba"
          @click="moverElemento(elemento.clienteId, 'arriba')"
        />
        <UButton
          icon="i-lucide-chevron-down"
          color="neutral"
          variant="ghost"
          :disabled="indiceElemento === elementos.length - 1"
          aria-label="Mover abajo"
          @click="moverElemento(elemento.clienteId, 'abajo')"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          aria-label="Eliminar elemento"
          @click="eliminarElemento(elemento.clienteId)"
        />
      </div>
    </div>

    <div class="mb-8 flex flex-wrap gap-2">
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="subtle"
        @click="agregarTema()"
      >
        Añadir tema
      </UButton>

      <UButton
        v-for="opcion in opcionesTipoSuelto"
        :key="opcion.tipo"
        icon="i-lucide-plus"
        color="neutral"
        variant="subtle"
        @click="agregarElementoSuelto(opcion.tipo)"
      >
        {{ opcion.etiqueta }}
      </UButton>
    </div>

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
