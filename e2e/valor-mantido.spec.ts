import { expect, test, type Page } from '@playwright/test';
import { realista } from './dados';
import { abrir } from './util';

/**
 * v2.52 — relato do app real: editando uma compra, mudar para cartão parcelado e depois mexer no valor
 * "zerava". Causa: ao reabrir o teclado numa edição, o 1º número digitado SUBSTITUÍA o valor inteiro
 * (R$ 78,29 + "5" → R$ 0,05). Agora o teclado sempre continua do valor que está na tela; ⌫ apaga.
 */
test.use({ hasTouch: true, isMobile: true });
const valor = (p: Page) => p.locator('.sheet .amount').first().innerText().then((s) => s.replace(/\s+/g, ''));
const tecla = (p: Page, k: string) => p.locator(`.sheet .key[aria-label="${k}"]`).tap();

test.describe('O valor digitado se mantém', () => {
  test('editando: cartão → parcelado → mexer no valor continua do valor da tela', { tag: '@safari' }, async ({ page }) => {
    await abrir(page, realista());
    await page.locator('.tab', { hasText: 'Extrato' }).tap();
    await page.locator('main.on .item:visible').first().tap();
    const antes = await valor(page); // ex.: R$78,29
    const cents = Math.round(Number(antes.replace(/[^\d,]/g, '').replace(',', '.')) * 100);
    await page.locator('.sheet .chips .chip', { hasText: 'Cartão Roxo' }).tap();
    await page.locator('.sheet .seg button', { hasText: 'Parcelado' }).tap();
    expect(await valor(page)).toBe(antes);
    // reabre o teclado (fechou ao tocar em "Parcelado") e digita
    await page.locator('.sheet .amount.tap').first().tap();
    await tecla(page, '5');
    const depois = await valor(page);
    const c2 = Math.round(Number(depois.replace(/[^\d,]/g, '').replace(',', '.')) * 100);
    expect(c2, `digitar "5" apagou o valor (${antes} → ${depois})`).toBe(cents * 10 + 5);
    // ⌫ volta exatamente para o valor de antes
    await tecla(page, 'Apagar');
    expect(await valor(page)).toBe(antes);
    // fechar e reabrir o teclado várias vezes não muda nada
    for (let i = 0; i < 3; i++) {
      await page.locator('.sheet .tec-ok').tap();
      await page.locator('.sheet .amount.tap').first().tap();
      await tecla(page, '0'); await tecla(page, 'Apagar');
      expect(await valor(page)).toBe(antes);
    }
  });

  test('editando um fixo: reabrir o teclado e digitar continua do valor', async ({ page }) => {
    await abrir(page, realista());
    await page.locator('.tab', { hasText: 'Fixos' }).tap();
    await page.locator('main.on .item:visible', { hasText: 'Internet' }).first().tap();
    const antes = await valor(page);
    const cents = Math.round(Number(antes.replace(/[^\d,]/g, '').replace(',', '.')) * 100);
    await page.locator('.sheet .seg button', { hasText: 'Todo ano' }).tap();
    await page.locator('.sheet .amount.tap').first().tap();
    await tecla(page, '1');
    const c2 = Math.round(Number((await valor(page)).replace(/[^\d,]/g, '').replace(',', '.')) * 100);
    expect(c2).toBe(cents * 10 + 1);
    await tecla(page, 'Apagar');
    expect(await valor(page)).toBe(antes);
  });

  test('segurar o ⌫ limpa o valor; um toque só apaga o último dígito', async ({ page }) => {
    await abrir(page, realista());
    await page.locator('.fab').tap();
    await page.locator('.sheet .amount.tap').first().tap();
    for (const k of '21021') await tecla(page, k);
    await tecla(page, 'Apagar');
    expect(await valor(page)).toBe('R$21,02');
    const apagar = page.locator('.sheet .key[aria-label="Apagar"]');
    await apagar.dispatchEvent('pointerdown');
    await page.waitForTimeout(750);
    await apagar.dispatchEvent('pointerup');
    await apagar.dispatchEvent('click'); // o clique que o navegador manda ao soltar não apaga de novo
    expect(await valor(page)).toBe('R$0,00');
    await tecla(page, '7');
    expect(await valor(page)).toBe('R$0,07');
  });
});
