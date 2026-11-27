import { expect, test, type Page } from '@playwright/test';
import { realista } from './dados';
import { abrir, contrasteBaixo, evidencia, problemasNaTela } from './util';
import type { Data, Lancamento, Recorrente } from '../src/lib/types';

/**
 * v2.47 — "Pra não ficar negativo": cartão compacto no lugar do aviso vermelho do Início.
 * Dados fictícios (hoje = 25/11/2026). A promessa do cartão é conferida de verdade: lançando o valor
 * que ele diz até a data que ele diz, o cartão some (nenhum dia fica negativo).
 */
const contaGrande: Lancamento = { id: 'x1', tipo: 'saida', valor: 250_000, cat: 'casa', data: '2026-12-18', desc: 'Conta grande', meio: 'pix', criado: 1, cartaoId: null, parcelas: 1 };
const pontual = (): Data => { const D = realista(); D.saldo = { ...D.saldo, valor: 60_000 }; D.lancamentos.push(contaGrande); return D; };
const repete = (): Data => {
  const D = realista(); D.saldo = { ...D.saldo, valor: 60_000 };
  D.recorrentes.push({ id: 'fin', tipo: 'saida', desc: 'Financiamento', cat: 'casa', valor: 260_000, dia: 15, inicio: '2026-12', meio: 'boleto' } as Recorrente);
  return D;
};
const centavos = (t: string) => { const m = t.replace(/\s/g, '').match(/([−-])?R\$([\d.]+,\d{2})/)!; const v = Math.round(Number(m[2].replace(/\./g, '').replace(',', '.')) * 100); return m[1] ? -v : v; };
const lerCartao = async (page: Page) => {
  const t = await page.locator('.qf-t').innerText();
  return { falta: centavos(t), ate: t.match(/até (\d\d)\/(\d\d)/)! };
};

