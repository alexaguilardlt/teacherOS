-- =========================================================
-- Guardar el temario de una asignatura en una sola transacción.
--
-- La pantalla de edición de asignatura lanzaba desde el navegador
-- varias escrituras seguidas (nombre, temas, subtemas, recolocar el
-- reparto, borrar lo quitado). Si algo fallaba a mitad, el temario
-- podía quedar guardado con el reparto sin recolocar.
--
-- Igual que aplicar_recolocacion (migración 014): el cálculo sigue en
-- el navegador (utils/temario.ts, utils/repartoAlgoritmo.ts) y esta
-- función solo escribe, todo o nada. security invoker: se aplican las
-- políticas de RLS del profesor que la llama.
--
-- p_temas:    [{ id, nombre, orden }]
-- p_subtemas: [{ id, tema_id, nombre, tipo, duracion_sesiones, orden }]
-- Todos pasan a pertenecer a p_asignatura_id (no se fía del JSON).
-- p_recolocaciones: el mismo formato que aplicar_recolocacion.
-- =========================================================

create or replace function public.guardar_temario(
  p_asignatura_id uuid,
  p_nombre text,
  p_temas jsonb,
  p_subtemas jsonb,
  p_tema_ids_a_borrar uuid[],
  p_subtema_ids_a_borrar uuid[],
  p_recolocaciones jsonb default '[]'
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update asignaturas set nombre = p_nombre where id = p_asignatura_id;
  if not found then
    raise exception 'No se ha encontrado la asignatura.';
  end if;

  insert into temas (id, asignatura_id, nombre, orden)
  select t.id, p_asignatura_id, t.nombre, t.orden
  from jsonb_to_recordset(p_temas) as t(id uuid, nombre text, orden integer)
  on conflict (id) do update
    set nombre = excluded.nombre,
        orden = excluded.orden;

  insert into subtemas (id, asignatura_id, tema_id, nombre, tipo, duracion_sesiones, orden)
  select s.id, p_asignatura_id, s.tema_id, s.nombre, s.tipo, s.duracion_sesiones, s.orden
  from jsonb_to_recordset(p_subtemas)
    as s(id uuid, tema_id uuid, nombre text, tipo subtema_tipo, duracion_sesiones numeric, orden integer)
  on conflict (id) do update
    set tema_id = excluded.tema_id,
        nombre = excluded.nombre,
        tipo = excluded.tipo,
        duracion_sesiones = excluded.duracion_sesiones,
        orden = excluded.orden;

  -- Las sesiones nuevas ya pueden apuntar a los subtemas nuevos; las que
  -- usaban subtemas quitados se borran aquí antes de quitar los subtemas.
  perform aplicar_recolocacion(p_recolocaciones);

  delete from subtemas where id = any(p_subtema_ids_a_borrar) and asignatura_id = p_asignatura_id;
  delete from temas where id = any(p_tema_ids_a_borrar) and asignatura_id = p_asignatura_id;
end;
$$;

revoke execute on function public.guardar_temario(uuid, text, jsonb, jsonb, uuid[], uuid[], jsonb) from public, anon;
grant execute on function public.guardar_temario(uuid, text, jsonb, jsonb, uuid[], uuid[], jsonb) to authenticated;
