-- =========================================================
-- Recolocar el reparto en una sola transacción.
--
-- Hasta ahora, marcar un festivo, saltar una clase, cambiar el
-- temario o el horario, o regenerar un reparto lanzaba desde el
-- navegador una tanda de escrituras por cada asignatura-grupo
-- (borrar sesiones futuras, crear las nuevas, enlazarlas con sus
-- subtemas). Si algo fallaba a mitad, un grupo podía quedarse sin
-- sesiones.
--
-- El cálculo sigue en el navegador (repartoAlgoritmo.ts, con sus
-- tests); esta función solo escribe el resultado, todo o nada.
-- Es security invoker: se ejecuta con los permisos del profesor
-- que la llama, así que las políticas de RLS se siguen aplicando.
--
-- recolocaciones: [{
--   sesiones_a_eliminar: [uuid],
--   sesiones_nuevas: [{
--     franja_horaria_id: uuid, fecha: date, estado: estado_sesion,
--     subtemas: [{ subtema_id: uuid, fraccion: numeric }]
--   }]
-- }]
-- festivo (opcional): { curso_id, nombre, fecha_inicio, fecha_fin }
--
-- Devuelve cuántas sesiones se han creado.
-- =========================================================

create or replace function public.aplicar_recolocacion(
  recolocaciones jsonb,
  festivo jsonb default null
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_recolocacion jsonb;
  v_sesion jsonb;
  v_sesion_id uuid;
  v_creadas integer := 0;
begin
  if festivo is not null then
    insert into dias_no_lectivos (curso_id, nombre, fecha_inicio, fecha_fin)
    values (
      (festivo->>'curso_id')::uuid,
      nullif(festivo->>'nombre', ''),
      (festivo->>'fecha_inicio')::date,
      (festivo->>'fecha_fin')::date
    );
  end if;

  for v_recolocacion in select * from jsonb_array_elements(recolocaciones) loop
    -- Primero se borra: una sesión nueva puede caer en la misma franja y
    -- fecha que una de las que se quitan (unique franja_horaria_id, fecha).
    delete from sesiones
    where id in (
      select (jsonb_array_elements_text(v_recolocacion->'sesiones_a_eliminar'))::uuid
    );

    for v_sesion in select * from jsonb_array_elements(v_recolocacion->'sesiones_nuevas') loop
      insert into sesiones (franja_horaria_id, fecha, estado)
      values (
        (v_sesion->>'franja_horaria_id')::uuid,
        (v_sesion->>'fecha')::date,
        (v_sesion->>'estado')::estado_sesion
      )
      returning id into v_sesion_id;

      insert into sesion_subtemas (sesion_id, subtema_id, fraccion)
      select v_sesion_id, (s->>'subtema_id')::uuid, (s->>'fraccion')::numeric
      from jsonb_array_elements(v_sesion->'subtemas') s;

      v_creadas := v_creadas + 1;
    end loop;
  end loop;

  return v_creadas;
end;
$$;

-- Solo para profesores con sesión iniciada.
revoke execute on function public.aplicar_recolocacion(jsonb, jsonb) from public, anon;
grant execute on function public.aplicar_recolocacion(jsonb, jsonb) to authenticated;
