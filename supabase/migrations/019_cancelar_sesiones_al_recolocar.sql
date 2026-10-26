-- =========================================================
-- Saltar una clase queda guardado.
--
-- Al saltar una clase de un grupo se borraba esa sesión y se recolocaba el
-- resto, pero el "ese día no hay clase" no quedaba en ningún sitio: la
-- siguiente recolocación de ese grupo (por un festivo o un cambio de
-- temario, horario o calendario) volvía a poner clase ese día.
--
-- Ahora la sesión saltada no se borra: pasa a estado 'cancelada' y se queda
-- sin contenido (conserva su fecha y sus notas). El cálculo del reparto
-- (repartoAlgoritmo.ts) trata las canceladas como huecos ocupados.
--
-- aplicar_recolocacion acepta en cada recolocación una lista nueva,
-- sesiones_a_cancelar, que se procesa en la misma transacción. La firma no
-- cambia: guardar_temario, guardar_grupo y guardar_curso la siguen
-- llamando igual. No se borra ni se modifica ningún dato existente.
--
-- Formato completo (sustituye al de la cabecera de la 014):
-- recolocaciones: [{
--   sesiones_a_cancelar: [uuid],  (opcional) quedan 'cancelada', sin contenido
--   sesiones_a_eliminar: [uuid],  se borran (no repetir aquí las canceladas)
--   sesiones_nuevas: [{
--     franja_horaria_id: uuid, fecha: date, estado: estado_sesion,
--     subtemas: [{ subtema_id: uuid, fraccion: numeric }]
--   }]
-- }]
-- festivo (opcional): { curso_id, nombre, fecha_inicio, fecha_fin }
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
    -- Las sesiones canceladas se quedan (con su fecha y sus notas) pero sin
    -- contenido: su día queda ocupado para cualquier recolocación posterior.
    -- Una clase ya impartida nunca se cancela (lo pasado es historia).
    with canceladas as (
      update sesiones
      set estado = 'cancelada'
      where id in (
        select (jsonb_array_elements_text(coalesce(v_recolocacion->'sesiones_a_cancelar', '[]'::jsonb)))::uuid
      )
        and estado not in ('impartida', 'cancelada')
      returning id
    )
    delete from sesion_subtemas where sesion_id in (select id from canceladas);

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

-- create or replace conserva los permisos, pero se repiten por claridad.
revoke execute on function public.aplicar_recolocacion(jsonb, jsonb) from public, anon;
grant execute on function public.aplicar_recolocacion(jsonb, jsonb) to authenticated;
