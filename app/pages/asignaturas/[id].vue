<script setup lang="ts">
import type { ElementoTemarioWizard, TemaWizard, TipoElementoSuelto } from '~/stores/cursoWizard.types'
import { moverEnLista } from '~/utils/listas'
import type { PreviewGrupoAsignatura } from '~/composables/useRedistribucion'
import { fechaLocalISO } from '~/utils/fechas'
import { subtemasYaDados, temarioAfectaAlReparto } from '~/utils/repartoAlgoritmo'
import { planificarGuardadoTemario, type PlanGuardadoTemario } from '~/utils/temario'

const route = useRoute()
const asignaturaId = route.params.id as string

const supabase = useSupabaseClient()
const { previsualizarCambioTemario, aplicarPreview } = useRedistribucion()

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

// Sesiones en las que aparece algún subtema de la asignatura: sirven para
// saber qué se ha dado ya (y no se puede borrar).
const { data: sesionesConSubtemas } = await useAsyncData(`asignatura-${asignaturaId}-sesiones`, async () => {
  const subtemaIds = (subtemasIniciales.value ?? []).map(s => s.id)
  if (!subtemaIds.length) return { sesiones: [], enlaces: [] }
  const { data: enlaces } = await supabase
    .from('sesion_subtemas')
    .select('sesion_id, subtema_id')
    .in('subtema_id', subtemaIds)
  const sesionIds = [...new Set((enlaces ?? []).map(e => e.sesion_id))]
  if (!sesionIds.length) return { sesiones: [], enlaces: [] }
  const { data: sesiones } = await supabase
    .from('sesiones')
    .select('id, franja_horaria_id, fecha, estado')
    .in('id', sesionIds)
  return {
    sesiones: (sesiones ?? []).map(s => ({ id: s.id, franjaId: s.franja_horaria_id, fecha: s.fecha, estado: s.estado })),
    enlaces: (enlaces ?? []).map(e => ({ sesionId: e.sesion_id, subtemaId: e.subtema_id }))
  }
})

const fechaDadoPorSubtemaId = computed(() =>
  subtemasYaDados(sesionesConSubtemas.value?.sesiones ?? [], sesionesConSubtemas.value?.enlaces ?? [], fechaLocalISO())
)

// Texto para el botón de borrar desactivado, o undefined si se puede borrar.
function motivoNoBorrable(subtemaIds: string[]) {
  const fechas = subtemaIds.map(id => fechaDadoPorSubtemaId.value.get(id)).filter(f => f !== undefined).sort()
  if (!fechas.length) return undefined
  return `Ya se dio el ${fechas[0]!.split('-').reverse().join('/')}: no se puede borrar.`
}

const nombre = ref(asignatura.value.nombre)

