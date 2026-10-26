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

1. Definir el temario de una asignatura (temas → subtemas, con su duración
   en sesiones, más exámenes, repasos y otros elementos sueltos).
2. Definir los grupos que cursan cada asignatura y el horario semanal de
   cada combinación grupo+asignatura.
3. Repartir automáticamente ese temario a lo largo del curso, generando una
   sesión por cada clase real (fecha concreta), respetando los días
   lectivos disponibles y la duración de cada subtema.
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

## Estado del desarrollo

Los 6 puntos del objetivo del MVP están cubiertos de principio a fin: auth,
asistente de curso, asignaturas con temario (duración de cada subtema en
sesiones, más exámenes, repasos y otros elementos sueltos), grupos con horario
(incluidas asignaturas compartidas con otra persona), horarios tipo con varios
tramos de vigencia, festivos, reparto automático, redistribución con vista
previa (por festivo, por una clase concreta, o al cambiar temario, horario o
calendario), notas por sesión y dashboard.

Quedan el pulido, los pendientes de `docs/Mejoras.md` y la visión a largo plazo
(integraciones, IA, pagos, compartir planificaciones), que todavía no se ha
empezado a propósito.

Cómo está construido, el modelo de datos y el algoritmo:
`docs/02-architecture/Arquitectura.md`. Reglas de trabajo: `CLAUDE.md`.
