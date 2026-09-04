import type { Page } from '@playwright/test'

export function credencialesTest() {
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD
  if (!email || !password) {
    throw new Error(
      'Faltan E2E_TEST_EMAIL / E2E_TEST_PASSWORD. Crea .env.test.local en la raíz del proyecto (ver playwright.config.ts).'
    )
  }
  return { email, password }
}

// Si se interactúa con la página antes de que la app termine de
// hidratarse, los eventos se pierden en silencio (sin ningún error): un
// formulario se envía vacío, un enlace no navega... Se usa en cualquier
// `page.goto()`, no solo en el login.
export async function gotoReady(page: Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
}

export async function login(page: Page) {
  const { email, password } = credencialesTest()
  await gotoReady(page, '/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('/dashboard')
}
