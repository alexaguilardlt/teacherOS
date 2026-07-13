-- =========================================================
-- Reglas de dificultad: cuántas sesiones ocupa un subtema
-- según su dificultad. Configurable por profesor (MVP: se
-- siembra con valores por defecto al registrarse, editables
-- más adelante). 0.5 sesiones significa que dos subtemas
-- "fácil" comparten una misma sesión (ver sesion_subtemas en
-- fase 5, campo fraccion, ya documentado en el proyecto).
-- =========================================================

create table reglas_dificultad (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references profesores(id) on delete cascade,
  dificultad dificultad_subtema not null,
  duracion_sesiones numeric(3,1) not null check (duracion_sesiones > 0),
  creado_en timestamptz not null default now(),
  unique (profesor_id, dificultad)
);

alter table reglas_dificultad enable row level security;

create policy "reglas_dificultad_owner" on reglas_dificultad
  for all using (profesor_id = auth.uid())
  with check (profesor_id = auth.uid());

-- =========================================================
-- Sembrar las reglas por defecto (fácil=0.5, medio=1, difícil=2)
-- al registrarse un profesor nuevo.
-- =========================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profesores (id, nombre, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', ''), new.email);

  insert into public.reglas_dificultad (profesor_id, dificultad, duracion_sesiones)
  values
    (new.id, 'baja', 0.5),
    (new.id, 'media', 1),
    (new.id, 'alta', 2);

  return new;
end;
$$ language plpgsql security definer;
