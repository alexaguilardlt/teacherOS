-- =========================================================
-- Crear un curso completo (asistente) en una sola transacción.
--
-- El último paso del asistente lanzaba desde el navegador decenas de
-- escrituras en bucle (curso, festivos, horarios tipo, vigencias,
-- periodos, asignaturas, temas, subtemas, grupos, sus asignaturas y sus
-- franjas). Si algo fallaba a mitad, quedaba un curso a medio crear, y al
-- reintentar se duplicaba lo que sí se había guardado.
--
-- Igual que las migraciones 014 a 016: el cálculo sigue en el navegador
-- (utils/cursoNuevo.ts, con los ids ya generados) y esta función solo
-- escribe, todo o nada. security invoker: se aplican las políticas de RLS
-- del profesor que la llama, y el profesor de cada fila es auth.uid().
--
-- p_datos: { curso, festivos, horarios_tipo, vigencias, periodos,
--            asignaturas, temas, subtemas, grupos, grupo_asignaturas,
--            franjas } (ver construirCursoNuevo).
-- =========================================================

create or replace function public.crear_curso(p_datos jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_curso_id uuid := (p_datos->'curso'->>'id')::uuid;
begin
  insert into cursos (id, profesor_id, nombre, fecha_inicio, fecha_fin)
  values (
    v_curso_id,
    auth.uid(),
    p_datos->'curso'->>'nombre',
    (p_datos->'curso'->>'fecha_inicio')::date,
    (p_datos->'curso'->>'fecha_fin')::date
  );

  insert into dias_no_lectivos (curso_id, nombre, fecha_inicio, fecha_fin)
  select v_curso_id, f.nombre, f.fecha_inicio, f.fecha_fin
  from jsonb_to_recordset(p_datos->'festivos') as f(nombre text, fecha_inicio date, fecha_fin date);

  insert into horarios_tipo (id, curso_id, nombre)
  select h.id, v_curso_id, h.nombre
  from jsonb_to_recordset(p_datos->'horarios_tipo') as h(id uuid, nombre text);

  insert into horario_tipo_vigencias (horario_tipo_id, fecha_inicio, fecha_fin)
  select v.horario_tipo_id, v.fecha_inicio, v.fecha_fin
  from jsonb_to_recordset(p_datos->'vigencias') as v(horario_tipo_id uuid, fecha_inicio date, fecha_fin date);

  insert into periodos_horarios (id, horario_tipo_id, hora_inicio, hora_fin, orden)
  select p.id, p.horario_tipo_id, p.hora_inicio, p.hora_fin, p.orden
  from jsonb_to_recordset(p_datos->'periodos')
    as p(id uuid, horario_tipo_id uuid, hora_inicio time, hora_fin time, orden integer);

  insert into asignaturas (id, profesor_id, nombre)
  select a.id, auth.uid(), a.nombre
  from jsonb_to_recordset(p_datos->'asignaturas') as a(id uuid, nombre text);

  insert into temas (id, asignatura_id, nombre, orden)
  select t.id, t.asignatura_id, t.nombre, t.orden
  from jsonb_to_recordset(p_datos->'temas') as t(id uuid, asignatura_id uuid, nombre text, orden integer);

  insert into subtemas (id, asignatura_id, tema_id, nombre, tipo, duracion_sesiones, orden)
  select s.id, s.asignatura_id, s.tema_id, s.nombre, s.tipo, s.duracion_sesiones, s.orden
  from jsonb_to_recordset(p_datos->'subtemas')
    as s(id uuid, asignatura_id uuid, tema_id uuid, nombre text, tipo subtema_tipo, duracion_sesiones numeric, orden integer);

  insert into grupos (id, profesor_id, curso_id, nombre, color)
  select g.id, auth.uid(), v_curso_id, g.nombre, g.color
  from jsonb_to_recordset(p_datos->'grupos') as g(id uuid, nombre text, color text);

  insert into grupo_asignaturas (id, grupo_id, asignatura_id)
  select ga.id, ga.grupo_id, ga.asignatura_id
  from jsonb_to_recordset(p_datos->'grupo_asignaturas') as ga(id uuid, grupo_id uuid, asignatura_id uuid);

  insert into franjas_horarias (id, grupo_asignatura_id, dia_semana, periodo_id, propia)
  select f.id, f.grupo_asignatura_id, f.dia_semana, f.periodo_id, f.propia
  from jsonb_to_recordset(p_datos->'franjas')
    as f(id uuid, grupo_asignatura_id uuid, dia_semana dia_semana, periodo_id uuid, propia boolean);

  return v_curso_id;
end;
$$;

revoke execute on function public.crear_curso(jsonb) from public, anon;
grant execute on function public.crear_curso(jsonb) to authenticated;
