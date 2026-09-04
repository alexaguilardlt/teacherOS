-- =========================================================
-- Un horario tipo puede tener una vigencia (rango de fechas)
-- en vez de aplicar todo el curso: ej. "Reducido" solo en
-- septiembre y junio, "Normal" el resto. vigencia_inicio y
-- vigencia_fin nulos (el caso por defecto, incluidos los
-- horarios tipo ya existentes) significan "todo el curso".
-- =========================================================

alter table horarios_tipo add column vigencia_inicio date;
alter table horarios_tipo add column vigencia_fin date;

alter table horarios_tipo add constraint horarios_tipo_vigencia_check
  check (
    (vigencia_inicio is null and vigencia_fin is null)
    or (vigencia_inicio is not null and vigencia_fin is not null and vigencia_fin > vigencia_inicio)
  );

-- =========================================================
-- Un grupo ya no sigue un único horario tipo fijo: cada franja
-- horaria elige su período, y ese período ya pertenece a un
-- horario tipo concreto (con su vigencia). Así un mismo grupo
-- puede combinar franjas del horario "Reducido" y del
-- "Normal" según a qué fechas correspondan.
-- =========================================================

alter table grupos drop column horario_tipo_id;

-- =========================================================
-- El solape ya no puede comprobarse solo por día+hora: dos
-- franjas con el mismo día y hora pero de horarios tipo cuya
-- vigencia nunca coincide en el calendario real (ej. Lunes
-- 8-9 del horario "Reducido" de septiembre vs. Lunes 8-9 del
-- horario "Normal" de octubre) no son un conflicto real.
-- =========================================================

create or replace function public.check_franja_sin_solape()
returns trigger as $$
declare
  v_profesor_id uuid;
  v_hora_inicio time;
  v_hora_fin time;
  v_vigencia_inicio date;
  v_vigencia_fin date;
begin
  select g.profesor_id into v_profesor_id
  from grupo_asignaturas ga
  join grupos g on g.id = ga.grupo_id
  where ga.id = new.grupo_asignatura_id;

  select p.hora_inicio, p.hora_fin, ht.vigencia_inicio, ht.vigencia_fin
    into v_hora_inicio, v_hora_fin, v_vigencia_inicio, v_vigencia_fin
  from periodos_horarios p
  join horarios_tipo ht on ht.id = p.horario_tipo_id
  where p.id = new.periodo_id;

  perform 1
  from franjas_horarias f
  join grupo_asignaturas ga on ga.id = f.grupo_asignatura_id
  join grupos g on g.id = ga.grupo_id
  join periodos_horarios p on p.id = f.periodo_id
  join horarios_tipo ht on ht.id = p.horario_tipo_id
  where g.profesor_id = v_profesor_id
    and f.dia_semana = new.dia_semana
    and f.id is distinct from new.id
    and p.hora_inicio < v_hora_fin
    and v_hora_inicio < p.hora_fin
    and coalesce(ht.vigencia_inicio, date '0001-01-01') <= coalesce(v_vigencia_fin, date '9999-12-31')
    and coalesce(v_vigencia_inicio, date '0001-01-01') <= coalesce(ht.vigencia_fin, date '9999-12-31')
  limit 1;

  if found then
    raise exception 'Ya tienes otra asignatura en ese día y franja horaria'
      using errcode = '23514';
  end if;

  return new;
end;
$$ language plpgsql;
