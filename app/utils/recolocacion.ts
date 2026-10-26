import type { SesionRecolocada } from './repartoAlgoritmo'

export type EstadoSesion = 'propuesta' | 'confirmada' | 'cancelada' | 'impartida'

// Un type y no una interface: así encaja con el tipo Json de los argumentos
// de supabase.rpc().
export type RecolocacionJson = {
  // Se quedan, como 'cancelada' y sin contenido (una clase saltada).
  sesiones_a_cancelar: string[]
  sesiones_a_eliminar: string[]
  sesiones_nuevas: {
    franja_horaria_id: string
    fecha: string
    estado: EstadoSesion
    subtemas: { subtema_id: string, fraccion: number }[]
  }[]
}

// Las recolocaciones que el profesor ya ha revisado en una vista previa se
// guardan directamente como confirmadas.
export function recolocacionesConfirmadas(
  previews: { sesionesAEliminarIds: string[], sesionesNuevas: SesionRecolocada[], sesionesACancelarIds?: string[] }[]
): RecolocacionJson[] {
  return previews.map(p => aRecolocacionJson(p.sesionesAEliminarIds, p.sesionesNuevas, 'confirmada', p.sesionesACancelarIds))
}

// Lo que recibe la función de Postgres aplicar_recolocacion (migración 014)
// por cada asignatura-grupo: qué sesiones quitar y cuáles crear, ya con sus
// subtemas, para guardarlo todo en una sola transacción.
export function aRecolocacionJson(
  sesionesAEliminarIds: string[],
  sesionesNuevas: SesionRecolocada[],
  estado: EstadoSesion,
  sesionesACancelarIds: string[] = []
): RecolocacionJson {
  return {
    sesiones_a_cancelar: sesionesACancelarIds,
    sesiones_a_eliminar: sesionesAEliminarIds,
    sesiones_nuevas: sesionesNuevas.map(sesion => ({
      franja_horaria_id: sesion.franjaId,
      fecha: sesion.fecha,
      estado,
      subtemas: sesion.subtemas.map(s => ({ subtema_id: s.subtemaId, fraccion: s.fraccion }))
    }))
  }
}
