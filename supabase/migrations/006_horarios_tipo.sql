-- =========================================================
-- Un curso puede tener varios "horarios tipo" (ej: "ESO 1º-2º",
-- "ESO 3º-4º y Bachillerato"), cada uno con sus propios
-- períodos. Cada grupo elige qué horario tipo sigue, en vez de
-- que todo el curso comparta un único horario de campana.
-- =========================================================

create table horarios_tipo (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references cursos(id) on delete cascade,
  nombre text not null,
  creado_en timestamptz not null default now()
);

create index idx_horarios_tipo_curso on horarios_tipo(curso_id);

alter table horarios_tipo enable row level security;

create policy "horarios_tipo_owner" on horarios_tipo
  for all using (
    exists (
      select 1 from cursos c
      where c.id = horarios_tipo.curso_id
      and c.profesor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from cursos c
      where c.id = horarios_tipo.curso_id
      and c.profesor_id = auth.uid()
    )
  );

-- =========================================================
-- periodos_horarios pasa a colgar de horario_tipo en vez de
-- curso directamente. No hay datos que migrar (0 filas).
-- =========================================================

drop policy "periodos_horarios_owner" on periodos_horarios;

alter table periodos_horarios add column horario_tipo_id uuid references horarios_tipo(id) on delete cascade;
alter table periodos_horarios alter column horario_tipo_id set not null;
alter table periodos_horarios drop column curso_id;

create index idx_periodos_horario_tipo on periodos_horarios(horario_tipo_id);

create policy "periodos_horarios_owner" on periodos_horarios
  for all using (
    exists (
      select 1 from horarios_tipo ht
      join cursos c on c.id = ht.curso_id
      where ht.id = periodos_horarios.horario_tipo_id
      and c.profesor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from horarios_tipo ht
      join cursos c on c.id = ht.curso_id
      where ht.id = periodos_horarios.horario_tipo_id
      and c.profesor_id = auth.uid()
    )
  );

-- =========================================================
-- Cada grupo elige qué horario tipo sigue.
-- =========================================================

alter table grupos add column horario_tipo_id uuid references horarios_tipo(id) on delete set null;

-- =========================================================
-- El solape ya no puede comprobarse comparando periodo_id
-- directamente: dos horarios_tipo distintos pueden tener
-- períodos con el mismo rango real de horas, y eso también es
-- un conflicto real para el profesor. Se compara el rango de
-- horas efectivo de cada período.
-- =========================================================

create or replace function public.check_franja_sin_solape()
returns trigger as $$
declare
  v_profesor_id uuid;
  v_hora_inicio time;
  v_hora_fin time;
begin
  select g.profesor_id into v_profesor_id
  from grupo_asignaturas ga
  join grupos g on g.id = ga.grupo_id
  where ga.id = new.grupo_asignatura_id;

  select hora_inicio, hora_fin into v_hora_inicio, v_hora_fin
  from periodos_horarios
  where id = new.periodo_id;

  perform 1
  from franjas_horarias f
  join grupo_asignaturas ga on ga.id = f.grupo_asignatura_id
  join grupos g on g.id = ga.grupo_id
  join periodos_horarios p on p.id = f.periodo_id
  where g.profesor_id = v_profesor_id
    and f.dia_semana = new.dia_semana
    and f.id is distinct from new.id
    and p.hora_inicio < v_hora_fin
    and v_hora_inicio < p.hora_fin
  limit 1;

  if found then
    raise exception 'Ya tienes otra asignatura en ese día y franja horaria'
      using errcode = '23514';
  end if;

  return new;
end;
$$ language plpgsql;
