-- =========================================================
-- Un profesor no puede tener dos asignaturas (de cualquier
-- grupo) en el mismo día y franja horaria: es la misma
-- persona, no puede dar dos clases a la vez.
-- =========================================================

create or replace function public.check_franja_sin_solape()
returns trigger as $$
declare
  v_profesor_id uuid;
begin
  select g.profesor_id into v_profesor_id
  from grupo_asignaturas ga
  join grupos g on g.id = ga.grupo_id
  where ga.id = new.grupo_asignatura_id;

  perform 1
  from franjas_horarias f
  join grupo_asignaturas ga on ga.id = f.grupo_asignatura_id
  join grupos g on g.id = ga.grupo_id
  where g.profesor_id = v_profesor_id
    and f.dia_semana = new.dia_semana
    and f.id is distinct from new.id
    and f.hora_inicio < new.hora_fin
    and new.hora_inicio < f.hora_fin
  limit 1;

  if found then
    raise exception 'Ya tienes otra asignatura en ese día y franja horaria'
      using errcode = '23514';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_franjas_sin_solape
  before insert or update on franjas_horarias
  for each row execute procedure public.check_franja_sin_solape();
