// Intercambia un elemento con su vecino de arriba o de abajo, en cualquier
// lista con clienteId (temas/elementos sueltos, subtemas, franjas...). No
// hace nada si ya está en el extremo correspondiente.
export function moverEnLista<T extends { clienteId: string }>(lista: T[], clienteId: string, direccion: 'arriba' | 'abajo') {
  const indice = lista.findIndex(item => item.clienteId === clienteId)
  if (indice === -1) return
  const destino = direccion === 'arriba' ? indice - 1 : indice + 1
  if (destino < 0 || destino >= lista.length) return
  const [item] = lista.splice(indice, 1)
  lista.splice(destino, 0, item!)
}
