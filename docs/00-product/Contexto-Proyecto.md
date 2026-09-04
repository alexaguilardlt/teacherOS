# TeacherOS — Contexto del proyecto

> Documento de contexto pensado para que una IA (asistente de código, agente,
> etc.) entienda rápidamente qué es el proyecto, por qué existe, en qué estado
> real se encuentra y hacia dónde va. Complementa a `CLAUDE.md` (reglas de
> trabajo) y a `docs/00-product/Vision.md` / `docs/01-prd/MVP.md` (fuentes
> originales, en lenguaje más de producto).

## Qué es

TeacherOS es un SaaS para profesores (colegios, institutos, academias, FP)
que resuelve un problema concreto: la planificación anual de una asignatura
consume muchas horas y se repite cada curso casi igual, normalmente a mano
en Excel/Google Calendar/Word/papel.

La app permite:

1. Definir el temario de una asignatura (temas → subtemas, con una
   dificultad baja/media/alta por subtema).
2. Definir los grupos que cursan cada asignatura y el horario semanal de
   cada combinación grupo+asignatura.
3. Repartir automáticamente ese temario a lo largo del curso, generando una
   sesión por cada clase real (fecha concreta), respetando los días
   lectivos disponibles y el peso de cada subtema.
4. Cuando un día deja de ser lectivo (festivo, excursión, imprevisto),
   redistribuir automáticamente las sesiones futuras sin que el profesor
   tenga que rehacer el calendario a mano.

## Problema, hipótesis y usuario (resumen de `docs/01-prd/MVP.md`)

- **Problema**: crear la planificación anual, reorganizar clases
  canceladas, mantener varios documentos sincronizados — trabajo repetitivo
  que casi nadie automatiza hoy.
- **Hipótesis a validar**: un profesor pagará una suscripción anual si le
  ahorra varias horas por trimestre.
- **Usuario principal**: profesor de secundaria, FP o academia, con
  conocimientos básicos de informática, que hoy usa Excel/Calendar o
  similares. Debe poder montar la planificación completa de un curso en
  **menos de 10 minutos**.
- Todo lo que no ayude a validar esa hipótesis queda fuera del alcance
  actual.

## Visión y objetivos a largo plazo (resumen de `docs/00-product/Vision.md`)

**Misión**: reducir la carga administrativa del profesorado mediante
automatización, planificación inteligente e integraciones con las
herramientas que ya usan. Devolver tiempo al profesor.

**Qué SÍ queremos ser**: la mejor herramienta de planificación docente del
mercado — el "sistema operativo del profesor".

**Qué NO queremos ser**: un ERP educativo, un gestor de matrículas o notas
del centro, ni un sustituto de las plataformas oficiales del colegio.

**Objetivo del MVP** (la promesa mínima de valor real): que un profesor
pueda (1) crear un curso, (2) crear una asignatura, (3) definir el temario,
(4) crear un grupo, (5) generar automáticamente todas las sesiones, y
(6) recalcular la planificación cuando se pierde una clase.

**Visión a largo plazo** (fuera del alcance actual, pero es la dirección):
integraciones con Google Classroom, Moodle, Teams y calendarios externos;
importación de planificaciones desde Excel; compartir planificaciones entre
profesores; generación asistida por IA; exámenes, rúbricas y programación
didáctica, todo desde una única aplicación.

**Métrica de éxito**: no el número de usuarios, sino "minutos ahorrados por
semana" por profesor.

**Valores del producto**: simplicidad, rapidez, automatización,
confiabilidad, accesibilidad, diseño cuidado, privacidad, calidad del
software.

## Estado real del desarrollo

> Importante para cualquier IA que trabaje en este repo: el `CLAUDE.md` del
> proyecto describe las fases de trabajo, pero a fecha de este documento el
> desarrollo ya ha avanzado más allá de lo que ese fichero indica como "en
> curso". Antes de asumir que algo "no existe todavía", comprobarlo en el
> código — este documento refleja el estado verificado contra el repositorio.

Ya implementado y funcionando end-to-end:

- **Auth completo**: registro, login, recuperación de contraseña.
- **CRUD de asignaturas** con temario (temas → subtemas con dificultad).
- **CRUD de grupos**, con horario semanal por combinación grupo+asignatura.
- **Horarios tipo**: un curso puede tener varios patrones de horario (ej.
  "ESO 1º-2º" vs "ESO 3º-4º y Bachillerato"), reutilizables entre grupos, con
  franjas horarias definidas por períodos (no horas libres sueltas).
