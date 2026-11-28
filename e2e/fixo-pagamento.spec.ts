import { expect, test } from '@playwright/test';
import { realista } from './dados';
import { aba, abrir, dados, evidencia } from './util';

/**
 * v2.57 — mudar como um fixo é pago (ou o dia/valor) depois que a cobrança do mês já passou não pode
 * refazer o passado: vale do mês que vem por padrão, a tela diz onde cai a próxima, e o extrato mostra
 * o fixo no cartão no dia da cobrança. Hoje fixo nos testes: 25/11/2026. Laranja fecha 30 e vence 7.
 */
test.describe('Alterar um fixo: pagamento, dia e valor', () => {
  test('Internet do Pix pro cartão Laranja: vale de dezembro, a próxima vai pra fatura de 07/01 e aparece no extrato', { tag: '@safari' }, async ({ page }, info) => {
    const erros = await abrir(page, realista());
    await aba(page, 'Fixos');
    await page.locator('main.on .item', { hasText: 'Internet' }).first().click();
    const sheet = page.locator('.sheet');
    await sheet.locator('.chip', { hasText: 'Cartão Laranja' }).click();
    // a de 12/nov já passou → o padrão é dezembro, e a tela explica
    await expect(sheet.locator('.lab', { hasText: 'Vale a partir de' })).toBeVisible();
    await expect(sheet.locator('.seg:has(button:has-text("Corrigir tudo")) button.on')).toHaveText('dez/26');
    await expect(sheet.locator('.vig-nota')).toContainText('A cobrança de 12/11 fica como foi.');
    await expect(sheet.locator('.vig-nota')).toContainText('Próxima: 12/12 no Cartão Laranja · entra na fatura que vence 07/01');
    await sheet.locator('.vig-nota').scrollIntoViewIfNeeded();
    await evidencia(page, info, 'vale a partir de dezembro');
    // "Este mês" avisa do risco de contar duas vezes
    await sheet.locator('.seg:has(button:has-text("Corrigir tudo")) button', { hasText: 'Este mês' }).click();
    await expect(sheet.locator('.vig-alerta')).toContainText('pode contar duas vezes');
    await evidencia(page, info, 'aviso do este mês');
    await sheet.locator('.seg:has(button:has-text("Corrigir tudo")) button', { hasText: 'dez/26' }).click();
    await sheet.locator('.sl-foot button', { hasText: 'Salvar' }).click();
    await page.waitForTimeout(600);
    const versoes = (await dados(page)).recorrentes.filter((r) => r.desc === 'Internet').sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
    expect(versoes).toHaveLength(2);
    expect(versoes[0]).toMatchObject({ fim: '2026-11', meio: 'pix' });
    expect(versoes[0].cartaoId ?? null).toBeNull();
    expect(versoes[1]).toMatchObject({ inicio: '2026-12', cartaoId: 'laranja', meio: 'credito' });
    // extrato de dezembro: no dia 12, "no cartão", com a fatura; nada de Internet saindo da conta em dezembro
    await aba(page, 'Extrato');
    await page.locator('main.on [aria-label="Próximo mês"]').click();
    await page.waitForTimeout(500);
    const nc = page.locator('main.on .nc-list .item', { hasText: 'Internet' });
    await expect(nc).toHaveCount(1);
    await expect(nc).toContainText('Fixo · Cartão Laranja · fatura 07/01');
    await expect(page.locator('main.on .list:not(.nc-list) > * .item', { hasText: 'Internet' })).toHaveCount(0);
    await nc.scrollIntoViewIfNeeded();
    await evidencia(page, info, 'extrato de dezembro');
    expect(erros).toEqual([]);
  });

  test('mudar o dia do Aluguel (10 → 28) depois do dia 10: não cobra de novo em novembro', async ({ page }) => {
    const erros = await abrir(page, realista());
    await aba(page, 'Fixos');
    await page.locator('main.on .item', { hasText: 'Aluguel' }).first().click();
    const sheet = page.locator('.sheet');
    await sheet.locator('.daygrid [role=radio], .daygrid button').filter({ hasText: /^28$/ }).first().click();
    await expect(sheet.locator('.seg:has(button:has-text("Corrigir tudo")) button.on')).toHaveText('dez/26');
    await expect(sheet.locator('.vig-nota')).toContainText('Próxima: 28/12 · sai da conta no dia.');
    await sheet.locator('.sl-foot button', { hasText: 'Salvar' }).click();
    await page.waitForTimeout(600);
    const novo = (await dados(page)).recorrentes.find((r) => r.desc === 'Aluguel' && r.inicio === '2026-12');
    expect(novo).toMatchObject({ dia: 28 });
    await aba(page, 'Extrato');
    await expect(page.locator('main.on .item', { hasText: 'Aluguel' })).toHaveCount(1); // só o de 10/11
    expect(erros).toEqual([]);
  });
});
