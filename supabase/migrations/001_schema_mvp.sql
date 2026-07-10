-- =========================================================
-- ERP Profesores — Esquema MVP (fase 1)
-- Solo lo necesario para: registro/login + CRUD de
-- asignaturas, grupos y horarios.
-- El calendario, las sesiones y el algoritmo de distribución
-- se añadirán en una fase posterior.
-- =========================================================

create extension if not exists "pgcrypto";

create type dia_semana as enum ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo');

-- =========================================================
-- Profesores (extiende auth.users de Supabase)
-- =========================================================

create table profesores (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  email text not null,
  creado_en timestamptz not null default now()
);

-- =========================================================
-- Asignaturas
-- =========================================================

create table asignaturas (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references profesores(id) on delete cascade,
  nombre text not null,
  creado_en timestamptz not null default now()
);

create index idx_asignaturas_profesor on asignaturas(profesor_id);

-- =========================================================
-- Grupos
-- =========================================================

create table grupos (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references profesores(id) on delete cascade,
  nombre text not null,
  curso_academico text not null,
  creado_en timestamptz not null default now()
);

create index idx_grupos_profesor on grupos(profesor_id);

-- =========================================================
-- Grupo x Asignatura (un grupo puede cursar varias asignaturas)
-- =========================================================

create table grupo_asignaturas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  asignatura_id uuid not null references asignaturas(id) on delete cascade,
  creado_en timestamptz not null default now(),
  unique (grupo_id, asignatura_id)
);

create index idx_grupo_asignaturas_grupo on grupo_asignaturas(grupo_id);
create index idx_grupo_asignaturas_asignatura on grupo_asignaturas(asignatura_id);

-- =========================================================
-- Franjas horarias
-- =========================================================

create table franjas_horarias (
  id uuid primary key default gen_random_uuid(),
  grupo_asignatura_id uuid not null references grupo_asignaturas(id) on delete cascade,
  dia_semana dia_semana not null,
  hora_inicio time not null,
  hora_fin time not null,
  creado_en timestamptz not null default now(),
  check (hora_fin > hora_inicio)
);

create index idx_franjas_grupo_asignatura on franjas_horarias(grupo_asignatura_id);

-- =========================================================
-- Row Level Security
-- =========================================================

alter table profesores enable row level security;
alter table asignaturas enable row level security;
alter table grupos enable row level security;
alter table grupo_asignaturas enable row level security;
alter table franjas_horarias enable row level security;

create policy "profesores_self" on profesores
  for all using (id = auth.uid());

create policy "asignaturas_owner" on asignaturas
  for all using (profesor_id = auth.uid());

create policy "grupos_owner" on grupos
  for all using (profesor_id = auth.uid());

create policy "grupo_asignaturas_owner" on grupo_asignaturas
  for all using (
    exists (
      select 1 from grupos g
      where g.id = grupo_asignaturas.grupo_id
      and g.profesor_id = auth.uid()
    )
  );

create policy "franjas_horarias_owner" on franjas_horarias
  for all using (
    exists (
      select 1 from grupo_asignaturas ga
      join grupos g on g.id = ga.grupo_id
      where ga.id = franjas_horarias.grupo_asignatura_id
      and g.profesor_id = auth.uid()
    )
  );

-- =========================================================
-- Trigger: crear fila en "profesores" al registrarse
-- =========================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profesores (id, nombre, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', ''), new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();