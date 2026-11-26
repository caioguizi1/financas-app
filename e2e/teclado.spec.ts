import { expect, test, type Page } from '@playwright/test';
import { realista } from './dados';
import { aba, abrir, evidencia } from './util';

/**
 * O teclado do app não pode "pular" enquanto você digita: se algo aparece ou some embaixo dele
 * (um botão, um aviso, "Falta o valor"), as teclas mudam de lugar e o dedo erra o número.
 * Mede a posição da tecla "1" antes e depois de cada dígito.
 */
async function digitaSemPular(page: Page, centavos: string, onde: string) {
  const sel = '.sheet .key[aria-label="1"], .ob .key[aria-label="1"]';
  if (!(await page.locator(sel).count())) await page.locator('.sheet .amount.tap, .ob .amount.tap').first().click();
  await page.waitForTimeout(450); // teclado terminou de abrir
  const pos = async () => (await page.locator(sel).first().boundingBox())!.y;
  const y0 = await pos();
  const saltos: string[] = [];
  for (const [i, k] of [...centavos].entries()) {
    await page.locator(`.sheet .key[aria-label="${k}"], .ob .key[aria-label="${k}"]`).first().click();
    await page.waitForTimeout(350);
    const y = await pos();
    if (Math.abs(y - y0) > 1) saltos.push(`${onde}: depois do ${i + 1}º dígito o teclado andou ${Math.round(y - y0)} px`);
  }
  return saltos;
}

test.describe('Teclado não pula enquanto digita', () => {
  test('em todas as telas com teclado', { tag: '@safari' }, async ({ page }, info) => {
    test.setTimeout(180_000);
    const erros = await abrir(page, realista());
    const saltos: string[] = [];
    const fechar = async () => { for (let i = 0; i < 3 && (await page.locator('.sheet').count()); i++) { await page.locator('.sheet').getByRole('button', { name: 'Cancelar' }).first().click().catch(() => page.keyboard.press('Escape')); await page.waitForTimeout(500); } };

    // ＋ saída, entrada e com nome que já é fixo (aviso de repetido)
    await page.locator('.fab').click(); await page.waitForTimeout(500);
    saltos.push(...(await digitaSemPular(page, '2590', '＋ saída')));
    await fechar();
    await page.locator('.fab').click(); await page.waitForTimeout(500);
    await page.locator('.sheet .seg button', { hasText: 'Entrada' }).click();
    saltos.push(...(await digitaSemPular(page, '150000', '＋ entrada')));
    await fechar();

    // simulador: Pix e cartão
    await page.locator('.sim-btn').click(); await page.waitForTimeout(500);
    saltos.push(...(await digitaSemPular(page, '9900', 'simulador (cartão)')));
    await evidencia(page, info, 'simulador digitando');
    await fechar();
    await page.locator('.sim-btn').click(); await page.waitForTimeout(500);
    await page.locator('.sheet .chip', { hasText: 'Pix' }).first().click();
    saltos.push(...(await digitaSemPular(page, '9900', 'simulador (Pix)')));
    await fechar();

    // Fixos: novo gasto (com nome repetido) e nova renda
    await aba(page, 'Fixos');
    await page.getByRole('button', { name: '＋ Gasto fixo' }).click(); await page.waitForTimeout(500);
    await page.locator('.sheet .smart-desc input').fill('Internet');
    saltos.push(...(await digitaSemPular(page, '12000', 'novo gasto fixo')));
    await fechar();
    await page.getByRole('button', { name: '＋ Gasto fixo' }).click(); await page.waitForTimeout(500);
    await page.locator('.sheet .daygrid button').nth(4).click();
    saltos.push(...(await digitaSemPular(page, '8000', 'novo gasto fixo (com dia)')));
    await fechar();

    // ajustar saldo
    await aba(page, 'Início');
    await page.getByRole('button', { name: 'Conferir com o saldo do banco' }).click(); await page.waitForTimeout(500);
    saltos.push(...(await digitaSemPular(page, '450000', 'ajustar saldo')));
    await fechar();

    info.annotations.push({ type: 'cobertura', description: '7 telas com teclado' });
    expect(saltos).toEqual([]);
    expect(erros).toEqual([]);
  });
});
