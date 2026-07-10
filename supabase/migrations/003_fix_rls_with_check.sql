-- =========================================================
-- Fix: las políticas "FOR ALL USING (...)" sin WITH CHECK no
-- se aplican a INSERT/UPDATE (el WITH CHECK queda NULL), así
-- que ningún insert pasaba nunca la política, aunque la fila
-- perteneciera al profesor correcto. Se añade WITH CHECK con
-- la misma condición que ya tenía el USING de cada política.
-- =========================================================

alter policy "profesores_self" on profesores
  with check (id = auth.uid());

alter policy "asignaturas_owner" on asignaturas
  with check (profesor_id = auth.uid());

alter policy "grupos_owner" on grupos
  with check (profesor_id = auth.uid());

alter policy "grupo_asignaturas_owner" on grupo_asignaturas
  with check (
    exists (
      select 1 from grupos g
      where g.id = grupo_asignaturas.grupo_id
      and g.profesor_id = auth.uid()
    )
  );

alter policy "franjas_horarias_owner" on franjas_horarias
  with check (
    exists (
      select 1 from grupo_asignaturas ga
      join grupos g on g.id = ga.grupo_id
      where ga.id = franjas_horarias.grupo_asignatura_id
      and g.profesor_id = auth.uid()
    )
  );

alter policy "cursos_owner" on cursos
  with check (profesor_id = auth.uid());

alter policy "dias_no_lectivos_owner" on dias_no_lectivos
  with check (
    exists (
      select 1 from cursos c
      where c.id = dias_no_lectivos.curso_id
      and c.profesor_id = auth.uid()
    )
  );

alter policy "temas_owner" on temas
  with check (
    exists (
      select 1 from asignaturas a
      where a.id = temas.asignatura_id
      and a.profesor_id = auth.uid()
    )
  );

alter policy "subtemas_owner" on subtemas
  with check (
    exists (
      select 1 from temas t
      join asignaturas a on a.id = t.asignatura_id
      where t.id = subtemas.tema_id
      and a.profesor_id = auth.uid()
    )
  );
