import { expect, test } from '@playwright/test';
import { realista } from './dados';
import { abrir, contrasteBaixo, dados, evidencia, problemasNaTela } from './util';

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

  // v2.45 — o print do Caio: números, linhas e dica contando a mesma história em qualquer cenário
  test('coerência: cada opção bate com "sem a compra", mesmas linhas, dica sem contradição', { tag: '@safari' }, async ({ page }, info) => {
    const D = realista(); D.saldo = { ...D.saldo, valor: 60_000 };
    await abrir(page, D);
    await page.locator('.sim-btn').click();
    const brl = (t: string) => { const m = t.replace(/\s/g, '').match(/([−-])?R\$([\d.]+,\d{2})/); if (!m) return NaN; const v = Math.round(Number(m[2].replace(/\./g, '').replace(',', '.')) * 100); return m[1] ? -v : v; };
    const probs: string[] = [];
    let print = false;
    for (const [valor, digitos] of [['105,00', '10500'], ['600,00', '60000'], ['3.000,00', '300000']] as const) {
      await page.locator('.sheet .amount.tap').click();
      for (let i = 0; i < 9; i++) await page.locator('.sheet .key[aria-label="Apagar"]').click();
      for (const k of digitos) await page.locator(`.sheet .key[aria-label="${k}"]`).click();
      await page.locator('.sheet .tec-ok').click();
      for (const meio of ['Pix / débito', 'Cartão Roxo', 'Cartão Laranja']) {
        await page.locator('.sheet .chip', { hasText: meio }).click();
        if (meio !== 'Pix / débito') for (const n of ['+ 3x', '+ 6x']) { const c = page.locator('.sheet .sim-mais .chip', { hasText: n }); if (await c.count()) await c.click(); }
        await page.waitForTimeout(150);
        const ctx = `R$ ${valor} · ${meio}`;
        const baseMin = brl(await page.locator('.sheet .sim-base-v b').innerText());
        const cards = page.locator('.sheet .sim-op');
        const rotulos: string[] = [];
        for (let i = 0; i < (await cards.count()); i++) {
          const c = cards.nth(i);
          const ks = (await c.locator('.sim-k').allInnerTexts()).join('|');
          rotulos.push(ks);
          const min = brl(await c.locator('.sim-v').first().innerText());
          const d = await c.locator('.sim-d').first().innerText();
          const fundo = d.includes('mais fundo') ? brl(d) : 0;
          if (min !== Math.min(baseMin, baseMin) - fundo && !(fundo === 0 && min === baseMin)) probs.push(`${ctx}: cartão ${i + 1} mostra ${min}, mas "sem a compra" ${baseMin} − ${fundo}`);
          if (/Fim de/.test(await c.innerText())) probs.push(`${ctx}: ainda mostra "Fim de"`);
        }
        if (new Set(rotulos).size > 1) probs.push(`${ctx}: cartões com linhas diferentes (${[...new Set(rotulos)].join(' ≠ ')})`);
        const tudo = await page.locator('.sheet .sl-mid').innerText();
        if (/-\s?R\$/.test(tudo)) probs.push(`${ctx}: valor negativo com hífen em vez de sinal de menos`);
        if (/sem parcela nova/.test(tudo)) probs.push(`${ctx}: "sem parcela nova" de volta`);
        if (!print && valor === '105,00' && meio === 'Cartão Roxo') { print = true; await page.locator('.sheet .sim-op').first().scrollIntoViewIfNeeded(); await evidencia(page, info, 'R$ 105,00 no Cartão Roxo: sem a compra × à vista × 2x × 3x × 6x'); await page.locator('.sheet .sim-dica').scrollIntoViewIfNeeded(); await evidencia(page, info, 'dica e nota'); }
      }
    }
    expect(probs).toEqual([]);
    // legível nos dois temas, sem texto cortado
    for (const tema of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: tema });
      await page.waitForTimeout(200);
      for (const alvo of ['.sheet .sim-base', '.sheet .sim-dica']) {
        await page.locator(alvo).scrollIntoViewIfNeeded();
        expect(await contrasteBaixo(page), `contraste · ${tema} · ${alvo}`).toEqual([]);
        expect(await problemasNaTela(page), `layout · ${tema} · ${alvo}`).toEqual([]);
      }
    }
  });
});
