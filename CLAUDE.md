# TeacherOS — instrucciones para trabajar en el proyecto

SaaS para profesores que reparte el temario de cada asignatura en sesiones con
fecha real según el horario de cada grupo y el calendario del curso, y lo
recoloca cuando se pierde una clase o cambia algo. Promesa: planificar un curso
en menos de 10 minutos. Filtro para cualquier funcionalidad: ¿hace que el
profesor invierta menos tiempo? Primeras usuarias reales: profesoras de un
colegio, con datos de verdad en producción.

- Producto: `docs/00-product/Vision.md`, `docs/01-prd/MVP.md`
- Arquitectura, modelo de datos y algoritmo: `docs/02-architecture/Arquitectura.md`
- Pendientes y mejoras: `docs/Mejoras.md`
- La documentación se puede quedar atrás: ante la duda, manda el código.

## Estado

El MVP funciona de principio a fin: auth, asistente de curso, asignaturas con
temario, grupos con horario, horarios tipo con vigencias, festivos, reparto
automático, redistribución con vista previa, notas por sesión y dashboard.
Todavía no hay IA, pagos, integraciones ni compartir planificaciones: no
empezarlos sin que se pida.

## Stack y comandos

Nuxt 4 + Vue 3 + Nuxt UI + Tailwind 4 + Pinia, pnpm. Supabase (Postgres + RLS)
usado directamente desde el navegador; no hay rutas de servidor propias.
Despliegue en Vercel desde `main` (preview por PR).

```bash
pnpm lint          # ESLint
pnpm typecheck     # nuxt typecheck
pnpm test          # Vitest (unitarios)
pnpm test:e2e      # Playwright contra Supabase real, con la cuenta de pruebas
supabase db push   # aplica migraciones pendientes (lo hace el usuario)
```

La CI (`.github/workflows/ci.yml`) pasa lint, typecheck y tests unitarios. El
e2e no está en la CI: lánzalo en local cuando el cambio toque guardado o reparto.

## Reglas del proyecto

Datos y base de datos
- **Ninguna migración borra datos.** Hay datos reales en producción (la
  migración 010 borró todos los subtemas creyendo que eran de prueba).
- **Lo pasado es historia.** Sesiones anteriores a hoy o `impartida` no se
  tocan al recolocar, y no se puede borrar lo que ya tiene clases dadas
  (subtemas, franjas de un grupo, franjas horarias en uso): se bloquea con un
  candado que explica por qué.
- **Al editar, conservar los ids.** Nunca borrar y recrear: los borrados van en
  cascada hasta las sesiones. El `clienteId` de lo que ya existe es su id de la
  base de datos; lo nuevo lleva un UUID generado en el navegador.
- **Escrituras de varios pasos, en una función de Postgres** (todo o nada):
  `security invoker`, `revoke ... from public, anon`, `grant ... to
  authenticated`, y no fiarse del JSON para el dueño (`auth.uid()`) ni para el
  padre de cada fila. Ver las migraciones 014–018.
- **La migración se aplica en Supabase antes de fusionar** el PR que la usa
  (Vercel despliega `main` al momento). Aplicarla es decisión del usuario.
- Al añadir una función o columna, actualizar `app/types/database.types.ts`.

Reparto
- El cálculo es TypeScript puro y testeado (`app/utils/`); las páginas y
  composables solo cargan datos, llaman al cálculo y guardan.
- Cualquier cambio que mueva sesiones ya repartidas enseña antes una vista
  previa (`ResumenRedistribucion`) y se guarda junto con el reparto.
- El algoritmo es determinista (greedy). Antes de cambiarlo, avisar y
  confirmar el enfoque.

Forma de trabajar
- Poco a poco y sin sobre-ingeniería. Cambios de stack o arquitectura: se
  discuten antes de aplicarlos.
- Una rama por cambio (`feat/`, `fix/`, `docs/`, `chore/`, `refactor/` +
  descripción) y PR en GitHub. Nada de commits directos a `main`.
- Tests con cada cambio: unitarios para la lógica nueva en `app/utils/` y, si
  toca guardado o reparto, un paso en `e2e/curso-completo.spec.ts`. Comprobar
  que el test falla sin el arreglo.
- Código, comentarios, commits y PR en español.
