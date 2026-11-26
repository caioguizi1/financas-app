import { expect, test, type Page } from '@playwright/test';
import { vazio } from './dados';
import { dados, evidencia, novoLancamento } from './util';
import type { Data } from '../src/lib/types';

/**
 * Depois de informar o saldo do banco, o que você lança no mesmo dia tem de descontar —
 * inclusive um fixo criado agora com vencimento hoje (bug da v2.41: não descontava).
 * Este teste roda com o RELÓGIO ANDANDO (sem data fixa): "lançado depois do ajuste" depende disso.
 */
async function abrirComRelogio(page: Page, mexer?: (D: Data, hoje: string) => void) {
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const D = vazio();
  D.saldo = { valor: 320_000, data: hoje, ts: 1 }; D.backupEm = hoje;
  D.cartoes = [{ id: 'roxo', nome: 'Cartão Roxo', fechamento: 30, vencimento: 7 }];
  mexer?.(D, hoje);
  await page.addInitScript((j) => { if (!sessionStorage.getItem('e2e-semeado')) { sessionStorage.setItem('e2e-semeado', '1'); localStorage.clear(); localStorage.setItem('fluxo.v1', j); } }, JSON.stringify(D));
  await page.goto('./'); await page.waitForTimeout(700);
}
async function ajustarSaldo(page: Page, centavos: string) {
  await page.getByRole('button', { name: 'Conferir com o saldo do banco' }).click(); await page.waitForTimeout(500);
  for (let i = 0; i < 8; i++) await page.locator('.sheet .key[aria-label="Apagar"]').click();
  for (const k of centavos) await page.locator(`.sheet .key[aria-label="${k}"]`).click();
  await page.locator('.sheet [data-primary]').click(); await page.waitForTimeout(700);
}
const saldo = (page: Page) => page.locator('.hero .big');

test.describe('Saldo de hoje depois de ajustar com o banco', () => {
  for (const [modo, esperado] of [['Pix', 'R$ 910,10'], ['Pix com "Repete" (fixo de hoje)', 'R$ 910,10'], ['cartão', 'R$ 1.000,00']] as const) {
    test(`lançar no ${modo} depois do ajuste`, { tag: modo.includes('Repete') ? '@safari' : [] }, async ({ page }, info) => {
      await abrirComRelogio(page);
      await ajustarSaldo(page, '100000');
      await expect(saldo(page)).toHaveText('R$ 1.000,00');
      await page.waitForTimeout(30);
      await novoLancamento(page, '8990', 'Fiel Torcedor');
      if (modo === 'cartão') await page.locator('.sheet .chip', { hasText: 'Cartão Roxo' }).click();
      if (modo.includes('Repete')) await page.locator('.sheet .chip', { hasText: 'Repete' }).click();
      await page.locator('.sheet [data-primary]').click(); await page.waitForTimeout(800);
      await expect(saldo(page)).toHaveText(esperado);
      await evidencia(page, info, `saldo depois do Fiel Torcedor (${modo})`);
    });
  }

  test('transformar em fixo um lançamento feito ANTES do ajuste não desconta duas vezes', async ({ page }) => {
    await abrirComRelogio(page, (D, hoje) => {
      D.lancamentos = [{ id: 'ft', tipo: 'saida', valor: 8990, cat: 'lazer', data: hoje, desc: 'Fiel Torcedor', cartaoId: null, parcelas: 1, criado: 2, meio: 'pix' }];
    });
    await ajustarSaldo(page, '100000'); // o banco já mostra o Fiel Torcedor descontado
    await expect(saldo(page)).toHaveText('R$ 1.000,00');
    await page.locator('.tab', { hasText: 'Extrato' }).click(); await page.waitForTimeout(500);
    await page.locator('.item:visible', { hasText: 'Fiel Torcedor' }).first().click(); await page.waitForTimeout(500);
    await page.locator('.sheet .chip', { hasText: 'Repete' }).click();
    await page.locator('.sheet [data-primary]').click(); await page.waitForTimeout(700);
    expect((await dados(page)).recorrentes).toHaveLength(1);
    await page.locator('.tab', { hasText: 'Início' }).click(); await page.waitForTimeout(500);
    await expect(saldo(page)).toHaveText('R$ 1.000,00');
  });
});
