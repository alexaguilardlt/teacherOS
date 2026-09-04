import { describe, expect, it } from 'vitest'
import { moverEnLista } from './listas'

describe('moverEnLista', () => {
  it('intercambia un elemento con el de arriba', () => {
    const lista = [{ clienteId: 'a' }, { clienteId: 'b' }, { clienteId: 'c' }]
    moverEnLista(lista, 'b', 'arriba')
    expect(lista.map(i => i.clienteId)).toEqual(['b', 'a', 'c'])
  })

  it('intercambia un elemento con el de abajo', () => {
    const lista = [{ clienteId: 'a' }, { clienteId: 'b' }, { clienteId: 'c' }]
    moverEnLista(lista, 'b', 'abajo')
    expect(lista.map(i => i.clienteId)).toEqual(['a', 'c', 'b'])
  })

  it('no hace nada si ya está en el extremo correspondiente', () => {
    const lista = [{ clienteId: 'a' }, { clienteId: 'b' }]
    moverEnLista(lista, 'a', 'arriba')
    expect(lista.map(i => i.clienteId)).toEqual(['a', 'b'])

    moverEnLista(lista, 'b', 'abajo')
    expect(lista.map(i => i.clienteId)).toEqual(['a', 'b'])
  })

  it('no hace nada si el clienteId no existe en la lista', () => {
    const lista = [{ clienteId: 'a' }, { clienteId: 'b' }]
    moverEnLista(lista, 'x', 'arriba')
    expect(lista.map(i => i.clienteId)).toEqual(['a', 'b'])
  })
})