- **Asistente de creación de curso** (wizard en 4 pasos: datos del curso +
  horarios tipo + festivos → asignaturas/temario → grupos/horario → resumen
  y guardado) y también un flujo directo para crear asignaturas/grupos sin
  pasar por el wizard.
- **Calendario del curso**: fecha de inicio/fin y días/periodos no
  lectivos (festivos), editables tanto en el alta como después desde la
  ficha del curso.
- **Algoritmo de reparto** (`app/utils/repartoAlgoritmo.ts`, con tests):
  distribuye el temario entre las sesiones disponibles según reglas de
  dificultad configurables por profesor, con un ritmo semanal natural.
- **Generación de sesiones reales** (tabla `sesiones`, instancias con fecha
  concreta de una franja horaria recurrente), con estados `propuesta` /
  `confirmada` / `cancelada` / `impartida`.
- **Redistribución automática** de sesiones futuras al marcar un día como no
  lectivo.
- **Dashboard** con calendario visual, vista de horario semanal, marcar
  sesiones como impartidas desde lista o calendario.
- **CI** (lint, typecheck, build, tests) y despliegue en Vercel.

En otras palabras: los 6 puntos del "objetivo del MVP" de la visión ya están
cubiertos a nivel funcional. Lo que queda es sobre todo pulido, casos borde
del flujo de creación y las integraciones/funcionalidades de la visión a
largo plazo (Classroom, Excel, IA, pagos, compartir planificaciones), que
deliberadamente no se han empezado todavía.

## Stack técnico

- **Frontend/backend**: Nuxt 4, Vue 3, Nuxt UI, Tailwind CSS, Pinia (estado
  del wizard). Gestor de paquetes: pnpm.
- **Auth + base de datos**: Supabase (Postgres + Row Level Security +
  `@nuxtjs/supabase`). Toda tabla tiene RLS por `profesor_id` (directo o vía
  join), de forma que un profesor solo ve sus propios datos.
- **Tests**: Vitest (unitarios, ej. algoritmo de reparto y store del
  wizard) + Playwright configurado.
- **Despliegue**: Vercel, auto-deploy desde `main`, preview por PR.
- **CI**: GitHub Actions (lint, typecheck, build).

## Modelo de datos — decisiones clave

- `cursos` (año académico, fecha inicio/fin) → `dias_no_lectivos` (festivos,
  rangos de fecha, editables en cualquier momento, no solo al crear el
  curso).
- `asignaturas` → `temas` → `subtemas` (con `dificultad`: baja/media/alta).
  La dificultad determina automáticamente la duración en sesiones vía
  `reglas_dificultad` (configurable por profesor), no se introduce a mano
  subtema a subtema.
- `grupos` pertenece a un `curso` (no es texto libre) y tiene color para el
  calendario.
- `grupo_asignaturas`: relación N:M entre grupo y asignatura (un grupo puede
  cursar varias asignaturas). El horario cuelga de **esta combinación**, no
  del grupo ni de la asignatura por separado.
- `horarios_tipo` (por curso) → `periodos_horarios` (franjas reutilizables,
  ej. 8:00–8:50) → `franjas_horarias` (día de semana + período, atado a un
  `grupo_asignatura_id`). Permite que distintos grupos del mismo curso
  tengan campanadas distintas.
- `sesiones`: instancia real (fecha concreta) de una `franja_horaria`, con
  estado (`propuesta`/`confirmada`/`cancelada`/`impartida`). Al marcar un
  día no lectivo, la redistribución genera sesiones en `propuesta` para
  previsualizar antes de confirmar — nunca se aplica el cambio directo.
- `sesion_subtemas`: una sesión se puede repartir entre dos subtemas
  (campo `fraccion`), para que dos subtemas "fáciles" compartan sesión.
- Regla de negocio a nivel de base de datos: un profesor no puede tener dos
  franjas horarias solapadas el mismo día (trigger), porque es la misma
  persona y no puede dar dos clases a la vez.

## Cómo trabajar en este proyecto (si una IA va a hacer cambios)

- Ir poco a poco, sin sobre-ingeniería ni funcionalidades de fases futuras
  no pedidas explícitamente.
- Cambios de stack o arquitectura importantes: discutirlos antes de
  aplicarlos.
- Todo cambio debe incluir tests donde ya existe cobertura del área tocada
  (algoritmo de reparto, store del wizard).
- Flujo de trabajo con git: ramas `<prefijo>/<descripción>` + PR en GitHub
  por cada cambio, no commits directos a `main`.
- El `CLAUDE.md` puede quedarse desactualizado respecto al estado real del
  código (ya ha pasado una vez): ante la duda, verificar en el código y no
  fiarse solo de la descripción de fases.
