# TeacherOS

Planificación anual de asignaturas para profesores, en menos de 10 minutos.

El profesor define el temario de cada asignatura, sus grupos y su horario, y
TeacherOS reparte el temario en sesiones con fecha real a lo largo del curso,
respetando festivos y horarios que cambian según la época. Cuando se pierde una
clase, cambia el temario o el calendario, recoloca las sesiones futuras,
enseñando antes cómo quedan.

> En desarrollo (MVP). Primeras usuarias: profesoras de secundaria de un colegio.

## Qué hace

- Asistente para montar un curso: fechas, festivos, horarios tipo (por ejemplo,
  horario reducido en septiembre y junio), asignaturas con su temario y grupos.
- Reparto automático del temario: cada subtema dura lo que diga el profesor
  (en bloques de media sesión), con exámenes y repasos intercalados.
- Redistribución con vista previa al marcar un día no lectivo, saltar una clase
  concreta o cambiar temario, horario o calendario. Lo ya dado no se toca.
- Dashboard con calendario, horario semanal, sesiones impartidas y notas.

## Stack

Nuxt 4 · Vue 3 · Nuxt UI · Tailwind CSS 4 · Pinia · TypeScript · Supabase
(Postgres + Row Level Security) · Vitest · Playwright · Vercel.

El algoritmo de reparto y todo el cálculo son TypeScript puro con tests; las
escrituras de varios pasos se hacen en funciones de Postgres, en una sola
transacción. Más detalle en
[docs/02-architecture/Arquitectura.md](docs/02-architecture/Arquitectura.md).

## Arrancarlo en local

Requisitos: Node 22, pnpm y un proyecto de Supabase con las migraciones de
`supabase/migrations/` aplicadas (`supabase link` + `supabase db push`).

```bash
pnpm install
cp .env.example .env   # rellena SUPABASE_URL y SUPABASE_KEY
pnpm dev               # http://localhost:3000
```

## Pruebas

```bash
pnpm lint
pnpm typecheck
pnpm test        # unitarios (Vitest)
pnpm test:e2e    # end-to-end (Playwright) contra Supabase
```

El e2e necesita una cuenta de pruebas en `.env.test.local`:

```bash
E2E_TEST_EMAIL=...
E2E_TEST_PASSWORD=...
```

Crea un curso completo con esa cuenta, lo recorre y lo borra al terminar.

## Documentación

- [Visión del producto](docs/00-product/Vision.md) y [MVP](docs/01-prd/MVP.md)
- [Arquitectura](docs/02-architecture/Arquitectura.md)
- [Mejoras pendientes](docs/Mejoras.md)
