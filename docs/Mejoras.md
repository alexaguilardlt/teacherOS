# Mejoras

## Pendientes

- **Saltar una clase no queda guardado.** Al saltar una clase de un grupo se
  borra esa sesión y se recoloca el resto, pero el día saltado no se guarda en
  ningún sitio: si después se recoloca ese grupo por otro motivo, vuelve a
  tener clase ese día. Idea: marcar la sesión como `cancelada` en vez de
  borrarla y que la recolocación la respete como hueco ocupado.
- **Las notas de sesiones futuras se pierden al recolocar.** La recolocación
  borra las sesiones futuras y crea otras: una nota escrita con antelación se
  pierde. Habría que trasladarla con su subtema. (Sin comprobar todavía.)
- **"No me ha dado tiempo"**: pedir una sesión más para un subtema desde el
  dashboard y empujar el resto (con la vista previa de siempre).
- **Ayudar a encajar lo que no cabe** antes del fin de curso: proponer recortar
  media sesión a subtemas o juntar dos subtemas, con vista previa.
- **Corregir el reparto a mano**: en una primera versión, mover un subtema a la
  sesión anterior o siguiente y recolocar el resto.
- **Vista "Hoy"** al entrar en el dashboard: qué toca hoy en cada grupo, la
  nota de la última sesión y marcar como impartida.
- Drag and drop al crear o editar el temario (hoy hay flechas de subir/bajar).
- Copias de seguridad de la base de datos mientras se esté en el plan gratuito
  de Supabase (no tiene copias restaurables).

## Hechas

- Saltar una clase de una sola asignatura, sin marcar el día entero.
- Festivos de un solo día.
- Notas en las sesiones.
- Que el temario no se vaya más allá del fin de curso: lo que no cabe se avisa.
- Editar temario, grupos y curso sin perder el reparto, con vista previa al
  recolocar y candados en lo ya dado.
- Asignaturas compartidas (franjas que imparte otra persona).
- Todo el guardado de varios pasos en una sola transacción.
