# Mejoras

## Pendientes

- **Recuperar una clase saltada.** Una clase saltada queda `cancelada` para
  siempre: si se saltó por error (o la excursión no se hace), no hay forma de
  recuperarla salvo eliminar el reparto entero. Idea: "Recuperar clase", que la
  vuelva a `confirmada` y recoloque desde esa fecha con vista previa.
- Saltar una clase con la vista previa abierta mientras en otra pestaña se
  marca como impartida: no se cancela pero su contenido se reparte otra vez
  (queda duplicado). Muy improbable.
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

- Saltar una clase queda guardado: la sesión pasa a `cancelada` y ninguna
  recolocación ni regeneración vuelve a poner clase ese día.
- Saltar una clase de una sola asignatura, sin marcar el día entero.
- Festivos de un solo día.
- Notas en las sesiones.
- Que el temario no se vaya más allá del fin de curso: lo que no cabe se avisa.
- Editar temario, grupos y curso sin perder el reparto, con vista previa al
  recolocar y candados en lo ya dado.
- Asignaturas compartidas (franjas que imparte otra persona).
- Todo el guardado de varios pasos en una sola transacción.
