import { expect, test } from '@playwright/test'
import { gotoReady, login } from './auth'
import { limpiarDatosDePrueba } from './cleanup'

// Recorre el asistente completo con dos horarios tipo (uno con vigencia
// reducida en septiembre, otro "normal" el resto del curso), una
// asignatura con tema+subtema y un elemento suelto (examen), un grupo con
// franjas de ambos horarios, genera el reparto y comprueba que aparece en
// el dashboard. Pensado para detectar justo el tipo de fallo que ya nos
// ha pasado a mano: columnas que faltan en la base de datos, validaciones
// que bloquean sin explicar por qué, celdas del horario que se pisan...
const sufijo = Date.now()
const nombreCurso = `E2E ${sufijo}`
const nombreAsignatura = `Matemáticas E2E ${sufijo}`
const nombreGrupo = `2º ESO E2E ${sufijo}`

// Se borra el curso y la asignatura de este test tanto si pasa como si
// falla, para que ejecuciones repetidas no acumulen datos ni choquen
// entre sí (mismas fechas/horas de una vez para otra).
test.afterEach(async () => {
  await limpiarDatosDePrueba({ curso: nombreCurso, asignatura: nombreAsignatura })
})

test('crear un curso con horario reducido+normal, generar reparto y verlo en el dashboard', async ({ page }) => {
  await login(page)

  await gotoReady(page, '/curso/nuevo')

  await page.getByLabel('Nombre del curso').fill(nombreCurso)
  await page.getByLabel('Inicio del curso').fill('2026-09-09')
  await page.getByLabel('Fin del curso').fill('2027-06-18')

  // Horario "Reducido", vigente solo en septiembre.
  await page.getByRole('button', { name: 'Añadir horario tipo' }).click()
  await page.getByLabel('Nombre del horario').nth(0).fill('Reducido')
  await page.getByRole('button', { name: 'Añadir tramo de vigencia' }).nth(0).click()
  await page.getByLabel('Desde', { exact: true }).nth(0).fill('2026-09-09')
  await page.getByLabel('Hasta', { exact: true }).nth(0).fill('2026-09-30')
  await page.getByRole('button', { name: 'Añadir franja horaria' }).nth(0).click()
  await page.getByLabel('Hora inicio').nth(0).fill('06:00')
  await page.getByLabel('Hora fin').nth(0).fill('07:00')

  // Horario "Normal", vigente el resto del curso.
  await page.getByRole('button', { name: 'Añadir horario tipo' }).click()
  await page.getByLabel('Nombre del horario').nth(1).fill('Normal')
  await page.getByRole('button', { name: 'Añadir tramo de vigencia' }).nth(1).click()
  await page.getByLabel('Desde', { exact: true }).nth(1).fill('2026-10-01')
  await page.getByLabel('Hasta', { exact: true }).nth(1).fill('2027-05-31')
  await page.getByRole('button', { name: 'Añadir franja horaria' }).nth(1).click()
  await page.getByLabel('Hora inicio').nth(1).fill('07:00')
  await page.getByLabel('Hora fin').nth(1).fill('08:00')

  // Festivo real (Navidad, curso 2026/2027).
  await page.getByRole('button', { name: 'Añadir festivo' }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Navidad')
  await page.getByLabel('Desde', { exact: true }).last().fill('2026-12-22')
  await page.getByLabel('Hasta (opcional, solo si dura varios días)').fill('2027-01-06')

  await expect(page.getByRole('link', { name: 'Siguiente' })).toBeEnabled()
  await page.getByRole('link', { name: 'Siguiente' }).click()
  await page.waitForURL('/curso/nuevo/asignaturas')

  // Asignatura con temario y un elemento suelto.
  await page.getByRole('button', { name: 'Añadir asignatura' }).click()
  await page.getByLabel('Nombre de la asignatura').fill(nombreAsignatura)
  await page.getByRole('button', { name: 'Añadir tema' }).click()
  await page.getByLabel('Tema', { exact: true }).fill('Números racionales')
  await page.getByRole('button', { name: 'Añadir punto del tema' }).click()
  await page.getByLabel('Punto del tema', { exact: true }).fill('Fracciones')
  await page.getByLabel('Duración (sesiones)').fill('1.5')
  await page.getByRole('button', { name: 'Añadir examen' }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Examen parcial')

  await expect(page.getByRole('link', { name: 'Siguiente' })).toBeEnabled()
  await page.getByRole('link', { name: 'Siguiente' }).click()
  await page.waitForURL('/curso/nuevo/grupos')

  // Grupo con la asignatura, combinando franjas del horario reducido y del normal.
  await page.getByRole('button', { name: 'Añadir grupo' }).click()
  await page.getByLabel('Nombre del grupo').fill(nombreGrupo)
  await page.getByRole('checkbox', { name: nombreAsignatura }).check()

  // Sábado/domingo a propósito: la cuenta de pruebas puede tener otros
  // cursos reales con franjas entre semana, y así el test nunca choca con
  // ellas por el aviso de solape (que es correcto, no un fallo del test).
  await page.getByRole('button', { name: 'Añadir franja horaria' }).click()
  await page.getByLabel('Día').nth(0).click()
  await page.getByRole('option', { name: 'Sábado' }).click()
  await page.getByLabel('Franja horaria', { exact: true }).nth(0).click()
  await page.getByRole('option', { name: 'Reducido: 06:00–07:00' }).click()

  await page.getByRole('button', { name: 'Añadir franja horaria' }).click()
  await page.getByLabel('Día').nth(1).click()
  await page.getByRole('option', { name: 'Domingo' }).click()
  await page.getByLabel('Franja horaria', { exact: true }).nth(1).click()
  await page.getByRole('option', { name: 'Normal: 07:00–08:00' }).click()

  await expect(page.getByRole('link', { name: 'Siguiente' })).toBeEnabled()
  await page.getByRole('link', { name: 'Siguiente' }).click()
  await page.waitForURL('/curso/nuevo/resumen')

  await expect(page.getByText(nombreCurso, { exact: true })).toBeVisible()
  await expect(page.getByText(nombreGrupo, { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Guardar curso' }).click()
  await page.waitForURL('/dashboard')

  // Generar el reparto desde el enlace directo del dashboard.
  const enlaceReparto = page.getByRole('link', { name: new RegExp(`${nombreAsignatura} — ${nombreGrupo}`) })
  await expect(enlaceReparto).toBeVisible()
  await enlaceReparto.click()
  await page.waitForURL(/\/reparto\//)

  await page.getByRole('button', { name: 'Generar reparto' }).click()
  await expect(page.getByText(/Se han creado \d+ sesiones\./)).toBeVisible()

  await gotoReady(page, '/dashboard')
  await expect(page.getByText(nombreGrupo).first()).toBeVisible()
})
