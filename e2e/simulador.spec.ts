import { expect, test } from '@playwright/test';
import { realista } from './dados';
import { abrir, dados, evidencia } from './util';

const digitar = async (page: import('@playwright/test').Page, centavos: string) => {
  await page.locator('.sheet .amount.tap').click();
  for (const k of centavos) await page.locator(`.sheet .key[aria-label="${k}"]`).click();
  await page.locator('.sheet .tec-ok').click();
};

test.describe('Simulador "E se eu comprar…?"', () => {
  test('compara à vista e parcelado sem salvar nada; mostra no gráfico e limpa', { tag: '@safari' }, async ({ page }, info) => {
    const D = realista(); D.saldo = { ...D.saldo, valor: 60_000 };
    const erros = await abrir(page, D);
    const antes = await dados(page);
    await evidencia(page, info, '1. botão abaixo do gráfico');
    await page.locator('.sim-btn').click();
    await expect(page.locator('.sheet .sim-vazio')).toBeVisible();
    await digitar(page, '60000');
    await page.locator('.sheet .chip', { hasText: 'Cartão Laranja' }).click();
    await expect(page.locator('.sheet .sim-op')).toHaveCount(2);
    await page.locator('.sheet .chip', { hasText: '+ 3x' }).click();
    await expect(page.locator('.sheet .sim-op')).toHaveCount(3);
    await expect(page.locator('.sheet .sim-op').first()).toContainText('À vista');
    await expect(page.locator('.sheet .sim-op .selo.melhor')).toHaveCount(1);
    await expect(page.locator('.sheet .sim-dica')).not.toBeEmpty();
    await evidencia(page, info, '2. comparação à vista × 2x × 3x');
    await page.getByRole('button', { name: 'Ver no gráfico' }).click();
    await page.waitForTimeout(1300);
    await expect(page.locator('.chart path.ghost')).toHaveCount(1);
    await expect(page.locator('.sim-ativo')).toContainText('Simulando R$ 600,00 em 2x no Cartão Laranja');
    await evidencia(page, info, '3. compra tracejada no gráfico');
    expect(await dados(page)).toEqual(antes); // nada salvo
    await page.getByRole('button', { name: 'Limpar simulação' }).click();
    await expect(page.locator('.chart path.ghost')).toHaveCount(0);
    await expect(page.locator('.sim-btn')).toBeVisible();
    expect(erros).toEqual([]);
  });

  test('Lançar abre o ＋ já preenchido com a opção escolhida', async ({ page }, info) => {
    const erros = await abrir(page, realista());
    await page.locator('.sim-btn').click();
    await digitar(page, '30000');
    await page.locator('.sheet .smart-desc input').fill('Fone');
    await page.locator('.sheet .chip', { hasText: 'Cartão Roxo' }).click();
    await page.locator('.sheet .sim-op', { hasText: '2x' }).click();
    await page.getByRole('button', { name: 'Lançar 2x no Cartão Roxo' }).click();
    await page.waitForTimeout(600);
    await expect(page.locator('.sheet .sheet-head')).toContainText('Novo lançamento');
    await expect(page.locator('.sheet .amount')).toContainText('300,00');
    await expect(page.locator('.sheet .smart-desc input')).toHaveValue('Fone');
    await evidencia(page, info, '＋ preenchido pelo simulador');
    await page.locator('.sheet [data-primary]').click();
    await page.waitForTimeout(600);
    expect((await dados(page)).lancamentos.find((l) => l.desc === 'Fone')).toMatchObject({ valor: 30000, parcelas: 2, cartaoId: 'roxo' });
    await expect(page.locator('.chart path.ghost')).toHaveCount(0); // lançou de verdade: a simulação some
    expect(erros).toEqual([]);
  });

  test('no Pix só existe à vista e sai hoje', async ({ page }) => {
    await abrir(page, realista());
    await page.locator('.sim-btn').click();
    await digitar(page, '5000');
    await page.locator('.sheet .chip', { hasText: 'Pix' }).first().click();
    await expect(page.locator('.sheet .sim-op')).toHaveCount(1);
    await expect(page.locator('.sheet .sim-op')).toContainText('sai hoje');
    await expect(page.getByRole('button', { name: 'Lançar à vista no Pix' })).toBeVisible();
  });
});
