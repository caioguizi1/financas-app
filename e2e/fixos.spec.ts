import { expect, test } from '@playwright/test';
import { realista, vazio } from './dados';
import { aba, abrir, dados, evidencia, fecharSheet, novoLancamento } from './util';

test.describe('Fixos: repetir todo mês, semana ou ano', () => {
  test('pelo ＋: todo mês no cartão, no dia da data escolhida', async ({ page }, info) => {
    const erros = await abrir(page, realista());
    await novoLancamento(page, '2590', 'TV - Assinatura IPTV');
    await page.locator('.sheet .chip', { hasText: 'Cartão Laranja' }).click();
    await page.locator('.sheet input[type=date]').fill('2026-11-26');
    await page.locator('.sheet .chip', { hasText: 'Repete' }).click();
    await expect(page.locator('.ent-extra .chip.on', { hasText: 'Todo dia 26' })).toBeVisible();
    await expect(page.locator('.sheet [data-primary]')).toHaveText('Salvar como fixo');
    await evidencia(page, info, 'opção Repete ligada');
    await page.locator('.sheet [data-primary]').click();
    await page.waitForTimeout(600);
    const r = (await dados(page)).recorrentes.find((x) => x.desc === 'TV - Assinatura IPTV')!;
    expect(r).toMatchObject({ dia: 26, inicio: '2026-11', meio: 'credito', cartaoId: 'laranja', cat: 'assinaturas', valor: 2590 });
    expect(r.freq).toBeUndefined();
    expect(erros).toEqual([]);
  });

  test('pelo ＋: toda semana e todo ano', { tag: '@safari' }, async ({ page }, info) => {
    const erros = await abrir(page, vazio());
    await novoLancamento(page, '8000', 'Feira');
    await page.locator('.sheet input[type=date]').fill('2026-11-28'); // sábado
    await page.locator('.sheet .chip', { hasText: 'Repete' }).click();
    await page.locator('.sheet .seg button', { hasText: 'Toda semana' }).click();
    await expect(page.locator('.ent-extra .chip.on')).toContainText('Todo sábado');
    await evidencia(page, info, 'semanal');
    await page.locator('.sheet [data-primary]').click();
    await page.waitForTimeout(600);
    await novoLancamento(page, '150000', 'IPVA');
    await page.locator('.sheet input[type=date]').fill('2027-03-15');
    await page.locator('.sheet .chip', { hasText: 'Repete' }).click();
    await page.locator('.sheet .seg button', { hasText: 'Todo ano' }).click();
    await expect(page.locator('.ent-extra .chip.on')).toContainText('Todo ano, 15/mar');
    await page.locator('.sheet [data-primary]').click();
    await page.waitForTimeout(600);
    const recs = (await dados(page)).recorrentes;
    expect(recs.find((x) => x.desc === 'Feira')).toMatchObject({ freq: 'semanal', semana: 6 });
    expect(recs.find((x) => x.desc === 'IPVA')).toMatchObject({ freq: 'anual', mes: 3, dia: 15, inicio: '2027-03' });
    await aba(page, 'Fixos');
    await expect(page.locator('.item:visible', { hasText: 'Todo sábado' })).toHaveCount(1);
    await expect(page.locator('.item:visible', { hasText: 'Todo ano, 15/mar' })).toHaveCount(1);
    await evidencia(page, info, 'tela Fixos com semanal e anual');
    expect(erros).toEqual([]);
  });

  test('editar um lançamento seu e transformar em fixo (sem contar duas vezes)', async ({ page }) => {
    const D = vazio();
    D.lancamentos = [{ id: 'a1', tipo: 'saida', valor: 9900, cat: 'saude', data: '2026-11-10', desc: 'Academia', cartaoId: null, parcelas: 1, criado: 1, meio: 'pix' }];
    const erros = await abrir(page, D);
    await aba(page, 'Extrato');
    await page.locator('.item:visible', { hasText: 'Academia' }).first().click();
    await page.locator('.sheet .chip', { hasText: 'Repete' }).click();
    await page.locator('.sheet [data-primary]').click();
    await page.waitForTimeout(600);
    const d = await dados(page);
    expect(d.lancamentos).toHaveLength(0);
    expect(d.recorrentes).toHaveLength(1);
    expect(d.recorrentes[0]).toMatchObject({ desc: 'Academia', dia: 10, inicio: '2026-11' });
    expect(erros).toEqual([]);
  });

  test('avisa quando já existe um fixo com o mesmo nome', async ({ page }, info) => {
    const erros = await abrir(page, realista());
    await novoLancamento(page, '12000', 'Internet');
    await page.locator('.sheet .chip', { hasText: 'Repete' }).click();
    await expect(page.locator('.sheet .av')).toContainText('Você já tem Internet em Fixos');
    await expect(page.locator('.sheet [data-primary]')).toHaveText('Salvar outro fixo mesmo assim');
    await evidencia(page, info, 'aviso de fixo repetido no ＋');
    await fecharSheet(page);
    await aba(page, 'Fixos');
    await page.getByRole('button', { name: '＋ Gasto fixo' }).click();
    await page.locator('.sheet .smart-desc input').fill('aluguel');
    await page.locator('.sheet .amount.tap').click();
    for (const k of '1000') await page.locator(`.sheet .key[aria-label="${k}"]`).click();
    await page.locator('.sheet .tec-ok').click();
    await page.locator('.sheet .daygrid button').nth(9).click();
    await expect(page.locator('.sheet .av')).toContainText('Você já tem Aluguel em Fixos');
    expect(erros).toEqual([]);
  });

  test('novo fixo anual pela tela Fixos (mês e dia)', async ({ page }, info) => {
    const erros = await abrir(page, vazio());
    await aba(page, 'Fixos');
    await page.getByRole('button', { name: '＋ Gasto fixo' }).click();
    await page.locator('.sheet .smart-desc input').fill('Seguro do carro');
    await page.locator('.sheet .amount.tap').click();
    for (const k of '240000') await page.locator(`.sheet .key[aria-label="${k}"]`).click();
    await page.locator('.sheet .tec-ok').click();
    await page.locator('.sheet .seg button', { hasText: 'Todo ano' }).click();
    await page.locator('.sheet .chips.meses .chip', { hasText: 'ago' }).click();
    await page.locator('.sheet .daygrid button').nth(19).click(); // dia 20
    await expect(page.locator('.sheet')).toContainText('Todo ano, 20/ago');
    await evidencia(page, info, 'fixo anual: 20/ago');
    await page.locator('.sheet [data-primary]').click();
    await page.waitForTimeout(600);
    expect((await dados(page)).recorrentes[0]).toMatchObject({ desc: 'Seguro do carro', freq: 'anual', mes: 8, dia: 20, valor: 240000 });
    await expect(page.locator('.item:visible', { hasText: /≈ R\$\s?200(,00)?\/mês/ })).toHaveCount(1);
    expect(erros).toEqual([]);
  });
});
