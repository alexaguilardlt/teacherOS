import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'node:fs'

// .env (SUPABASE_URL, SUPABASE_KEY) y .env.test.local (E2E_TEST_EMAIL,
// E2E_TEST_PASSWORD; no versionado, ver .gitignore: `.env.*`) hacen falta
// para que los tests puedan iniciar sesión y, en la limpieza posterior,
// llamar directamente a la API de Supabase. Si algún archivo no existe
// todavía, los tests que lo necesiten fallan con un mensaje explícito en
// vez de silenciosamente.
function cargarEnv(archivo: string) {
  let contenido: string
  try {
    contenido = readFileSync(archivo, 'utf-8')
  } catch {
    return
  }
  for (const linea of contenido.split('\n')) {
    const match = linea.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
    if (match) process.env[match[1]!] ??= match[2]
  }
}
cargarEnv('.env')
cargarEnv('.env.test.local')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    // Puerto propio y distinto del 3000 por defecto: evita que los tests
    // se conecten sin querer a otro proyecto que tengas corriendo en local.
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: {
    command: 'pnpm dev --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
})