// Reconstruye la secuencia única de la asignatura combinando temas.orden y
// subtemas.orden (comparten el mismo contador, ver guardar()): cada tema
// consume su propia posición antes de que empiecen sus subtemas de
// contenido, así que mezclando ambas listas por "orden" se recupera el
// orden exacto en el que se añadieron temas y elementos sueltos.
//
// Lo que ya existe usa su id de la base de datos como clienteId: al guardar
// se actualiza en vez de borrarse y recrearse, y las sesiones ya repartidas
// siguen apuntando a sus subtemas.
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
      clienteId: tema.id,
      clase: 'tema' as const,
      nombre: tema.nombre,
      subtemas: (contenidoPorTema.get(tema.id) ?? [])
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .map(s => ({ clienteId: s.id, nombre: s.nombre, duracionSesiones: Number(s.duracion_sesiones) })),
      duracionSesiones: 1
    } satisfies ElementoTemarioWizard
  })),
  ...(subtemasIniciales.value ?? []).filter(s => s.tipo !== 'contenido').map(s => ({
    orden: s.orden,
    elemento: {
      clienteId: s.id,
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

// Si el cambio afecta a un reparto ya generado, antes de guardar se enseña
// cómo quedarían las sesiones a partir de hoy, y el temario y el reparto
// se guardan juntos: nunca queda un temario nuevo con sesiones del viejo.
const planPendiente = ref<PlanGuardadoTemario | null>(null)
const previewsRecolocacion = ref<PreviewGrupoAsignatura[]>([])
const modalRecolocarAbierto = ref(false)

async function guardar() {
  guardando.value = true
  errorMessage.value = ''

  try {
    const plan = planificarGuardadoTemario(asignaturaId, elementos.value, {
      temaIds: (temasIniciales.value ?? []).map(t => t.id),
      subtemaIds: (subtemasIniciales.value ?? []).map(s => s.id)
    })

    const borradoYaDado = plan.subtemaIdsABorrar.find(id => fechaDadoPorSubtemaId.value.has(id))
    if (borradoYaDado) {
      throw new Error('No se puede borrar un punto del temario que ya se ha dado.')
    }

    const antes = (subtemasIniciales.value ?? []).map(s => ({ id: s.id, duracionSesiones: Number(s.duracion_sesiones) }))
    const despues = plan.subtemas.map(s => ({ id: s.id, duracionSesiones: s.duracion_sesiones }))
    if (temarioAfectaAlReparto(antes, despues)) {
      const previews = await previsualizarCambioTemario(
        asignaturaId,
        plan.subtemas.map(s => ({ id: s.id, nombre: s.nombre, duracionSesiones: s.duracion_sesiones }))
      )
      if (previews.length) {
        planPendiente.value = plan
        previewsRecolocacion.value = previews
        modalRecolocarAbierto.value = true
        return
      }
    }

    await guardarTemario(plan, [])
  } catch (e) {
    errorMessage.value = (e as { message?: string })?.message || 'No se han podido guardar los cambios. Inténtalo de nuevo.'
  } finally {
    guardando.value = false
  }
}

const recolocando = ref(false)

async function confirmarRecolocacion() {
  if (!planPendiente.value) return
  recolocando.value = true
  try {
    await guardarTemario(planPendiente.value, previewsRecolocacion.value)
  } catch (e) {
    // La vista previa se calculó con las sesiones de antes: si algo se llegó
    // a aplicar, ya no vale. Hay que volver a pulsar Guardar para recalcularla.
    modalRecolocarAbierto.value = false
    planPendiente.value = null
    errorMessage.value = (e as { message?: string })?.message || 'No se han podido guardar los cambios. Inténtalo de nuevo.'
  } finally {
    recolocando.value = false
  }
}

async function guardarTemario(plan: PlanGuardadoTemario, previews: PreviewGrupoAsignatura[]) {
  try {
    const { error: errorAsignatura } = await supabase
      .from('asignaturas')
      .update({ nombre: nombre.value })
      .eq('id', asignaturaId)
    if (errorAsignatura) throw errorAsignatura

    // Primero se guarda todo lo que queda, luego se recoloca el reparto (las
    // sesiones nuevas ya pueden apuntar a los subtemas nuevos) y al final se
    // borra lo quitado: si algo falla a mitad, como mucho se queda sin
    // aplicar parte de la edición, pero no se pierde nada de lo que había.
    if (plan.temas.length) {
      const { error: errorTemas } = await supabase.from('temas').upsert(plan.temas)
      if (errorTemas) throw errorTemas
    }

    if (plan.subtemas.length) {
      const { error: errorSubtemas } = await supabase.from('subtemas').upsert(plan.subtemas)
      if (errorSubtemas) throw errorSubtemas
    }

    for (const preview of previews) {
      await aplicarPreview(preview)
    }

    if (plan.subtemaIdsABorrar.length) {
      const { error: errorBorrarSubtemas } = await supabase.from('subtemas').delete().in('id', plan.subtemaIdsABorrar)
      if (errorBorrarSubtemas) throw errorBorrarSubtemas
    }

    if (plan.temaIdsABorrar.length) {
      const { error: errorBorrarTemas } = await supabase.from('temas').delete().in('id', plan.temaIdsABorrar)
      if (errorBorrarTemas) throw errorBorrarTemas
    }
  } catch (e) {
    // Lo que sí llegó a guardarse pasa a contar como existente: si se
    // vuelve a intentar, se borra lo que sobre en vez de duplicarse.
    // Las sesiones se piden a partir de los subtemas: van después.
    await refreshNuxtData([`asignatura-${asignaturaId}-temas`, `asignatura-${asignaturaId}-subtemas`])
    await refreshNuxtData(`asignatura-${asignaturaId}-sesiones`)
    throw e
  }

  await navigateTo('/dashboard')
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
          <UTooltip
            :text="motivoNoBorrable(elemento.subtemas.map(s => s.clienteId))"
            :disabled="!motivoNoBorrable(elemento.subtemas.map(s => s.clienteId))"
          >
            <UButton
              :icon="motivoNoBorrable(elemento.subtemas.map(s => s.clienteId)) ? 'i-lucide-lock' : 'i-lucide-trash-2'"
              color="neutral"
              variant="ghost"
              :disabled="Boolean(motivoNoBorrable(elemento.subtemas.map(s => s.clienteId)))"
              :aria-label="motivoNoBorrable(elemento.subtemas.map(s => s.clienteId)) ?? 'Eliminar tema'"
              @click="eliminarElemento(elemento.clienteId)"
            />
          </UTooltip>
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
            <UTooltip
              :text="motivoNoBorrable([subtema.clienteId])"
              :disabled="!motivoNoBorrable([subtema.clienteId])"
            >
              <UButton
                :icon="motivoNoBorrable([subtema.clienteId]) ? 'i-lucide-lock' : 'i-lucide-trash-2'"
                color="neutral"
                variant="ghost"
                :disabled="Boolean(motivoNoBorrable([subtema.clienteId]))"
                :aria-label="motivoNoBorrable([subtema.clienteId]) ?? 'Eliminar punto del tema'"
                @click="eliminarSubtema(elemento.clienteId, subtema.clienteId)"
              />
            </UTooltip>
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
        <UTooltip
          :text="motivoNoBorrable([elemento.clienteId])"
          :disabled="!motivoNoBorrable([elemento.clienteId])"
        >
          <UButton
            :icon="motivoNoBorrable([elemento.clienteId]) ? 'i-lucide-lock' : 'i-lucide-trash-2'"
            color="neutral"
            variant="ghost"
            :disabled="Boolean(motivoNoBorrable([elemento.clienteId]))"
            :aria-label="motivoNoBorrable([elemento.clienteId]) ?? 'Eliminar elemento'"
            @click="eliminarElemento(elemento.clienteId)"
          />
        </UTooltip>
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

    <UModal
      v-model:open="modalRecolocarAbierto"
      title="Recolocar el reparto"
      :dismissible="!recolocando"
    >
      <template #body>
        <div class="flex flex-col gap-4">
          <p class="text-sm text-muted">
            Esta asignatura ya está repartida. Con el temario nuevo, las sesiones quedarán así a partir de hoy.
            Las sesiones anteriores y las ya impartidas no se tocan.
          </p>
          <ResumenRedistribucion :previews="previewsRecolocacion" />
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
