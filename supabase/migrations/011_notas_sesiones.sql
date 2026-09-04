-- =========================================================
-- El profesor puede dejar una anotación libre en una sesión
-- concreta (ej. "faltó medio grupo", "repasar ejercicio 4 la
-- próxima clase"). No afecta al reparto ni al algoritmo.
-- =========================================================

alter table sesiones add column notas text;
