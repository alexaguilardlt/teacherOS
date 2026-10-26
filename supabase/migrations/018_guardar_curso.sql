-- =========================================================
-- Editar un curso en una sola transacción, sin perder sesiones.
--
-- La pantalla de editar curso lanzaba desde el navegador decenas de
-- escrituras (curso, festivos borrados y recreados, horarios tipo,
-- vigencias, franjas horarias). Además, quitar una franja horaria (o un
-- horario tipo entero) borraba en cascada las franjas de los grupos que la
-- usaban y todas sus sesiones, también las ya dadas; y cambiar fechas,
-- festivos o vigencias no recolocaba el reparto.
--
-- Ahora, igual que las migraciones 014 a 017: el cálculo sigue en el
-- navegador (utils/curso.ts, recolocación con vista previa) y esta función
-- solo escribe, todo o nada. security invoker: se aplican las políticas de
-- RLS del profesor que la llama.
--
-- Una franja horaria que usa algún grupo no se puede quitar (tampoco
-- quitando su horario tipo): primero hay que quitarla de esos grupos.
--
-- p_festivos:      [{ nombre, fecha_inicio, fecha_fin }] (sustituyen a los que hay)
-- p_horarios_tipo: [{ id, nombre }]
-- p_vigencias:     [{ id, horario_tipo_id, fecha_inicio, fecha_fin }]
-- p_periodos:      [{ id, horario_tipo_id, hora_inicio, hora_fin, orden }]
-- p_recolocaciones: el mismo formato que aplicar_recolocacion.
-- =========================================================

create or replace function public.guardar_curso(
  p_curso_id uuid,
  p_nombre text,
  p_fecha_inicio date,
  p_fecha_fin date,
  p_festivos jsonb,
  p_horarios_tipo jsonb,
  p_vigencias jsonb,
  p_periodos jsonb,
  p_horario_tipo_ids_a_borrar uuid[],
  p_vigencia_ids_a_borrar uuid[],
  p_periodo_ids_a_borrar uuid[],
  p_recolocaciones jsonb default '[]'
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update cursos
  set nombre = p_nombre, fecha_inicio = p_fecha_inicio, fecha_fin = p_fecha_fin
  where id = p_curso_id;
  if not found then
    raise exception 'No se ha encontrado el curso.';
  end if;

  if exists (
    select 1
    from franjas_horarias f
    join periodos_horarios p on p.id = f.periodo_id
    where p.id = any(p_periodo_ids_a_borrar)
       or p.horario_tipo_id = any(p_horario_tipo_ids_a_borrar)
  ) then
    raise exception 'Hay grupos que usan alguna de las franjas horarias que quieres quitar: quítala antes de sus horarios.';
  end if;

  delete from dias_no_lectivos where curso_id = p_curso_id;
  insert into dias_no_lectivos (curso_id, nombre, fecha_inicio, fecha_fin)
  select p_curso_id, f.nombre, f.fecha_inicio, f.fecha_fin
  from jsonb_to_recordset(p_festivos) as f(nombre text, fecha_inicio date, fecha_fin date);

  delete from horario_tipo_vigencias
  where id = any(p_vigencia_ids_a_borrar)
    and horario_tipo_id in (select id from horarios_tipo where curso_id = p_curso_id);
  delete from periodos_horarios
  where id = any(p_periodo_ids_a_borrar)
    and horario_tipo_id in (select id from horarios_tipo where curso_id = p_curso_id);
  delete from horarios_tipo
  where id = any(p_horario_tipo_ids_a_borrar)
    and curso_id = p_curso_id;

  insert into horarios_tipo (id, curso_id, nombre)
  select h.id, p_curso_id, h.nombre
  from jsonb_to_recordset(p_horarios_tipo) as h(id uuid, nombre text)
  on conflict (id) do update
    set nombre = excluded.nombre;

  insert into horario_tipo_vigencias (id, horario_tipo_id, fecha_inicio, fecha_fin)
  select v.id, v.horario_tipo_id, v.fecha_inicio, v.fecha_fin
  from jsonb_to_recordset(p_vigencias) as v(id uuid, horario_tipo_id uuid, fecha_inicio date, fecha_fin date)
  where v.horario_tipo_id in (select id from horarios_tipo where curso_id = p_curso_id)
  on conflict (id) do update
    set fecha_inicio = excluded.fecha_inicio,
        fecha_fin = excluded.fecha_fin;

  insert into periodos_horarios (id, horario_tipo_id, hora_inicio, hora_fin, orden)
  select p.id, p.horario_tipo_id, p.hora_inicio, p.hora_fin, p.orden
  from jsonb_to_recordset(p_periodos)
    as p(id uuid, horario_tipo_id uuid, hora_inicio time, hora_fin time, orden integer)
  where p.horario_tipo_id in (select id from horarios_tipo where curso_id = p_curso_id)
  on conflict (id) do update
    set hora_inicio = excluded.hora_inicio,
        hora_fin = excluded.hora_fin,
        orden = excluded.orden;

  perform aplicar_recolocacion(p_recolocaciones);
end;
$$;

revoke execute on function public.guardar_curso(uuid, text, date, date, jsonb, jsonb, jsonb, jsonb, uuid[], uuid[], uuid[], jsonb) from public, anon;
grant execute on function public.guardar_curso(uuid, text, date, date, jsonb, jsonb, jsonb, jsonb, uuid[], uuid[], uuid[], jsonb) to authenticated;
