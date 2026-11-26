import { expect, test } from '@playwright/test';
import { vazio } from './dados';
import { abrir, dados, evidencia } from './util';
import type { Data, Lancamento } from '../src/lib/types';

/** Dados fictícios: Pet Love em outubro (1×), Uber várias vezes por mês, um cartão. */
const comOutubro = (): Data => {
  const D = vazio();
  D.cartoes = [{ id: 'roxo', nome: 'Cartão Roxo', fechamento: 30, vencimento: 7 }];
  const g = (id: string, desc: string, data: string, valor: number): Lancamento => ({ id, tipo: 'saida', valor, cat: 'outros', data, desc, cartaoId: 'roxo', parcelas: 1, criado: 1, meio: 'credito', importado: true });
  D.lancamentos = [g('p10', 'PETLOVE*SAUDE', '2026-10-08', 15_000), g('u1', 'UBER *TRIP', '2026-10-03', 2_300), g('u2', 'UBER *TRIP', '2026-10-17', 2_300)];
  return D;
};

test.describe('"É mensalidade?" — recorrência com pergunta', () => {
  test('no Início: pergunta só o que repete 1×/mês com valor e dia; "Não é" não pergunta mais', { tag: '@safari' }, async ({ page }, info) => {
    const D = comOutubro();
    D.lancamentos.push({ ...D.lancamentos[0], id: 'p11', data: '2026-11-08' }, { ...D.lancamentos[1], id: 'u3', data: '2026-11-03' });
    const erros = await abrir(page, D);
    const card = page.locator('.insight', { hasText: 'PETLOVE' });
    await expect(card).toContainText('todo dia 8?');
    await expect(page.locator('.insight', { hasText: /UBER/i })).toHaveCount(0);
    await evidencia(page, info, '1. pergunta do Pet Love (e nada do Uber)');
    await card.locator('.in-x').click(); // tocar no cartão não responde por você: abre a pergunta inteira
    await page.waitForTimeout(500);
    expect((await dados(page)).recorrentes).toHaveLength(0);
    await expect(page.locator('.sheet')).toContainText('todo dia 8?');
    await evidencia(page, info, '2. pergunta inteira, sem responder sozinho');
    await page.locator('.sheet').getByRole('button', { name: 'Não é' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('.insight', { hasText: 'PETLOVE' })).toHaveCount(0);
    await page.reload(); await page.waitForTimeout(800);
    await expect(page.locator('.insight', { hasText: 'PETLOVE' })).toHaveCount(0);
    expect((await dados(page)).dispensados).toContain('naoMensal:petlove saude');
    expect(erros).toEqual([]);
  });

  test('no Início: "Sim, virar fixo" começa no mês seguinte (a cobrança do mês já está lançada)', async ({ page }) => {
    const D = comOutubro();
    D.lancamentos.push({ ...D.lancamentos[0], id: 'p11', data: '2026-11-08' });
    await abrir(page, D);
    await page.locator('.insight', { hasText: 'PETLOVE' }).getByRole('button', { name: 'Sim, virar fixo' }).click();
    await page.waitForTimeout(500);
    expect((await dados(page)).recorrentes).toEqual([expect.objectContaining({ desc: 'PETLOVE*SAUDE', valor: 15_000, dia: 8, inicio: '2026-12', cartaoId: 'roxo', meio: 'credito' })]);
  });

  test('na importação da 2ª fatura: marca "Todo mês? Virar fixo" e o fixo nasce junto', async ({ page }, info) => {
    const erros = await abrir(page, comOutubro());
    await page.locator('.tab', { hasText: 'Ajustes' }).click(); await page.waitForTimeout(400);
    await page.getByText(/Importar/).first().click(); await page.waitForTimeout(600);
    const fc = page.waitForEvent('filechooser');
    await page.locator('.sheet').getByRole('button', { name: /arquivo|Escolher/i }).first().click();
    await (await fc).setFiles('e2e/fixtures/fatura-ficticia-nov.csv');
    await page.waitForTimeout(1200);
    const pet = page.locator('.imp-it', { hasText: 'PETLOVE' });
    await expect(pet.locator('.imp-mens')).toContainText('Todo mês? Virar fixo');
    await expect(page.locator('.imp-it', { hasText: /UBER/i }).locator('.imp-mens')).toHaveCount(0);
    await pet.locator('.imp-mens').click();
    await expect(pet.locator('.imp-mens')).toContainText('Vira fixo · todo dia 8');
    await evidencia(page, info, 'conferência da importação com a pergunta');
    await page.locator('.sheet [data-primary]').click();
    await page.waitForTimeout(800);
    const d = await dados(page);
    expect(d.recorrentes).toEqual([expect.objectContaining({ desc: 'PETLOVE*SAUDE', dia: 8, inicio: '2026-12', cartaoId: 'roxo' })]);
    expect(d.lancamentos.filter((l) => l.desc === 'PETLOVE*SAUDE')).toHaveLength(2); // outubro + novembro, sem duplicar
    expect(erros).toEqual([]);
  });
});
