import { expect, test } from '@playwright/test'
import { gotoReady, login } from './auth'
import { fechaLocalISO } from '../app/utils/fechas'
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
  // Recorre el asistente entero, genera el reparto y edita el temario: no
  // cabe en los 30 s por defecto.
  test.setTimeout(300_000)
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
  const urlReparto = page.url()

  await page.getByRole('button', { name: 'Generar reparto' }).click()
  await expect(page.getByText(/Se han creado \d+ sesiones\./)).toBeVisible()

  // Los elementos sueltos (sin tema) también salen con su nombre.
  await expect(page.getByText('Examen parcial').first()).toBeVisible()

  await gotoReady(page, '/dashboard')
  await expect(page.getByText(nombreGrupo).first()).toBeVisible()

  // Editar el temario después de repartir no puede vaciar las sesiones: el
  // subtema se actualiza (mismo id) en vez de borrarse y recrearse.
  await page.getByRole('link', { name: nombreAsignatura, exact: true }).click()
  await page.waitForURL(/\/asignaturas\//)
  const urlAsignatura = page.url()
  await page.getByLabel('Punto del tema', { exact: true }).fill('Fracciones y decimales')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await page.waitForURL('/dashboard')

  // Con el reparto ya generado, el dashboard deja de enlazarlo como
  // pendiente: se vuelve directamente a su página.
  await gotoReady(page, urlReparto)
  await expect(page.getByText('Fracciones y decimales').first()).toBeVisible()
  await expect(page.getByText('Examen parcial').first()).toBeVisible()

  // Las sesiones de este curso de prueba caen en septiembre de 2026: a partir
  // de entonces, lo ya dado no se puede borrar del temario.
  await gotoReady(page, urlAsignatura)
  await expect(page.getByRole('button', { name: /^Ya se dio el 12\/09\/2026/ }).first()).toBeDisabled()

  // Añadir un punto a un temario ya repartido enseña cómo quedará el reparto
  // y, al confirmar, el punto nuevo entra en las sesiones a partir de hoy.
  await page.getByRole('button', { name: 'Añadir punto del tema' }).click()
  await page.getByLabel('Punto del tema', { exact: true }).last().fill('Porcentajes')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Esta asignatura ya está repartida.')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar y recolocar' }).click()
  await page.waitForURL('/dashboard')

  await gotoReady(page, urlReparto)
  await expect(page.getByText('Porcentajes').first()).toBeVisible()

  // Editar el grupo (solo el color) no puede borrar sus sesiones.
  await gotoReady(page, '/dashboard')
  await page.getByRole('link', { name: nombreGrupo, exact: true }).click()
  await page.waitForURL(/\/grupos\//)
  const urlGrupo = page.url()
  await page.locator('input[type="color"]').fill('#ff0000')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await page.waitForURL('/dashboard')
  await gotoReady(page, urlReparto)
  await expect(page.getByText('Porcentajes').first()).toBeVisible()

  // La franja del sábado ya tiene clases dadas (septiembre de 2026): no se
  // puede quitar. Añadir otra franja enseña cómo quedará el reparto.
  await gotoReady(page, urlGrupo)
  await expect(page.getByRole('button', { name: /^Ya hay clases dadas en esta franja/ }).first()).toBeDisabled()
  await page.getByRole('button', { name: 'Añadir franja horaria' }).click()
  await page.getByLabel('Día').last().click()
  await page.getByRole('option', { name: 'Sábado' }).click()
  await page.getByLabel('Franja horaria', { exact: true }).last().click()
  // Aquí las horas vienen de la base de datos, con segundos (07:00:00).
  await page.getByRole('option', { name: /^Normal: 07:00/ }).click()
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('El horario de este grupo ha cambiado.')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar y recolocar' }).click()
  await page.waitForURL('/dashboard')
  await gotoReady(page, urlReparto)
  await expect(page.getByText('Porcentajes').first()).toBeVisible()

  // Crear un grupo nuevo desde fuera del asistente (el curso de la prueba es
  // el más reciente, así que es el que viene elegido).
  const nombreGrupoNuevo = `${nombreGrupo} bis`
  await gotoReady(page, '/grupos/nuevo')
  await page.getByLabel('Nombre del grupo').fill(nombreGrupoNuevo)
  await page.getByRole('checkbox', { name: nombreAsignatura }).check()
  await page.getByRole('button', { name: 'Añadir franja horaria' }).click()
  await page.getByLabel('Día').last().click()
  await page.getByRole('option', { name: 'Domingo' }).click()
  await page.getByLabel('Franja horaria', { exact: true }).last().click()
  await page.getByRole('option', { name: /^Reducido: 06:00/ }).click()
  await page.getByRole('button', { name: 'Crear grupo' }).click()
  await page.waitForURL('/dashboard')
  await expect(page.getByRole('link', { name: nombreGrupoNuevo, exact: true })).toBeVisible()

  // Editar el curso: una franja horaria que usan los grupos no se puede
  // quitar, y un festivo que tapa los próximos dos meses (seguro que cae en
  // días con clase) enseña cómo queda el reparto y lo recoloca.
  const enDias = (dias: number) => {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + dias)
    return fechaLocalISO(fecha)
  }
  await gotoReady(page, '/dashboard')
  await page.getByRole('link', { name: nombreCurso, exact: true }).click()
  await page.waitForURL(/\/curso\//)
  await expect(page.getByRole('button', { name: /^La usan / }).first()).toBeDisabled()
  await page.getByRole('button', { name: 'Añadir festivo' }).click()
  await page.getByLabel('Nombre', { exact: true }).last().fill('Dos meses sin clase')
  await page.getByLabel('Desde', { exact: true }).last().fill(enDias(1))
  await page.getByLabel('Hasta (opcional, solo si dura varios días)').last().fill(enDias(60))
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('El calendario del curso ha cambiado.')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar y recolocar' }).click()
  await page.waitForURL('/dashboard')
  await gotoReady(page, urlReparto)
  await expect(page.getByText('Porcentajes').first()).toBeVisible()

  // Saltar una clase la deja cancelada (no la borra), y sigue cancelada
  // aunque después se recoloque el reparto por otro motivo.
  const fechas = await page.locator('tbody tr td:first-child').allTextContents()
  const fechaSaltada = fechas.map(f => f.trim()).sort().at(-1)!
  await page.getByRole('button', { name: 'Saltar una fecha (solo esta asignatura)' }).click()
  await page.getByLabel('Fecha a saltar').fill(fechaSaltada)
  await page.getByRole('button', { name: 'Previsualizar' }).click()
  await expect(page.getByText('La clase de ese día queda cancelada')).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
  const filaSaltada = page.locator('tbody tr', { hasText: fechaSaltada })
  await expect(filaSaltada).toContainText('Cancelada')

  await gotoReady(page, urlAsignatura)
  await page.getByRole('button', { name: 'Añadir punto del tema' }).click()
  await page.getByLabel('Punto del tema', { exact: true }).last().fill('Proporciones')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Esta asignatura ya está repartida.')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar y recolocar' }).click()
  await page.waitForURL('/dashboard')
  await gotoReady(page, urlReparto)
  await expect(page.locator('tbody tr', { hasText: fechaSaltada })).toContainText('Cancelada')

  // Regenerar el reparto desde cero también respeta el día cancelado.
  await page.getByRole('button', { name: 'Regenerar reparto' }).click()
  await expect(page.getByText(/Se han creado \d+ sesiones\./)).toBeVisible()
  await expect(page.locator('tbody tr', { hasText: fechaSaltada })).toContainText('Cancelada')

  // Recuperar la clase saltada: ese día vuelve a tener clase.
  await page.locator('tbody tr', { hasText: fechaSaltada }).getByRole('button', { name: 'Recuperar clase' }).click()
  await expect(page.getByText('vuelve a tener clase')).toBeVisible()
  await page.getByRole('button', { name: 'Recuperar y recolocar' }).click()
  const filaRecuperada = page.locator('tbody tr', { hasText: fechaSaltada })
  await expect(filaRecuperada).toContainText('Confirmada')
  await expect(filaRecuperada).not.toContainText('Cancelada')
})
