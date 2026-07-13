-- =========================================================
-- Períodos horarios del curso (ej: 8:00-8:50, 8:50-9:40...).
-- Se definen una vez por curso y son los que se pueden elegir
-- al asignar horario a un grupo, en vez de escribir una hora
-- libre cada vez.
-- =========================================================

create table periodos_horarios (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references cursos(id) on delete cascade,
  hora_inicio time not null,
  hora_fin time not null,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  check (hora_fin > hora_inicio)
);

create index idx_periodos_curso on periodos_horarios(curso_id);

alter table periodos_horarios enable row level security;

create policy "periodos_horarios_owner" on periodos_horarios
  for all using (
    exists (
      select 1 from cursos c
      where c.id = periodos_horarios.curso_id
      and c.profesor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from cursos c
      where c.id = periodos_horarios.curso_id
      and c.profesor_id = auth.uid()
    )
  );

-- =========================================================
-- franjas_horarias pasa a referenciar un período en vez de
-- guardar hora_inicio/hora_fin sueltos. Se limpian las franjas
-- de prueba existentes: no hay período real al que mapearlas.
-- =========================================================

alter table franjas_horarias add column periodo_id uuid references periodos_horarios(id) on delete cascade;

delete from franjas_horarias;

alter table franjas_horarias alter column periodo_id set not null;
alter table franjas_horarias drop column hora_inicio;
alter table franjas_horarias drop column hora_fin;

create index idx_franjas_periodo on franjas_horarias(periodo_id);

-- =========================================================
-- El chequeo de solape se simplifica: como las franjas ahora
-- son períodos discretos, dos franjas "chocan" si coinciden en
-- día y período, sin necesidad de comparar rangos de horas.
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
    and f.periodo_id = new.periodo_id
    and f.id is distinct from new.id
  limit 1;

  if found then
    raise exception 'Ya tienes otra asignatura en ese día y periodo horario'
      using errcode = '23514';
  end if;

  return new;
end;
$$ language plpgsql;
