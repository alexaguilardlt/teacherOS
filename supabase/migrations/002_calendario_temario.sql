-- =========================================================
-- ERP Profesores — Calendario del curso y temario
-- Captura de datos para el calendario escolar (fase 6) y el
-- temario con dificultad (fase 5). Todavía NO se construyen
-- aquí reglas_dificultad ni la redistribución automática:
-- solo las tablas para que el profesor introduzca sus datos
-- desde el asistente de creación de curso.
-- =========================================================

create type dificultad_subtema as enum ('baja', 'media', 'alta');

-- =========================================================
-- Cursos (año académico del profesor)
-- =========================================================

create table cursos (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references profesores(id) on delete cascade,
  nombre text not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  creado_en timestamptz not null default now(),
  check (fecha_fin > fecha_inicio)
);

create index idx_cursos_profesor on cursos(profesor_id);

-- =========================================================
-- Días / periodos no lectivos de un curso
-- =========================================================

create table dias_no_lectivos (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references cursos(id) on delete cascade,
  nombre text,
  fecha_inicio date not null,
  fecha_fin date not null,
  creado_en timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio)
);

create index idx_dias_no_lectivos_curso on dias_no_lectivos(curso_id);

-- =========================================================
-- Temas (temario de una asignatura)
-- =========================================================

create table temas (
  id uuid primary key default gen_random_uuid(),
  asignatura_id uuid not null references asignaturas(id) on delete cascade,
  nombre text not null,
  orden integer not null default 0,
  creado_en timestamptz not null default now()
);

create index idx_temas_asignatura on temas(asignatura_id);

-- =========================================================
-- Subtemas (puntos del tema, con dificultad)
-- =========================================================

create table subtemas (
  id uuid primary key default gen_random_uuid(),
  tema_id uuid not null references temas(id) on delete cascade,
  nombre text not null,
  dificultad dificultad_subtema not null,
  orden integer not null default 0,
  creado_en timestamptz not null default now()
);

create index idx_subtemas_tema on subtemas(tema_id);

-- =========================================================
-- Grupos: pasan a pertenecer a un curso y llevan color
-- para el calendario. Sustituye al campo de texto libre
-- "curso_academico" del schema MVP inicial.
-- =========================================================

-- La tabla está vacía en el MVP (aún no existe CRUD de grupos),
-- así que se puede forzar NOT NULL sin migrar datos existentes.
alter table grupos add column curso_id uuid references cursos(id) on delete cascade;
alter table grupos add column color text not null default '#3b82f6';
alter table grupos alter column curso_id set not null;
alter table grupos drop column curso_academico;

create index idx_grupos_curso on grupos(curso_id);

-- =========================================================
-- Row Level Security
-- =========================================================

alter table cursos enable row level security;
alter table dias_no_lectivos enable row level security;
alter table temas enable row level security;
alter table subtemas enable row level security;

create policy "cursos_owner" on cursos
  for all using (profesor_id = auth.uid());

create policy "dias_no_lectivos_owner" on dias_no_lectivos
  for all using (
    exists (
      select 1 from cursos c
      where c.id = dias_no_lectivos.curso_id
      and c.profesor_id = auth.uid()
    )
  );

create policy "temas_owner" on temas
  for all using (
    exists (
      select 1 from asignaturas a
      where a.id = temas.asignatura_id
      and a.profesor_id = auth.uid()
    )
  );

create policy "subtemas_owner" on subtemas
  for all using (
    exists (
      select 1 from temas t
      join asignaturas a on a.id = t.asignatura_id
      where t.id = subtemas.tema_id
      and a.profesor_id = auth.uid()
    )
  );
