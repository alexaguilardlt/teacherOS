// Fecha (YYYY-MM-DD) en la zona horaria del navegador. toISOString() la da
// en UTC: en España, entre las 00:00 y las 02:00 todavía sería el día
// anterior.
export function fechaLocalISO(fecha: Date = new Date()): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}
