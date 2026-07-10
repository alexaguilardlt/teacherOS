# ERP para profesores — Contexto del proyecto

## Qué es
SaaS para profesores (colegios, institutos, academias) que gestiona asignaturas,
grupos y horarios, y distribuye automáticamente el temario a lo largo del curso
según los días lectivos disponibles y la dificultad de cada subtema. Si un día
deja de estar disponible, permite redistribuir las sesiones futuras.

## Fase actual: MVP mínimo
Estamos empezando desde cero, paso a paso, sin sobre-ingeniería. Orden de trabajo:
1. Configuración del proyecto (Nuxt + Supabase) — HECHO
2. Base de datos mínima — HECHO (ver `supabase/migrations/001_schema_mvp.sql`)
3. CI/CD — HECHO (ver `.github/workflows/ci.yml`)
4. Home + registro + login + CRUD de asignaturas/grupos/horarios — EN CURSO
5. Algoritmo de distribución de temario — futuro, no empezar todavía
6. Calendario escolar, redistribución automática, pagos — futuro, no empezar todavía

## Stack
- Frontend/backend: Nuxt 3, gestor de paquetes pnpm
- Auth + DB: Supabase (Postgres + Row Level Security + @nuxtjs/supabase)
- Despliegue: Vercel (auto-deploy desde `main`, preview por PR)
- CI: GitHub Actions (lint, typecheck, build)

## Decisiones de modelo de datos ya tomadas
- Una sesión de clase se puede repartir entre 2 subtemas (tabla `sesion_subtemas`
  con campo `fraccion`).
- Un grupo puede cursar varias asignaturas → la relación grupo-asignatura vive en
  `grupo_asignaturas`, y el horario (`franjas_horarias`) cuelga de esa combinación,
  no del grupo ni de la asignatura por separado.
- La dificultad de cada subtema (`baja` / `media` / `alta`) determina automáticamente
  su duración en sesiones mediante una tabla de reglas configurable por profesor
  (`reglas_dificultad`), no se introduce a mano subtema a subtema.
- Cuando se marca un día como no lectivo, la redistribución genera sesiones en
  estado `propuesta` para previsualizar antes de confirmar (no se aplica directo).
  Este mecanismo de tablas `sesiones.estado` (`confirmada` / `propuesta` /
  `cancelada` / `impartida`) se dejó documentado para la fase 5, pero el schema
  del MVP actual (fase 2) NO incluye todavía `sesiones`, `calendario_escolar`,
  `dias_no_lectivos` ni `reglas_dificultad` — se añadirán cuando toque el algoritmo.

## Cómo trabajar en este proyecto
- Ir poco a poco: no añadir tablas, features o complejidad de fases futuras
  mientras se trabaja en la fase actual.
- Antes de tocar el algoritmo de distribución (fase 5), avisar y confirmar el
  enfoque (empezar con un algoritmo greedy simple, no optimización compleja).
- Cualquier cambio de stack o arquitectura importante, discutirlo antes de aplicarlo.