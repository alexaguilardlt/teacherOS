-- Algunas asignaturas se comparten entre dos profesoras y cada una entra
-- solo a parte de las horas semanales (ej. de 3 horas de Matemáticas, una
-- profesora da 2). La sesión que da la otra persona tiene que seguir
-- contando para el ritmo del reparto del temario, pero no debe aparecer
-- como una sesión propia a impartir (sin botón de "marcar impartida" ni
-- notas, y sin bloquear otras franjas propias a esa misma hora, porque la
-- profesora no está físicamente ahí).
alter table franjas_horarias
  add column propia boolean not null default true;

comment on column franjas_horarias.propia is
  'Falso si esta franja no la imparte el profesor (asignatura compartida): cuenta para el ritmo del reparto pero no es una sesión suya.';

-- Una franja no propia no puede chocar con nada (la profesora no está
-- presente) ni bloquear otras franjas propias que caigan a la misma hora.
create or replace function public.check_franja_sin_solape()
returns trigger as $$
declare
  v_profesor_id uuid;
  v_hora_inicio time;
  v_hora_fin time;
  v_horario_tipo_id uuid;
begin
  if new.propia is false then
    return new;
  end if;

  select g.profesor_id into v_profesor_id
  from grupo_asignaturas ga
  join grupos g on g.id = ga.grupo_id
  where ga.id = new.grupo_asignatura_id;

  select p.hora_inicio, p.hora_fin, p.horario_tipo_id
    into v_hora_inicio, v_hora_fin, v_horario_tipo_id
  from periodos_horarios p
  where p.id = new.periodo_id;

  perform 1
  from franjas_horarias f
  join grupo_asignaturas ga on ga.id = f.grupo_asignatura_id
  join grupos g on g.id = ga.grupo_id
  join periodos_horarios p on p.id = f.periodo_id
  where g.profesor_id = v_profesor_id
    and f.propia
    and f.dia_semana = new.dia_semana
    and f.id is distinct from new.id
    and p.hora_inicio < v_hora_fin
    and v_hora_inicio < p.hora_fin
    and public.vigencias_solapan(v_horario_tipo_id, p.horario_tipo_id)
  limit 1;

  if found then
    raise exception 'Ya tienes otra asignatura en ese día y franja horaria'
      using errcode = '23514';
  end if;

  return new;
end;
$$ language plpgsql;