test.describe('Início · Pra não ficar negativo', () => {
  test('cartão compacto no lugar do aviso, detalhe ao tocar e "Ver no gráfico"', { tag: '@safari' }, async ({ page }, info) => {
    await abrir(page, pontual());
    const card = page.locator('.qf');
    await expect(card).toBeVisible();
    await expect(page.locator('.av.grave')).toHaveCount(0); // o aviso vermelho antigo saiu
    await expect(card).toContainText('pra não ficar negativo');
    await expect(card).toContainText(/até 18\/12/);
    // compacto: bem menor que o gráfico
    const hCard = (await card.boundingBox())!.height, hGraf = (await page.locator('main.on .chart').boundingBox())!.height;
    expect(hCard).toBeLessThan(hGraf * 0.6);
    await card.scrollIntoViewIfNeeded();
    await evidencia(page, info, '1. cartão compacto abaixo do gráfico');
    const { falta } = await lerCartao(page);

    await card.click();
    const sh = page.locator('.sheet');
    await expect(sh.locator('.sheet-head h3')).toHaveText('Pra não ficar negativo');
    // o pior momento é exatamente o que falta (com sinal)
    expect(centavos(await sh.locator('.qfs-l div', { hasText: 'Pior momento' }).locator('dd').innerText())).toBe(-falta);
    expect(centavos(await sh.locator('.qfs-v').innerText())).toBe(falta);
    await expect(sh.locator('.qfs-l')).toContainText('Dias no negativo');
    await evidencia(page, info, '2. detalhe do "Pra não ficar negativo"');

    await sh.getByRole('button', { name: 'Ver no gráfico' }).click();
    await expect(page.locator('.sheet')).toHaveCount(0);
    const marcas = page.locator('main.on .chart .ch-marca');
    await expect(marcas.first()).toBeVisible();
    await page.waitForTimeout(600); // fim da animação de entrada
    // legenda abaixo do eixo (não cobre "hoje"/"jan" nem a linha do zero)
    const leg = page.locator('main.on .chart .ch-leg');
    await expect(leg).toContainText(/1º dia negativo/);
    await expect(leg).toContainText(/[Pp]ior · −R\$ 1\.406,75 em 18\/12/);
    // cada bolinha em cima da linha do gráfico: no centro dela, o que está embaixo é o traço do gráfico
    const sobreALinha = await marcas.evaluateAll((els) => els.map((e) => {
      const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
      return document.elementsFromPoint(x, y).some((el) => el.tagName.toLowerCase() === 'path');
    }));
    expect(sobreALinha.every(Boolean), 'bolinha fora da linha').toBe(true);
    // cada vez que fica negativo vira uma faixa sombreada, e a legenda conta as vezes
    const faixas = await page.locator('main.on .chart .ch-faixa').count();
    expect(faixas).toBe(2);
    await expect(leg).toContainText('2 vezes no negativo');
    expect(await problemasNaTela(page)).toEqual([]);
    await evidencia(page, info, '3. "Ver no gráfico": bolinhas na linha, faixas e legenda');
    // tocar no gráfico tira as marcas
    await page.locator('main.on .chart svg').click({ position: { x: 40, y: 40 } });
    await expect(marcas).toHaveCount(0);
    await expect(leg).toHaveCount(0);
  });

  test('folga apertada (sem ficar negativo): cartão âmbar e detalhe', async ({ page }, info) => {
    const D = realista(); D.saldo = { ...D.saldo, valor: 50_000 };
    await abrir(page, D);
    const card = page.locator('.qf.folga');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Folga de');
    await expect(card).toContainText('não fica negativo, mas chega perto');
    const folga = centavos(await card.locator('.qf-t').innerText());
    expect(folga).toBeGreaterThanOrEqual(0);
    expect(folga).toBeLessThan(50_000);
    await card.click();
    await expect(page.locator('.sheet .qfs.folga')).toContainText('não fica negativo');
    await evidencia(page, info, 'folga apertada: detalhe');
    await page.locator('.sheet').getByRole('button', { name: 'Ver no gráfico' }).click();
    await expect(page.locator('main.on .chart .ch-marca.aperto')).toHaveCount(1);
    await expect(page.locator('main.on .chart .ch-leg')).toContainText('Mais apertado');
  });

  test('a promessa vale: lançando o valor até a data, não falta mais (folga R$ 0,00); 1 centavo a menos, falta R$ 0,01', async ({ page }) => {
    await abrir(page, pontual());
    const { falta, ate } = await lerCartao(page);
    const data = `2026-${ate[2]}-${ate[1]}`;
    const entrada = (v: number): Lancamento => ({ id: 'ent', tipo: 'entrada', valor: v, cat: 'extra', data, desc: 'Venda', meio: 'pix', criado: 1, cartaoId: null, parcelas: 1 });
    // cada cenário numa aba nova (o abrir() semeia os dados uma vez por aba)
    const p1 = await page.context().newPage();
    const D1 = pontual(); D1.lancamentos.push(entrada(falta));
    await abrir(p1, D1);
    await expect(p1.locator('main.on .chart')).toBeVisible();
    await expect(p1.locator('.qf:not(.folga)')).toHaveCount(0); // não falta mais nada…
    await expect(p1.locator('.qf.folga .qf-t')).toContainText('R$ 0,00'); // …e fica exatamente no zero: folga apertada
    const p2 = await page.context().newPage();
    const D2 = pontual(); D2.lancamentos.push(entrada(falta - 1));
    await abrir(p2, D2);
    await expect(p2.locator('.qf-t')).toContainText('R$ 0,01');
    // e entrando o valor certo, mas um dia DEPOIS do prazo, ainda fica negativo
    const p3 = await page.context().newPage();
    const depois = new Date(`${data}T12:00`); depois.setDate(depois.getDate() + 1);
    const D3 = pontual(); D3.lancamentos.push({ ...entrada(falta), data: depois.toISOString().slice(0, 10) });
    await abrir(p3, D3);
    await expect(p3.locator('.qf')).toHaveCount(1);
  });

  test('buraco que se repete: avisa no cartão e explica no detalhe', async ({ page }, info) => {
    await abrir(page, repete());
    await expect(page.locator('.qf-s')).toContainText('se repete todo mês');
    await page.locator('.qf').click();
    await expect(page.locator('.sheet .qf-rep')).toContainText('Isso se repete');
    await expect(page.locator('.sheet .qf-rep')).toContainText('por mês');
    await expect(page.locator('.sheet .qfs-l')).toContainText('Vezes no negativo');
    await evidencia(page, info, 'detalhe: buraco que se repete todo mês');
  });

  test('tranquilo (sem negativo e com folga), não aparece nada', async ({ page }) => {
    const D = realista(); D.saldo = { ...D.saldo, valor: 900_000 }; // tranquilo: nem negativo nem apertado
    await abrir(page, D);
    await expect(page.locator('main.on .chart')).toBeVisible();
    await expect(page.locator('.qf')).toHaveCount(0);
  });

  for (const tema of ['light', 'dark'] as const) {
    test(`legível no tema ${tema === 'light' ? 'claro' : 'escuro'} (vermelho e âmbar, cartão e detalhe)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema });
      await abrir(page, repete());
      await page.locator('.qf').scrollIntoViewIfNeeded();
      expect(await contrasteBaixo(page), 'contraste · cartão').toEqual([]);
      expect(await problemasNaTela(page), 'layout · cartão').toEqual([]);
      await page.locator('.qf').click();
      await expect(page.locator('.sheet .qfs')).toBeVisible();
      expect(await contrasteBaixo(page), 'contraste · detalhe').toEqual([]);
      expect(await problemasNaTela(page), 'layout · detalhe').toEqual([]);
      // e o âmbar (folga apertada), noutra aba
      const p2 = await page.context().newPage();
      await p2.emulateMedia({ colorScheme: tema });
      const D = realista(); D.saldo = { ...D.saldo, valor: 50_000 };
      await abrir(p2, D);
      await p2.locator('.qf.folga').scrollIntoViewIfNeeded();
      expect(await contrasteBaixo(p2), 'contraste · cartão âmbar').toEqual([]);
      expect(await problemasNaTela(p2), 'layout · cartão âmbar').toEqual([]);
      await p2.locator('.qf.folga').click();
      await expect(p2.locator('.sheet .qfs.folga')).toBeVisible();
      expect(await contrasteBaixo(p2), 'contraste · detalhe âmbar').toEqual([]);
    });
  }
});
