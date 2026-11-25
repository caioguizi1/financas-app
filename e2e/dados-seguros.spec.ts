import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { HOJE, realista } from './dados';
import { aba, abrir, dados, evidencia } from './util';

test.describe('Seus dados: backup, restauração e sem internet', () => {
  test('exportar → apagar tudo → restaurar devolve tudo igual', async ({ page }, info) => {
    const D = realista();
    delete D.backupEm;
    const erros = await abrir(page, D);
    await aba(page, 'Ajustes');
    await expect(page.locator('.av', { hasText: 'ainda não fez nenhum backup' })).toBeVisible();
    await evidencia(page, info, '1. lembrete: nunca fez backup');
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: /Exportar backup/ }).click();
    const arquivo = await (await dl).path();
    const bk = JSON.parse(readFileSync(arquivo, 'utf8'));
    expect(bk.lancamentos).toHaveLength(150);
    await expect(page.locator('.av', { hasText: 'backup' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Exportar backup/ })).toContainText('Último: hoje');
    await evidencia(page, info, '2. backup feito, lembrete sumiu');
    const antes = await dados(page);
    expect(antes.backupEm).toBe(HOJE);

    // iPhone novo: tudo apagado → boas-vindas → "Já tenho um backup"
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(800);
    await expect(page.getByText('Já tenho um backup')).toBeVisible();
    await evidencia(page, info, '3. app vazio, opção de restaurar');
    const fc = page.waitForEvent('filechooser');
    await page.getByText('Já tenho um backup').click();
    await (await fc).setFiles(arquivo);
    await page.waitForTimeout(1200);
    const depois = await dados(page);
    for (const k of ['lancamentos', 'recorrentes', 'cartoes', 'saldo', 'perfil'] as const) expect(depois[k]).toEqual(antes[k]);
    await expect(page.locator('.tab')).not.toHaveCount(0);
    await evidencia(page, info, '4. restaurado, direto no app');
    expect(erros).toEqual([]);
  });

  test('lembrete volta depois de 30 dias sem backup', async ({ page }) => {
    const D = realista();
    D.backupEm = '2026-10-20';
    await abrir(page, D);
    await aba(page, 'Ajustes');
    await expect(page.locator('.av', { hasText: 'há 36 dias' })).toBeVisible();
  });

  test('funciona sem internet', async ({ page, context }, info) => {
    const erros = await abrir(page, realista());
    await page.waitForTimeout(1500); // service worker guarda o app
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.tab').first()).toBeVisible();
    await page.locator('.fab').click();
    await expect(page.locator('.sheet')).toBeVisible();
    await evidencia(page, info, 'offline: app e ＋ abertos');
    expect(erros.filter((e) => !/net::|Failed to fetch|ERR_INTERNET/.test(e))).toEqual([]);
  });
});
