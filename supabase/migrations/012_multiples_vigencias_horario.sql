-- =========================================================
-- Un horario tipo pasa a poder tener varios tramos de vigencia
-- en vez de uno solo: el caso real que motivó esto es un
-- horario "Reducido" que aplica en septiembre Y en junio (dos
-- tramos separados, no un único rango). Antes había que crear
-- el horario tipo dos veces (uno por tramo); ahora es uno solo
-- con dos tramos, y al elegir su período se cubren ambos.
--
-- Hay datos reales ya en producción: se migra cada vigencia
-- existente (vigencia_inicio/vigencia_fin) a una fila de la
-- tabla nueva antes de borrar las columnas viejas.
-- =========================================================

create table horario_tipo_vigencias (
  id uuid primary key default gen_random_uuid(),
  horario_tipo_id uuid not null references horarios_tipo(id) on delete cascade,
  fecha_inicio date not null,
  fecha_fin date not null,
  creado_en timestamptz not null default now(),
  check (fecha_fin > fecha_inicio)
);

create index idx_horario_tipo_vigencias_horario on horario_tipo_vigencias(horario_tipo_id);

alter table horario_tipo_vigencias enable row level security;

create policy "horario_tipo_vigencias_owner" on horario_tipo_vigencias
  for all using (
    exists (
      select 1 from horarios_tipo ht
      join cursos c on c.id = ht.curso_id
      where ht.id = horario_tipo_vigencias.horario_tipo_id
      and c.profesor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from horarios_tipo ht
      join cursos c on c.id = ht.curso_id
      where ht.id = horario_tipo_vigencias.horario_tipo_id
      and c.profesor_id = auth.uid()
    )
  );

-- Migrar los horarios tipo que ya tuvieran una vigencia (rango único).
insert into horario_tipo_vigencias (horario_tipo_id, fecha_inicio, fecha_fin)
select id, vigencia_inicio, vigencia_fin
from horarios_tipo
where vigencia_inicio is not null and vigencia_fin is not null;

alter table horarios_tipo drop column vigencia_inicio;
alter table horarios_tipo drop column vigencia_fin;

-- =========================================================
-- El solape ya no compara un único rango de vigencia: comprueba
-- si existe algún tramo de un horario tipo que se cruce con
-- algún tramo del otro. Sin ningún tramo (tabla vacía para ese
-- horario tipo) sigue significando "todo el curso".
-- =========================================================

create or replace function public.vigencias_solapan(ht_a uuid, ht_b uuid)
returns boolean as $$
declare
  v_a_count int;
  v_b_count int;
begin
  select count(*) into v_a_count from horario_tipo_vigencias where horario_tipo_id = ht_a;
  select count(*) into v_b_count from horario_tipo_vigencias where horario_tipo_id = ht_b;

  if v_a_count = 0 or v_b_count = 0 then
    return true;
  end if;

  return exists (
    select 1
    from horario_tipo_vigencias va
    join horario_tipo_vigencias vb on vb.horario_tipo_id = ht_b
    where va.horario_tipo_id = ht_a
      and va.fecha_inicio <= vb.fecha_fin
      and vb.fecha_inicio <= va.fecha_fin
  );
end;
$$ language plpgsql stable;

create or replace function public.check_franja_sin_solape()
returns trigger as $$
declare
  v_profesor_id uuid;
  v_hora_inicio time;
  v_hora_fin time;
  v_horario_tipo_id uuid;
begin
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
