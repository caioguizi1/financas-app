import { expect, test } from '@playwright/test';
import { vazio } from './dados';
import { abrir, evidencia } from './util';
import type { Data, Lancamento } from '../src/lib/types';

/** Dados fictícios controlados (hoje = 25/11/2026): cada número da tela é conferido. */
const D = (): Data => {
  const d = vazio();
  d.cartoes = [{ id: 'roxo', nome: 'Cartão Roxo', fechamento: 30, vencimento: 7 }];
  let n = 0;
  const g = (cat: string, desc: string, data: string, valor: number, o: Partial<Lancamento> = {}): Lancamento =>
    ({ id: `l${n++}`, tipo: 'saida', valor, cat, data, desc, cartaoId: null, parcelas: 1, criado: 1, meio: 'pix', ...o });
  d.lancamentos = [
    g('mercado', 'Mercado Bom Preço', '2026-11-18', 31_240, { cartaoId: 'roxo', meio: 'credito' }), // cartão: conta em novembro (compra)
    g('mercado', 'Hortifruti', '2026-11-14', 8_690),
    g('casa', 'Sofá', '2026-10-20', 90_000, { cartaoId: 'roxo', parcelas: 3, meio: 'credito' }), // 3x: 300 em out, nov e dez
    g('fatura', 'Pagamento fatura', '2026-11-07', 150_000), // não entra
    g('mercado', 'Mercado Bom Preço', '2026-10-10', 20_000),
  ];
  d.recorrentes = [{ id: 'alu', tipo: 'saida', desc: 'Aluguel', cat: 'casa', valor: 180_000, dia: 10, inicio: '2026-01', meio: 'boleto' }];
  return d;
};
// novembro: casa 1.800 (aluguel) + 300 (sofá 2/3) = 2.100 · mercado 312,40 + 86,90 = 399,30 · total 2.499,30
// outubro até o dia 25: casa 1.800 + 300 = 2.100 · mercado 200 → total 2.300

test.describe('Início · Para onde foi', () => {
  test('alterna as visões, soma por categoria e compara com o mês passado', { tag: '@safari' }, async ({ page }, info) => {
    const erros = await abrir(page, D());
    await expect(page.getByRole('tab', { name: 'Visão futura' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.chart')).toBeVisible(); // o gráfico de hoje continua sendo o padrão
    await page.getByRole('tab', { name: 'Para onde foi' }).click();
    await expect(page.locator('.pf-centro')).toContainText('R$ 2.499');
    await expect(page.locator('.pf-nome')).toContainText('novembro');
    const linhas = page.locator('.pf-linha');
    await expect(linhas).toHaveCount(2);
    await expect(linhas.nth(0)).toContainText('Casa'); await expect(linhas.nth(0)).toContainText('R$ 2.100,00'); await expect(linhas.nth(0)).toContainText('84%');
    await expect(linhas.nth(1)).toContainText('Mercado'); await expect(linhas.nth(1)).toContainText('R$ 399,30'); await expect(linhas.nth(1)).toContainText('16%');
    await expect(linhas.nth(1)).toContainText('↑ R$ 199'); // mercado subiu (200 → 399,30)
    await expect(page.locator('.pf-var')).toHaveText('+9% que outubro'); // 2.499,30 ÷ 2.300
    await expect(page.locator('.pf-cmp')).toHaveText('comparando até o dia 25');
    await evidencia(page, info, '1. Para onde foi · novembro');
    await page.getByRole('button', { name: 'Próximo mês' }).isDisabled();
    await page.getByRole('button', { name: 'Mês anterior' }).click();
    await expect(page.locator('.pf-nome')).toContainText('outubro');
    await expect(page.locator('.pf-centro')).toContainText('R$ 2.300');
    await page.getByRole('tab', { name: 'Visão futura' }).click();
    await expect(page.locator('.chart')).toBeVisible();
    expect(erros).toEqual([]);
  });

  test('categoria aberta: histórico, gastos e "Ver no Extrato" já filtrado', async ({ page }, info) => {
    const erros = await abrir(page, D());
    await page.getByRole('tab', { name: 'Para onde foi' }).click();
    await page.locator('.pf-linha', { hasText: 'Mercado' }).click();
    const sh = page.locator('.sheet');
    await expect(sh).toContainText('Mercado · novembro');
    await expect(sh.locator('.pf-it')).toHaveCount(2);
    await expect(sh.locator('.pf-it').first()).toContainText('18/11 · Cartão Roxo');
    await expect(sh.locator('.pf-col')).toHaveCount(4);
    await expect(sh.locator('.pf-col.on')).toContainText('399');
    await evidencia(page, info, 'Mercado · novembro');
    await sh.getByRole('button', { name: 'Ver no Extrato' }).click();
    await page.waitForTimeout(700);
    await expect(page.locator('.tab.on')).toContainText('Extrato');
    await expect(page.locator('main.on .catf .chip.on')).toContainText('Mercado');
    expect(erros).toEqual([]);
  });
});
