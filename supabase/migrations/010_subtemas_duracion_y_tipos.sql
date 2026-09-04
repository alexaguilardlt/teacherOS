-- =========================================================
-- El profesor deja de elegir una dificultad (baja/media/alta)
-- que se traducía en sesiones vía reglas_dificultad, y en su
-- lugar introduce directamente cuánto dura un subtema, en
-- bloques de 0.5 sesiones. reglas_dificultad deja de tener
-- sentido y desaparece.
--
-- Además de subtemas de contenido (dentro de un tema), una
-- asignatura puede tener elementos sueltos que no pertenecen a
-- ningún tema: repaso, examen parcial, exposiciones orales u
-- otro. Se modelan como una fila más de "subtemas" (mismo
-- mecanismo de reparto y de sesion_subtemas), pero sin tema_id
-- y con un tipo. El orden pasa a ser una secuencia única por
-- asignatura (antes era tema.orden + subtema.orden dentro del
-- tema), así que temas y elementos sueltos se pueden intercalar
-- libremente.
--
-- Solo hay datos de prueba en subtemas a día de hoy, así que se
-- limpian en vez de migrarlos.
-- =========================================================

delete from subtemas;

create type subtema_tipo as enum ('contenido', 'repaso', 'examen', 'exposicion_oral', 'otro');

alter table subtemas add column tipo subtema_tipo not null default 'contenido';
alter table subtemas add column asignatura_id uuid references asignaturas(id) on delete cascade;
alter table subtemas alter column asignatura_id set not null;
alter table subtemas alter column tema_id drop not null;
alter table subtemas add column duracion_sesiones numeric(3,1);
alter table subtemas alter column duracion_sesiones set not null;
alter table subtemas drop column dificultad;

alter table subtemas add constraint subtemas_duracion_check
  check (duracion_sesiones > 0 and duracion_sesiones * 2 = floor(duracion_sesiones * 2));

-- Un subtema de contenido pertenece a un tema; un elemento suelto
-- (repaso, examen, exposición, otro) no pertenece a ninguno.
alter table subtemas add constraint subtemas_tema_segun_tipo_check
  check ((tipo = 'contenido') = (tema_id is not null));

create index idx_subtemas_asignatura on subtemas(asignatura_id);

drop table reglas_dificultad;
drop type dificultad_subtema;

-- =========================================================
-- La política de subtemas ya no necesita pasar por tema_id
-- (que ahora puede ser nulo): asignatura_id es la referencia
-- directa y siempre presente.
-- =========================================================

drop policy "subtemas_owner" on subtemas;

create policy "subtemas_owner" on subtemas
  for all using (
    exists (
      select 1 from asignaturas a
      where a.id = subtemas.asignatura_id
      and a.profesor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from asignaturas a
      where a.id = subtemas.asignatura_id
      and a.profesor_id = auth.uid()
    )
  );
