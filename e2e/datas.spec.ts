import { expect, test, type Page } from '@playwright/test';
import { vazio } from './dados';
import { abrir, dados, evidencia } from './util';

/**
 * v2.53 — relato do app real (Entrada, "Renda extra"):
 *  1. datas rápidas fora de ordem (Hoje, Ontem, 25 nov) e sem data futura;
 *  2. depois de arrastar a fileira, o "Hoje" escolhido ficava cortado na borda;
 *  3. "adicionei e não deu impacto nenhum": com data ANTES do saldo conferido, o valor já está no saldo do
 *     banco e não soma de novo — certo, mas calado. Agora a janela avisa.
 * Hoje fictício = 25/11/2026; saldo conferido hoje (R$ 3.200,00).
 */
test.use({ hasTouch: true, isMobile: true });
const saldoHoje = async (p: Page) => (await p.locator('main.on .hero .big').innerText()).replace(/\s/g, '');
async function novaEntrada(p: Page, cents: string) {
  await p.locator('.fab').tap();
  await p.locator('.sheet .seg button', { hasText: 'Entrada' }).tap();
  await p.locator('.sheet .amount.tap').tap();
  for (const k of cents) await p.locator(`.sheet .key[aria-label="${k}"]`).tap();
  await p.locator('.sheet .tec-ok').tap();
  await p.locator('.sheet .smart-desc input').fill('Venda');
}
const fileira = (p: Page) => p.locator('.sheet .chips.scroll').filter({ hasText: 'Outra data' });

test.describe('Datas rápidas do lançamento', () => {
  test('em ordem de calendário, com amanhã, e o escolhido sempre à vista', { tag: '@safari' }, async ({ page }, info) => {
    await abrir(page, vazio());
    await novaEntrada(page, '10000');
    const row = fileira(page);
    await expect(row.locator('.chip')).toHaveText(['segunda, 23 nov', 'Ontem', 'Hoje', 'Amanhã', 'Outra data']);
    await expect(row.locator('.chip.on')).toHaveText('Hoje');
    const dentro = async () => {
      const r = (await row.boundingBox())!, c = (await row.locator('.chip.on').boundingBox())!;
      return c.x >= r.x + 8 && c.x + c.width <= r.x + r.width - 8;
    };
    expect(await dentro(), '"Hoje" à vista na abertura').toBe(true);
    // arrasta a fileira até o fim e escolhe "Amanhã": o escolhido volta pro meio
    await row.evaluate((e) => e.scrollTo({ left: e.scrollWidth }));
    await row.locator('.chip', { hasText: 'Amanhã' }).tap();
    await page.waitForTimeout(500);
    expect(await dentro(), 'o escolhido ficou cortado na borda').toBe(true);
    await evidencia(page, info, 'datas em ordem, Amanhã escolhido e centralizado');
  });

  test('o cálculo: hoje e amanhã mexem no saldo; antes do saldo conferido, avisa e não soma de novo', { tag: '@safari' }, async ({ page }, info) => {
    await abrir(page, vazio());
    expect(await saldoHoje(page)).toBe('R$3.200,00');
    // hoje: soma no saldo de hoje
    await novaEntrada(page, '10000');
    await expect(page.locator('.sheet .data-aviso')).toHaveCount(0);
    await page.locator('.sheet [data-primary]').tap();
    await expect.poll(() => saldoHoje(page), { timeout: 4000 }).toBe('R$3.300,00');
    // ontem (antes do saldo conferido hoje): avisa na janela e não muda o saldo
    await novaEntrada(page, '5000');
    await fileira(page).locator('.chip', { hasText: 'Ontem' }).tap();
    const aviso = page.locator('.sheet .data-aviso');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('não muda o saldo');
    await expect(aviso).toContainText('25/11');
    await evidencia(page, info, 'aviso: data antes do saldo conferido');
    await page.locator('.sheet [data-primary]').tap();
    await page.waitForTimeout(800);
    expect(await saldoHoje(page)).toBe('R$3.300,00');
    expect((await dados(page)).lancamentos.map((l) => [l.data, l.valor])).toEqual(expect.arrayContaining([['2026-11-24', 5000], ['2026-11-25', 10000]]));
    // amanhã: não muda hoje, mas entra na projeção (o fim do mês sobe)
    const fimAntes = await page.locator('main.on .stat').first().innerText();
    await novaEntrada(page, '2000');
    await fileira(page).locator('.chip', { hasText: 'Amanhã' }).tap();
    await expect(page.locator('.sheet .data-aviso')).toHaveCount(0);
    await page.locator('.sheet [data-primary]').tap();
    await page.waitForTimeout(800);
    expect(await saldoHoje(page)).toBe('R$3.300,00');
    await expect.poll(() => page.locator('main.on .stat').first().innerText()).not.toBe(fimAntes);
  });

  test('cartão não avisa (a fatura é paga depois do saldo)', async ({ page }) => {
    const D = vazio(); D.cartoes = [{ id: 'c1', nome: 'Roxo', fechamento: 8, vencimento: 15 }];
    await abrir(page, D);
    await page.locator('.fab').tap();
    await page.locator('.sheet .chips .chip', { hasText: 'Roxo' }).tap();
    await fileira(page).locator('.chip', { hasText: 'Ontem' }).tap();
    await expect(page.locator('.sheet .data-aviso')).toHaveCount(0);
  });
});
