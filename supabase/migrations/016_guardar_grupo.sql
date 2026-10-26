-- =========================================================
-- Crear o editar un grupo en una sola transacción.
--
-- Las pantallas de nuevo grupo y de editar grupo lanzaban desde el
-- navegador varias escrituras seguidas (grupo, sus asignaturas, sus
-- franjas, recolocar el reparto, borrar lo quitado). Si algo fallaba a
-- mitad, quedaba un grupo a medio crear o un horario cambiado con el
-- reparto sin recolocar.
--
-- Igual que las migraciones 014 y 015: el cálculo sigue en el navegador
-- (utils/grupo.ts, utils/repartoAlgoritmo.ts) y esta función solo
-- escribe, todo o nada. security invoker: se aplican las políticas de
-- RLS del profesor que la llama.
--
-- Sirve para crear (p_grupo_id es un id nuevo generado en el navegador)
-- y para editar (p_grupo_id ya existe: se actualizan nombre y color).
-- p_grupo_asignaturas_nuevas: [{ id, asignatura_id }]
-- p_franjas: [{ id, grupo_asignatura_id, dia_semana, periodo_id, propia }]
-- p_recolocaciones: el mismo formato que aplicar_recolocacion.
-- =========================================================

create or replace function public.guardar_grupo(
  p_grupo_id uuid,
  p_curso_id uuid,
  p_nombre text,
  p_color text,
  p_grupo_asignaturas_nuevas jsonb,
  p_franjas jsonb,
  p_franja_ids_a_borrar uuid[],
  p_grupo_asignatura_ids_a_borrar uuid[],
  p_recolocaciones jsonb default '[]'
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into grupos (id, profesor_id, curso_id, nombre, color)
  values (p_grupo_id, auth.uid(), p_curso_id, p_nombre, p_color)
  on conflict (id) do update
    set nombre = excluded.nombre,
        color = excluded.color;

  insert into grupo_asignaturas (id, grupo_id, asignatura_id)
  select ga.id, p_grupo_id, ga.asignatura_id
  from jsonb_to_recordset(p_grupo_asignaturas_nuevas) as ga(id uuid, asignatura_id uuid);

  -- Las franjas quitadas van antes que las demás para que no choquen con
  -- una nueva en el mismo hueco (trigger de solape). Solo pueden tener
  -- sesiones futuras, y esas se vuelven a crear al recolocar.
  delete from franjas_horarias
  where id = any(p_franja_ids_a_borrar)
    and grupo_asignatura_id in (select id from grupo_asignaturas where grupo_id = p_grupo_id);

  insert into franjas_horarias (id, grupo_asignatura_id, dia_semana, periodo_id, propia)
  select f.id, f.grupo_asignatura_id, f.dia_semana, f.periodo_id, f.propia
  from jsonb_to_recordset(p_franjas)
    as f(id uuid, grupo_asignatura_id uuid, dia_semana dia_semana, periodo_id uuid, propia boolean)
  where f.grupo_asignatura_id in (select id from grupo_asignaturas where grupo_id = p_grupo_id)
  on conflict (id) do update
    set dia_semana = excluded.dia_semana,
        periodo_id = excluded.periodo_id,
        propia = excluded.propia;

  perform aplicar_recolocacion(p_recolocaciones);

  delete from grupo_asignaturas
  where id = any(p_grupo_asignatura_ids_a_borrar)
    and grupo_id = p_grupo_id;
end;
$$;

revoke execute on function public.guardar_grupo(uuid, uuid, text, text, jsonb, jsonb, uuid[], uuid[], jsonb) from public, anon;
grant execute on function public.guardar_grupo(uuid, uuid, text, text, jsonb, jsonb, uuid[], uuid[], jsonb) to authenticated;
