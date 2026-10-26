import type { ElementoTemarioWizard, TipoElementoSuelto } from '../stores/cursoWizard.types'

export interface FilaTema {
  id: string
  asignatura_id: string
  nombre: string
  orden: number
}

export interface FilaSubtema {
  id: string
  asignatura_id: string
  tema_id: string | null
  nombre: string
  tipo: 'contenido' | TipoElementoSuelto
  duracion_sesiones: number
  orden: number
}

export interface PlanGuardadoTemario {
  temas: FilaTema[]
  subtemas: FilaSubtema[]
  temaIdsABorrar: string[]
  subtemaIdsABorrar: string[]
}

// Traduce el temario editado a las filas que hay que guardar, sin borrar y
// recrear todo: el clienteId de cada elemento es su id en la base de datos
// (lo que ya existía se carga con su id; lo nuevo lleva un UUID generado en
// el navegador). Así lo que ya existía se actualiza en vez de recrearse, las
// sesiones ya repartidas siguen apuntando a sus subtemas, y volver a guardar
// tras un fallo a mitad no duplica nada. Solo se borra lo que el profesor
// ha quitado.
//
// temas.orden y subtemas.orden comparten un mismo contador: cada tema
// consume su propia posición antes de sus subtemas de contenido, y así se
// puede reconstruir el orden en que se intercalan temas y elementos sueltos.
export function planificarGuardadoTemario(
  asignaturaId: string,
  elementos: ElementoTemarioWizard[],
  existentes: { temaIds: string[], subtemaIds: string[] },
  nuevoId: () => string = () => crypto.randomUUID()
): PlanGuardadoTemario {
  const temas: FilaTema[] = []
  const subtemas: FilaSubtema[] = []
  let orden = 0

  for (const elemento of elementos) {
    if (elemento.clase === 'tema') {
      const temaId = elemento.clienteId
      temas.push({ id: temaId, asignatura_id: asignaturaId, nombre: elemento.nombre, orden })
      orden += 1

      if (elemento.subtemas.length) {
        for (const subtema of elemento.subtemas) {
          subtemas.push({
            id: subtema.clienteId,
            asignatura_id: asignaturaId,
            tema_id: temaId,
            nombre: subtema.nombre,
            tipo: 'contenido',
            duracion_sesiones: subtema.duracionSesiones,
            orden
          })
          orden += 1
        }
      } else {
        // Tema sin puntos: se reparte como un único bloque con el nombre y
        // la duración del propio tema. Al volver a cargar la pantalla aparece
        // como su único punto, con su propio id.
        subtemas.push({
          id: nuevoId(),
          asignatura_id: asignaturaId,
          tema_id: temaId,
          nombre: elemento.nombre,
          tipo: 'contenido',
          duracion_sesiones: elemento.duracionSesiones,
          orden
        })
        orden += 1
      }
    } else {
      subtemas.push({
        id: elemento.clienteId,
        asignatura_id: asignaturaId,
        tema_id: null,
        nombre: elemento.nombre,
        tipo: elemento.tipo,
        duracion_sesiones: elemento.duracionSesiones,
        orden
      })
      orden += 1
    }
  }

  const temaIdsGuardados = new Set(temas.map(t => t.id))
  const subtemaIdsGuardados = new Set(subtemas.map(s => s.id))

  return {
    temas,
    subtemas,
    temaIdsABorrar: existentes.temaIds.filter(id => !temaIdsGuardados.has(id)),
    subtemaIdsABorrar: existentes.subtemaIds.filter(id => !subtemaIdsGuardados.has(id))
  }
}
