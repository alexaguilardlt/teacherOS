<script setup lang="ts">
const user = useSupabaseUser()

watch(user, (value) => {
  if (value) {
    navigateTo('/dashboard')
  }
}, { immediate: true })

const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']

interface SesionEjemplo {
  grupo: string
  color: string
}

interface CeldaEjemplo {
  dia: number
  sesiones: SesionEjemplo[]
}

const semanasEjemplo: CeldaEjemplo[][] = [
  [
    { dia: 6, sesiones: [{ grupo: '1º ESO A', color: '#3b82f6' }] },
    { dia: 7, sesiones: [{ grupo: '4º ESO D', color: '#f59e0b' }] },
    { dia: 8, sesiones: [{ grupo: '1º ESO A', color: '#3b82f6' }, { grupo: '1º Bach A', color: '#a855f7' }] },
    { dia: 9, sesiones: [{ grupo: '4º ESO D', color: '#f59e0b' }] },
    { dia: 10, sesiones: [{ grupo: '1º Bach A', color: '#a855f7' }] }
  ],
  [
    { dia: 13, sesiones: [{ grupo: '1º ESO A', color: '#3b82f6' }] },
    { dia: 14, sesiones: [{ grupo: '4º ESO D', color: '#f59e0b' }] },
    { dia: 15, sesiones: [] },
    { dia: 16, sesiones: [{ grupo: '4º ESO D', color: '#f59e0b' }, { grupo: '1º Bach A', color: '#a855f7' }] },
    { dia: 17, sesiones: [{ grupo: '1º ESO A', color: '#3b82f6' }] }
  ]
]

const puntosFuertes = [
  {
    icon: 'i-lucide-calendar-clock',
    titulo: 'Reparto automático',
    descripcion: 'Distribuye el temario a lo largo del curso según los días lectivos y la dificultad de cada tema.'
  },
  {
    icon: 'i-lucide-refresh-cw',
    titulo: 'Se adapta a imprevistos',
    descripcion: 'Marca un día como no lectivo y las sesiones futuras se reorganizan solas, sin perder lo ya dado.'
  },
  {
    icon: 'i-lucide-layout-grid',
    titulo: 'Todo tu horario, de un vistazo',
    descripcion: 'Asignaturas, grupos y horarios en un calendario claro, con el contenido de cada sesión a mano.'
  }
]
</script>

<template>
  <div>
    <UPageHero
      title="Organiza el temario de tus asignaturas sin esfuerzo"
      description="Gestiona asignaturas, grupos y horarios, y deja que teacherOS reparta el temario a lo largo del curso según los días lectivos disponibles."
      :links="[{
        label: 'Crear cuenta',
        to: '/registro',
        size: 'xl'
      }, {
        label: 'Iniciar sesión',
        to: '/login',
        size: 'xl',
        color: 'neutral',
        variant: 'subtle'
      }]"
    />

    <UContainer class="pb-24">
      <div class="mx-auto max-w-2xl rounded-2xl border border-default bg-default p-6 shadow-sm">
        <p class="mb-4 text-sm font-medium text-muted">
          Así se ve el reparto del curso
        </p>
        <div class="grid grid-cols-5 gap-2 text-center text-xs text-muted">
          <span
            v-for="d in diasSemana"
            :key="d"
          >
            {{ d }}
          </span>
        </div>
        <div
          v-for="(semana, i) in semanasEjemplo"
          :key="i"
          class="mt-2 grid grid-cols-5 gap-2"
        >
          <div
            v-for="celda in semana"
            :key="celda.dia"
            class="flex min-h-[4.5rem] flex-col gap-1 rounded-lg border border-default p-1.5"
          >
            <span class="text-xs text-muted">{{ celda.dia }}</span>
            <span
              v-for="(sesion, j) in celda.sesiones"
              :key="j"
              class="truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
              :style="{ backgroundColor: sesion.color }"
            >
              {{ sesion.grupo }}
            </span>
          </div>
        </div>
      </div>

      <div class="mt-16 grid gap-8 sm:grid-cols-3">
        <div
          v-for="punto in puntosFuertes"
          :key="punto.titulo"
          class="flex flex-col items-start gap-3"
        >
          <div class="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
            <UIcon
              :name="punto.icon"
              class="size-5"
            />
          </div>
          <h3 class="font-semibold">
            {{ punto.titulo }}
          </h3>
          <p class="text-sm text-muted">
            {{ punto.descripcion }}
          </p>
        </div>
      </div>
    </UContainer>
  </div>
</template>
