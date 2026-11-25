import { defineConfig } from '@playwright/test';

/**
 * Testes de ponta a ponta (E2E): o app de verdade, num navegador, do jeito que você usa.
 * Rodam no GitHub a cada mudança (workflow "Testar e publicar") e só publicam se passarem.
 * Evidência: relatório HTML com print de cada etapa (artefato "evidencias-e2e" na execução).
 * Local: `npm run e2e` (sobe o build com `vite preview`).
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'relatorio-e2e' }],
    ['json', { outputFile: 'relatorio-e2e/resultado.json' }],
  ],
  use: {
    baseURL: 'http://localhost:4173/financas-app/',
    browserName: 'chromium',
    viewport: { width: 390, height: 844 }, // tela de iPhone
    deviceScaleFactor: 2,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/financas-app/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
