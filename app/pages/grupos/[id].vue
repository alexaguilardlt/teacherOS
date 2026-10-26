<script setup lang="ts">
import type { PreviewGrupoAsignatura } from '~/composables/useRedistribucion'
import { fechaLocalISO } from '~/utils/fechas'
import { argumentosGuardarGrupo, planificarGuardadoGrupo, type PlanGuardadoGrupo } from '~/utils/grupo'

const route = useRoute()
const grupoId = route.params.id as string

const supabase = useSupabaseClient()
const { previsualizarCambioHorario } = useRedistribucion()

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

const { data: franjasIniciales } = await useAsyncData(`grupo-${grupoId}-franjas`, async () => {
  const gaIds = (grupoAsignaturasIniciales.value ?? []).map(ga => ga.id)
  if (!gaIds.length) return []
  const { data } = await supabase
    .from('franjas_horarias')
    .select('id, grupo_asignatura_id, dia_semana, periodo_id, propia')
    .in('grupo_asignatura_id', gaIds)
  return data ?? []
})

const { data: sesionesIniciales } = await useAsyncData(`grupo-${grupoId}-sesiones`, async () => {
  const franjaIds = (franjasIniciales.value ?? []).map(f => f.id)
  if (!franjaIds.length) return []
  const { data } = await supabase
    .from('sesiones')
    .select('id, franja_horaria_id, fecha, estado')
    .in('franja_horaria_id', franjaIds)
  return data ?? []
})

// Primera clase ya dada (anterior a hoy o impartida) de cada franja. Una
// franja con clases dadas no se puede quitar ni cambiar de día u hora: se
// perdería o se falsearía el historial. Para un cambio de horario a mitad
// de curso están los horarios tipo con vigencias.
const primeraClaseDadaPorFranjaId = computed(() => {
  const hoy = fechaLocalISO()
  const fechas = new Map<string, string>()
  for (const sesion of sesionesIniciales.value ?? []) {
    if (sesion.fecha >= hoy && sesion.estado !== 'impartida') continue
    const anterior = fechas.get(sesion.franja_horaria_id)
    if (!anterior || sesion.fecha < anterior) fechas.set(sesion.franja_horaria_id, sesion.fecha)
  }
  return fechas
})

function motivoFranjaBloqueada(franjaId: string) {
  const fecha = primeraClaseDadaPorFranjaId.value.get(franjaId)
  if (!fecha) return undefined
  return `Ya hay clases dadas en esta franja (desde el ${fecha.split('-').reverse().join('/')}): no se puede quitar ni cambiar de día u hora.`
}

const nombre = ref(grupo.value.nombre)
const color = ref(grupo.value.color)

const seleccionInicial = (grupoAsignaturasIniciales.value ?? []).map(ga => ({
  asignaturaId: ga.asignatura_id,
  franjas: (franjasIniciales.value ?? [])
    .filter(franja => franja.grupo_asignatura_id === ga.id)
    .map(franja => ({
      // El id de la base de datos: al guardar se actualiza en vez de
      // borrarse y recrearse (y sus sesiones no se pierden).
      clienteId: franja.id,
      diaSemana: franja.dia_semana,
      periodoId: franja.periodo_id,
      propia: franja.propia
    }))
}))

const { seleccion, seleccionDe, alternarAsignatura, agregarFranja, eliminarFranja, opcionesPeriodo, haySolape }
  = useSeleccionAsignaturas(periodos, horariosTipo, seleccionInicial)

function grupoAsignaturaGuardadaId(asignaturaId: string) {
  return grupoAsignaturasIniciales.value?.find(ga => ga.asignatura_id === asignaturaId)?.id
}

const guardando = ref(false)
const errorMessage = ref('')

// Si el horario de una asignatura ya repartida cambia, antes de guardar se
// enseña cómo quedarían sus sesiones a partir de hoy, y el horario y el
// reparto se guardan juntos.
const planPendiente = ref<PlanGuardadoGrupo | null>(null)
const previewsRecolocacion = ref<PreviewGrupoAsignatura[]>([])
const modalRecolocarAbierto = ref(false)

