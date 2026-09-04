import { credencialesTest } from './auth'

// Limpieza directa contra la API de Supabase (no pasa por la UI): borra
// por nombre el curso y la asignatura que haya creado un test, para que
// ejecuciones repetidas no dejen basura acumulada en la cuenta de pruebas
// ni choquen entre sí (ej. franjas con las mismas fechas/horas).
async function tokenTest() {
  const { email, password } = credencialesTest()
  const url = process.env.SUPABASE_URL
  const apikey = process.env.SUPABASE_KEY
  if (!url || !apikey) throw new Error('Faltan SUPABASE_URL / SUPABASE_KEY en el entorno (se cargan desde .env).')

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`No se ha podido autenticar para limpiar datos de prueba: ${JSON.stringify(data)}`)
  return { url, apikey, token: data.access_token as string }
}

async function borrarPorNombre(tabla: string, nombre: string) {
  const { url, apikey, token } = await tokenTest()
  await fetch(`${url}/rest/v1/${tabla}?nombre=eq.${encodeURIComponent(nombre)}`, {
    method: 'DELETE',
    headers: { apikey, Authorization: `Bearer ${token}` }
  })
}

export async function limpiarDatosDePrueba(nombres: { curso?: string, asignatura?: string }) {
  if (nombres.curso) await borrarPorNombre('cursos', nombres.curso)
  if (nombres.asignatura) await borrarPorNombre('asignaturas', nombres.asignatura)
}
