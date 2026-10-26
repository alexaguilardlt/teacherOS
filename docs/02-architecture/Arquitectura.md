# Arquitectura

Cómo está construido TeacherOS y por qué. Para las reglas de trabajo, ver
`CLAUDE.md`; para el producto, `docs/00-product/Vision.md`.

## Visión general

```
Navegador (Nuxt 4, Vue 3)
 ├─ páginas y composables ── leen ─────────────▶ Supabase (Postgres + RLS)
 ├─ app/utils/ (cálculo puro, con tests)
 └─ escrituras de varios pasos ── supabase.rpc ─▶ funciones de Postgres (todo o nada)
```

- No hay backend propio ni rutas de servidor: el cliente de Supabase se usa
  desde el navegador, y la seguridad la da Row Level Security (cada profesor
  solo ve y toca lo suyo, por `profesor_id` directo o a través de joins).
- **El cálculo vive en TypeScript** (`app/utils/`), en funciones puras con
  tests: el algoritmo de reparto, qué guardar al editar, cuándo un cambio
  afecta al reparto. Es lo que tiene más lógica y lo que más conviene probar.
- **Las escrituras de varios pasos viven en Postgres**: el navegador calcula
  todo (incluidos los ids de lo nuevo) y llama a una función que lo guarda en
  una transacción. Así un fallo a mitad no puede dejar datos a medias.

## Modelo de datos

```
cursos ─┬─ dias_no_lectivos              (festivos: rangos de fechas)
        ├─ horarios_tipo ─┬─ horario_tipo_vigencias   (tramos en que aplica; sin tramos = todo el curso)
        │                 └─ periodos_horarios        (franjas horarias: 8:00–8:50…)
        └─ grupos ── grupo_asignaturas ── franjas_horarias ── sesiones ── sesion_subtemas
                         │                 (día + periodo,     (fecha,     (fraccion)
                         │                  propia)             estado,        │
asignaturas ─┬─ temas    │                                      notas)        │
             └─ subtemas ┘◀───────────────────────────────────────────────────┘
```

- **Temario**: una asignatura tiene una secuencia única ordenada de temas
  (con sus subtemas de contenido) y elementos sueltos (repaso, examen,
  exposición oral, otro). Todos son filas de `subtemas` (`tipo`; los sueltos
  sin `tema_id`), con su duración en sesiones en bloques de 0,5
  (`duracion_sesiones`). `temas.orden` y `subtemas.orden` comparten contador
  para poder reconstruir cómo se intercalan. Un tema sin puntos se guarda como
  un único subtema con su nombre y duración.
- **Horario**: el horario cuelga de la combinación grupo + asignatura
  (`grupo_asignaturas`), no del grupo ni de la asignatura. Cada franja es un
  día de la semana + un periodo de un horario tipo. Una franja con
  `propia = false` la imparte otra persona (asignatura compartida): cuenta para
  el ritmo del reparto, pero no se marca ni se anota.
- **Sesiones**: la clase de un día concreto en una franja (`unique
  (franja_horaria_id, fecha)`), con estado `propuesta` (recién generada),
  `confirmada`, `cancelada` (clase saltada: no recibe contenido y su día queda
  ocupado; de hoy en adelante se puede recuperar) o `impartida`, y notas
  libres. Una sesión puede
  repartirse entre dos subtemas de 0,5 (`sesion_subtemas.fraccion`).
- **Solapes**: un trigger impide que un profesor tenga dos franjas propias a la
  misma hora en horarios tipo cuyas vigencias coinciden.
- **Borrados en cascada**: borrar un subtema, una franja, un periodo o un
  horario tipo borra en cascada lo que cuelga de ellos, sesiones incluidas.
  Por eso la app nunca borra y recrea al editar (ver `CLAUDE.md`).

Migraciones en `supabase/migrations/` (001–019). Tipos de TypeScript en
`app/types/database.types.ts`, mantenidos a mano.

## Algoritmo de reparto (`app/utils/repartoAlgoritmo.ts`)

Determinista y greedy:

1. `construirSlots`: fechas lectivas reales de cada franja entre dos fechas,
   respetando festivos y los tramos de vigencia de su horario tipo.
2. `agruparEnBloques`: convierte el temario en bloques de sesiones; dos
   subtemas de 0,5 seguidos comparten sesión.
3. `repartirBloques`: asigna los bloques a los huecos en orden. Lo que no cabe
   antes del fin de curso se devuelve aparte y se avisa ("no caben…").

Recolocar (festivo nuevo, saltar o recuperar una clase, cambios de temario, de
horario o de calendario) usa `recolocarDesde`: a partir de una fecha de corte,
las sesiones anteriores, las impartidas y las canceladas se quedan fijas (y su
hueco ocupado, sin contenido en las canceladas), de cada bloque se descuenta lo
ya dado, y el resto se vuelve a repartir. Una cancelada que ya no cae en ningún
hueco se quita. `sesionesAlSaltarUnDia` decide qué sesiones se cancelan al
saltar un día, y `prepararRecuperarClase` vuelve a dar por buenas las clases
canceladas de un día (de hoy en adelante) y pone el corte en su fecha
(`motivoNoSeRecupera` lo rechaza si ese día no recibiría clase).
`recolocacionSinCambios` detecta cuándo eso no cambia nada, para no enseñarlo.

## Flujos de guardado

| Pantalla | Cálculo (`app/utils/`) | Función de Postgres |
|---|---|---|
| Generar / regenerar reparto | `repartirBloques` | `aplicar_recolocacion` (014, 019) |
| Festivo, saltar una clase | `sesionesAlSaltarUnDia`, `recolocarDesde` | `aplicar_recolocacion` (014, 019) |
| Recuperar una clase saltada | `prepararRecuperarClase`, `recolocarDesde` | `aplicar_recolocacion` (014, 019) |
| Editar asignatura | `planificarGuardadoTemario`, `temarioAfectaAlReparto` | `guardar_temario` (015) |
| Nuevo / editar grupo | `planificarGuardadoGrupo` | `guardar_grupo` (016) |
| Asistente de nuevo curso | `construirCursoNuevo` | `crear_curso` (017) |
| Editar curso | `planificarGuardadoCurso`, `calendarioAfectaAlReparto` | `guardar_curso` (018) |

Si un cambio mueve sesiones ya repartidas, antes de guardar se enseña cómo
quedan a partir de hoy (`ResumenRedistribucion`) y temario/horario/calendario y
reparto se guardan en la misma llamada.

## Pruebas

- **Unitarios** (Vitest): `app/utils/*.test.ts` y el store del asistente.
- **E2E** (Playwright, `e2e/curso-completo.spec.ts`): un recorrido completo
  contra el Supabase real con una cuenta de pruebas (`.env.test.local`), que
  crea un curso con el asistente, genera el reparto y pasa por todas las
  ediciones. Al terminar borra por nombre lo que ha creado. Usa fechas fijas
  del curso 2026/27: a partir de junio de 2027 habrá que actualizarlas.
- La CI pasa lint, typecheck y unitarios; el e2e se lanza en local.

## Despliegue y operación

- Vercel despliega `main` automáticamente y crea una preview por PR. Las
  previews usan la misma base de datos que producción.
- Las migraciones se aplican a mano con `supabase db push`, antes de fusionar
  el PR que las necesita.
- Plan gratuito de Supabase: pausa el proyecto tras ~7 días sin actividad (lo
  evita `.github/workflows/supabase-keepalive.yml`) y no tiene copias de
  seguridad restaurables.