async function guardar() {
  guardando.value = true
  errorMessage.value = ''

  try {
    const plan = planificarGuardadoGrupo(grupoId, seleccion.value, {
      grupoAsignaturas: (grupoAsignaturasIniciales.value ?? []).map(ga => ({ ...ga, grupo_id: grupoId })),
      franjas: franjasIniciales.value ?? []
    })

    // Quitar una franja con clases dadas solo vale si se quita la asignatura
    // entera (y eso se confirma aparte).
    const franjaPorId = new Map((franjasIniciales.value ?? []).map(f => [f.id, f]))
    const franjaBloqueadaTocada = [
      ...plan.franjaIdsABorrar.filter(id => !plan.grupoAsignaturaIdsABorrar.includes(franjaPorId.get(id)!.grupo_asignatura_id)),
      ...plan.franjas
        .filter(f => franjaPorId.has(f.id))
        .filter(f => f.dia_semana !== franjaPorId.get(f.id)!.dia_semana || f.periodo_id !== franjaPorId.get(f.id)!.periodo_id)
        .map(f => f.id)
    ].find(id => primeraClaseDadaPorFranjaId.value.has(id))
    if (franjaBloqueadaTocada) {
      throw new Error('No se puede quitar ni cambiar de día u hora una franja que ya tiene clases dadas.')
    }

    const asignaturasQuitadasConReparto = plan.grupoAsignaturaIdsABorrar
      .filter(gaId => (sesionesIniciales.value ?? []).some(s => franjaPorId.get(s.franja_horaria_id)?.grupo_asignatura_id === gaId))
      .map(gaId => nombreAsignatura((grupoAsignaturasIniciales.value ?? []).find(ga => ga.id === gaId)!.asignatura_id))
    if (
      asignaturasQuitadasConReparto.length
      && !confirm(`Vas a quitar del grupo ${asignaturasQuitadasConReparto.join(', ')}. Se borrará su reparto, también las clases ya dadas. ¿Continuar?`)
    ) {
      return
    }

    const previews = await previsualizarCambioHorario(
      grupoId,
      plan.grupoAsignaturaIdsConCambioDeHorario.map(gaId => ({
        grupoAsignaturaId: gaId,
        asignaturaId: (grupoAsignaturasIniciales.value ?? []).find(ga => ga.id === gaId)!.asignatura_id,
        franjas: plan.franjas.filter(f => f.grupo_asignatura_id === gaId)
      }))
    )
    if (previews.length) {
      planPendiente.value = plan
      previewsRecolocacion.value = previews
      errorRecolocacion.value = ''
      modalRecolocarAbierto.value = true
      return
    }

    await guardarGrupo(plan, [])
  } catch (e) {
    errorMessage.value = (e as { message?: string })?.message || 'No se han podido guardar los cambios. Inténtalo de nuevo.'
  } finally {
    guardando.value = false
  }
}

function nombreAsignatura(asignaturaId: string) {
  return asignaturas.value?.find(a => a.id === asignaturaId)?.nombre ?? ''
}

const recolocando = ref(false)
const errorRecolocacion = ref('')

async function confirmarRecolocacion() {
  if (!planPendiente.value) return
  recolocando.value = true
  errorRecolocacion.value = ''
  try {
    await guardarGrupo(planPendiente.value, previewsRecolocacion.value)
  } catch (e) {
    // Si falla no se ha guardado nada: la vista previa sigue valiendo y se
    // puede reintentar desde aquí mismo.
    errorRecolocacion.value = (e as { message?: string })?.message || 'No se han podido guardar los cambios. Inténtalo de nuevo.'
  } finally {
    recolocando.value = false
  }
}

// Todo en una transacción (función de Postgres guardar_grupo, migración
// 016): o se guardan el grupo, su horario y su reparto recolocado, o nada.
async function guardarGrupo(plan: PlanGuardadoGrupo, previews: PreviewGrupoAsignatura[]) {
  const { error } = await supabase.rpc('guardar_grupo', argumentosGuardarGrupo(
    { id: grupoId, cursoId: grupo.value!.curso_id, nombre: nombre.value, color: color.value },
    plan,
    recolocacionesConfirmadas(previews)
  ))
  if (error) throw error

  await navigateTo('/dashboard')
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
            class="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto_auto]"
          >
            <UFormField label="Día">
              <USelect
                v-model="franja.diaSemana"
                :items="OPCIONES_DIA"
                value-key="value"
                :disabled="Boolean(motivoFranjaBloqueada(franja.clienteId))"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Franja horaria">
              <USelect
                v-model="franja.periodoId"
                :items="opcionesPeriodo"
                value-key="value"
                :disabled="Boolean(motivoFranjaBloqueada(franja.clienteId))"
                class="w-full"
              />
            </UFormField>

            <UCheckbox
              v-model="franja.propia"
              label="La imparto yo"
              class="pb-2"
            />

            <UTooltip
              :text="motivoFranjaBloqueada(franja.clienteId)"
              :disabled="!motivoFranjaBloqueada(franja.clienteId)"
            >
              <UButton
                :icon="motivoFranjaBloqueada(franja.clienteId) ? 'i-lucide-lock' : 'i-lucide-trash-2'"
                color="neutral"
                variant="ghost"
                :disabled="Boolean(motivoFranjaBloqueada(franja.clienteId))"
                :aria-label="motivoFranjaBloqueada(franja.clienteId) ?? 'Eliminar franja horaria'"
                @click="eliminarFranja(asignatura.id, franja.clienteId)"
              />
            </UTooltip>
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

    <UModal
      v-model:open="modalRecolocarAbierto"
      title="Recolocar el reparto"
      :dismissible="!recolocando"
    >
      <template #body>
        <div class="flex flex-col gap-4">
          <p class="text-sm text-muted">
            El horario de este grupo ha cambiado. Con el horario nuevo, las sesiones quedarán así a partir de hoy.
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
