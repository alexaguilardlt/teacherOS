-- =========================================================
-- Sesiones: la instancia real (fecha concreta) de una franja
-- horaria recurrente, con el/los subtema(s) que se imparten
-- ese día. sesion_subtemas.fraccion permite repartir una
-- sesión entre dos subtemas "fáciles" (0.5 sesiones cada uno).
-- Generadas por el algoritmo de reparto en estado "propuesta"
-- hasta que el profesor las confirma.
-- =========================================================

create type estado_sesion as enum ('propuesta', 'confirmada', 'cancelada', 'impartida');

create table sesiones (
  id uuid primary key default gen_random_uuid(),
  franja_horaria_id uuid not null references franjas_horarias(id) on delete cascade,
  fecha date not null,
  estado estado_sesion not null default 'propuesta',
  creado_en timestamptz not null default now(),
  unique (franja_horaria_id, fecha)
);

create index idx_sesiones_franja on sesiones(franja_horaria_id);

create table sesion_subtemas (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references sesiones(id) on delete cascade,
  subtema_id uuid not null references subtemas(id) on delete cascade,
  fraccion numeric(2,1) not null default 1 check (fraccion > 0 and fraccion <= 1),
  creado_en timestamptz not null default now(),
  unique (sesion_id, subtema_id)
);

create index idx_sesion_subtemas_sesion on sesion_subtemas(sesion_id);
create index idx_sesion_subtemas_subtema on sesion_subtemas(subtema_id);

alter table sesiones enable row level security;
alter table sesion_subtemas enable row level security;

create policy "sesiones_owner" on sesiones
  for all using (
    exists (
      select 1 from franjas_horarias f
      join grupo_asignaturas ga on ga.id = f.grupo_asignatura_id
      join grupos g on g.id = ga.grupo_id
      where f.id = sesiones.franja_horaria_id
      and g.profesor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from franjas_horarias f
      join grupo_asignaturas ga on ga.id = f.grupo_asignatura_id
      join grupos g on g.id = ga.grupo_id
      where f.id = sesiones.franja_horaria_id
      and g.profesor_id = auth.uid()
    )
  );

create policy "sesion_subtemas_owner" on sesion_subtemas
  for all using (
    exists (
      select 1 from sesiones s
      join franjas_horarias f on f.id = s.franja_horaria_id
      join grupo_asignaturas ga on ga.id = f.grupo_asignatura_id
      join grupos g on g.id = ga.grupo_id
      where s.id = sesion_subtemas.sesion_id
      and g.profesor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from sesiones s
      join franjas_horarias f on f.id = s.franja_horaria_id
      join grupo_asignaturas ga on ga.id = f.grupo_asignatura_id
      join grupos g on g.id = ga.grupo_id
      where s.id = sesion_subtemas.sesion_id
      and g.profesor_id = auth.uid()
    )
  );
