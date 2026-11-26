import { expect, test } from '@playwright/test';
import { realista, vazio } from './dados';
import { aba, abrir, dados, evidencia, fecharSheet, novoLancamento } from './util';

test.describe('Lançar pelo ＋', () => {
  test('teclado só aparece ao tocar no valor e some no OK', { tag: '@safari' }, async ({ page }, info) => {
    const erros = await abrir(page, vazio());
    await page.locator('.fab').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.sheet .keys')).toHaveCount(0);
    await expect(page.locator('.sheet .amount.tap.zero:not(.ativo)')).toBeVisible(); // mostra "Toque para digitar o valor"
    await evidencia(page, info, '1. abriu o ＋ sem teclado');
    await page.locator('.sheet .amount.tap').click();
    await expect(page.locator('.sheet .keys')).toBeVisible();
    for (const k of '4590') await page.locator(`.sheet .key[aria-label="${k}"]`).click();
    await expect(page.locator('.sheet .amount')).toContainText('45,90');
    await evidencia(page, info, '2. digitou R$ 45,90');
    await page.locator('.sheet .tec-ok').click();
    await expect(page.locator('.sheet .keys')).toHaveCount(0);
    expect(erros).toEqual([]);
  });

  test('saída no Pix entra no extrato e baixa o saldo', { tag: '@safari' }, async ({ page }, info) => {
    const erros = await abrir(page, vazio());
    await novoLancamento(page, '2590', 'Padaria');
    await page.locator('.sheet [data-primary]').click();
    await page.waitForTimeout(600);
    const D = await dados(page);
    expect(D.lancamentos).toHaveLength(1);
    expect(D.lancamentos[0]).toMatchObject({ valor: 2590, desc: 'Padaria', tipo: 'saida', cartaoId: null });
    await expect(page.locator('.hero .big')).toContainText('3.174,10');
    await aba(page, 'Extrato');
    await expect(page.locator('.item:visible', { hasText: 'Padaria' }).first()).toBeVisible();
    await evidencia(page, info, 'extrato com a Padaria');
    expect(erros).toEqual([]);
  });

  test('compra no cartão vai pra fatura (não sai da conta hoje)', { tag: '@safari' }, async ({ page }, info) => {
    const erros = await abrir(page, realista());
    const antes = await page.locator('.hero .big').innerText();
    await novoLancamento(page, '12000', 'Tênis');
    await page.locator('.sheet .chip', { hasText: 'Cartão Laranja' }).click();
    await evidencia(page, info, 'escolheu o cartão');
    await page.locator('.sheet [data-primary]').click();
    await page.waitForTimeout(600);
    const l = (await dados(page)).lancamentos.find((x) => x.desc === 'Tênis')!;
    expect(l.cartaoId).toBe('laranja');
    await expect(page.locator('.hero .big')).toHaveText(antes);
    await aba(page, 'Extrato');
    await expect(page.getByText('sai na fatura').locator('visible=true').first()).toBeVisible();
    expect(erros).toEqual([]);
  });

  test('parcelado em 3x no cartão', async ({ page }) => {
    const erros = await abrir(page, realista());
    await novoLancamento(page, '30000', 'Geladeira');
    await page.locator('.sheet .chip', { hasText: 'Cartão Roxo' }).click();
    await page.locator('.sheet .seg button', { hasText: 'Parcelado' }).click();
    const mais = page.locator('.sheet .stepper button').last();
    while (!(await page.locator('.sheet .stepper').innerText()).includes('3')) await mais.click();
    await page.locator('.sheet [data-primary]').click();
    await page.waitForTimeout(600);
    expect((await dados(page)).lancamentos.find((x) => x.desc === 'Geladeira')).toMatchObject({ parcelas: 3, valor: 30000, cartaoId: 'roxo' });
    expect(erros).toEqual([]);
  });

  test('editar o valor e apagar com desfazer', async ({ page }, info) => {
    const D = vazio();
    D.lancamentos = [{ id: 'x1', tipo: 'saida', valor: 5000, cat: 'lazer', data: '2026-11-24', desc: 'Show', cartaoId: null, parcelas: 1, criado: 1, meio: 'pix' }];
    const erros = await abrir(page, D);
    await aba(page, 'Extrato');
    await page.locator('.item:visible', { hasText: 'Show' }).first().click();
    await page.locator('.sheet .amount.tap').click();
    for (const k of '7000') await page.locator(`.sheet .key[aria-label="${k}"]`).click();
    await page.locator('.sheet .tec-ok').click();
    await page.locator('.sheet [data-primary]').click();
    await page.waitForTimeout(600);
    expect((await dados(page)).lancamentos[0].valor).toBe(7000);
    await page.locator('.item:visible', { hasText: 'Show' }).first().click();
    await page.locator('.sheet').getByRole('button', { name: /apagar/i }).first().click();
    await page.waitForTimeout(500);
    expect((await dados(page)).lancamentos).toHaveLength(0);
    await evidencia(page, info, 'apagado, com Desfazer no aviso');
    await page.locator('.toast').getByText(/desfazer/i).click();
    await page.waitForTimeout(400);
    expect((await dados(page)).lancamentos).toHaveLength(1);
    await fecharSheet(page);
    expect(erros).toEqual([]);
  });

  test('dicionário sugere a categoria certa', async ({ page }) => {
    await abrir(page, vazio());
    const casos: [string, string][] = [['Lâmpadas Smart', 'Casa'], ['TV - Assinatura IPTV', 'Assinaturas'], ['Smart Fit', 'Saúde'], ['Arroz e feijão', 'Mercado']];
    await novoLancamento(page, '1000');
    for (const [desc, cat] of casos) {
      await page.locator('.sheet .smart-desc input').fill(desc);
      await expect(page.locator('.sheet .smart-hint')).toContainText(cat);
    }
  });
});
