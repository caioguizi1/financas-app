import { expect, test } from '@playwright/test';
import { realista } from './dados';
import { aba, abrir, dados, evidencia } from './util';

/**
 * v2.58 — mudança agendada de um fixo (ex.: "Aluguel no cartão a partir de dezembro") precisa poder ser
 * editada ou cancelada: misclick, teste, ou mudou de ideia. Hoje fixo nos testes: 25/11/2026.
 */
test.describe('Mudança agendada de um fixo', () => {
  test('agenda, edita e cancela a mudança; o fixo volta a ser como era', { tag: '@safari' }, async ({ page }, info) => {
    const erros = await abrir(page, realista());
    const sheet = page.locator('.sheet');
    const versoes = async () => (await dados(page)).recorrentes.filter((r) => r.desc === 'Aluguel').sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
    await aba(page, 'Fixos');
    const linha = page.locator('main.on .item', { hasText: 'Aluguel' }).first();
    // agenda: boleto → Cartão Roxo a partir de dezembro (o de 10/11 já passou)
    await linha.click();
    await sheet.locator('.chip', { hasText: 'Cartão Roxo' }).click();
    await sheet.locator('.sl-foot button', { hasText: 'Salvar' }).click();
    await page.waitForTimeout(600);
    expect((await versoes()).map((v) => [v.inicio, v.fim ?? null, v.cartaoId ?? null])).toEqual([['2026-01', '2026-11', null], ['2026-12', null, 'roxo']]);
    await expect(linha).toContainText('muda em dez/26: Cartão Roxo');
    // reabre: o bloco da mudança agendada, com Editar e Cancelar
    await linha.click();
    const ag = sheet.locator('.agend');
    await expect(ag).toContainText('Mudança agendada · a partir de dez/26');
    await expect(ag).toContainText('Cartão Roxo');
    await evidencia(page, info, 'mudança agendada no fixo');
    // edita a mudança: Roxo → Laranja, sem "vale a partir de" (só mexe nela)
    await ag.getByRole('button', { name: 'Editar mudança' }).click();
    await expect(sheet.locator('.sh-title, .sheet-title, h2, h3').first()).toContainText('Mudança de dez/26');
    await sheet.locator('.chip', { hasText: 'Cartão Laranja' }).click();
    await expect(sheet.locator('.lab', { hasText: 'Vale a partir de' })).toHaveCount(0);
    await evidencia(page, info, 'editando a mudança');
    await sheet.locator('.sl-foot button', { hasText: 'Salvar' }).click();
    await page.waitForTimeout(600);
    expect((await versoes()).map((v) => [v.inicio, v.fim ?? null, v.cartaoId ?? null])).toEqual([['2026-01', '2026-11', null], ['2026-12', null, 'laranja']]);
    await expect(linha).toContainText('muda em dez/26: Cartão Laranja');
    // cancela pela própria tela do fixo
    await linha.click();
    await sheet.locator('.agend').getByRole('button', { name: 'Cancelar mudança' }).click();
    await page.waitForTimeout(600);
    const v = await versoes();
    expect(v).toHaveLength(1);
    expect(v[0].fim).toBeUndefined();
    expect(v[0].meio).toBe('boleto');
    await expect(linha).not.toContainText('muda em');
    await expect(page.locator('.toast')).toContainText('Mudança de dez/26 cancelada');
    await evidencia(page, info, 'mudança cancelada');
    expect(erros).toEqual([]);
  });

  test('pelo histórico: abrir a mudança futura e cancelar por dentro', async ({ page }) => {
    const erros = await abrir(page, realista());
    const sheet = page.locator('.sheet');
    await aba(page, 'Fixos');
    const linha = page.locator('main.on .item', { hasText: 'Internet' }).first();
    await linha.click();
    await sheet.locator('.amount.tap').click();
    await sheet.locator('.key[aria-label="⌫"], .key[aria-label="Apagar"]').first().click();
    await sheet.locator('.key[aria-label="5"]').click();
    await sheet.locator('.tec-ok').click();
    await sheet.locator('.sl-foot button', { hasText: 'Salvar' }).click();
    await page.waitForTimeout(600);
    await linha.click();
    await sheet.getByRole('button', { name: 'Abrir a mudança de dez/26' }).click();
    await sheet.getByRole('button', { name: /Cancelar esta mudança/ }).click();
    await page.waitForTimeout(600);
    expect((await dados(page)).recorrentes.filter((r) => r.desc === 'Internet')).toHaveLength(1);
    expect(erros).toEqual([]);
  });
});
