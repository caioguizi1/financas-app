import { expect, test } from '@playwright/test';
import { realista } from './dados';
import { abrir, dados, evidencia, fecharSheet, problemasNaTela } from './util';

test('cadastro inicial do zero até a tela principal', async ({ page }, info) => {
  const erros = await abrir(page, null);
  const continuar = async (texto = 'Continuar') => { await page.locator('.foot button', { hasText: texto }).first().click(); };
  // espera a pergunta da etapa aparecer antes de agir (não um tempo fixo: com a máquina carregada a transição demora)
  const etapa = (pergunta: RegExp) => expect(page.locator('.ob .body .q').last()).toHaveText(pergunta);
  const valor = async (v: string) => {
    await expect(page.locator('.ob .body .key').first()).toBeVisible();
    for (const k of v) await page.locator(`.ob .body .key[aria-label="${k}"]`).click();
  };
  await evidencia(page, info, '1. boas-vindas');
  await continuar('Começar');
  await etapa(/Como posso te chamar/);
  await page.locator('.ob .body input').fill('Ana');
  await continuar();
  await etapa(/quanto tem na sua conta/);
  await valor('320000');
  await expect(page.locator('.ob .body .amount')).toContainText('3.200,00');
  await continuar();
  await etapa(/renda mensal/);
  await valor('650000');
  await expect(page.locator('.ob .body .amount')).toContainText('6.500,00');
  await continuar();
  await etapa(/Como ela cai/);
  await page.locator('.ob .body button', { hasText: 'Uma vez por mês' }).click();
  await etapa(/Em que dia/);
  await page.locator('.ob .body .daygrid button').nth(4).click();
  await continuar();
  await etapa(/Usa cartão/);
  await page.locator('.foot button', { hasText: 'Não uso cartão' }).click();
  await etapa(/gastos fixos/);
  await continuar('Pular');
  await etapa(/Pronto/);
  await page.waitForTimeout(1500); // número animando até o valor final
  await expect(page.locator('.ob')).toContainText('R$ 3.200,00');
  await evidencia(page, info, '2. resumo final');
  await continuar('Ver meu fluxo');
  await expect(page.locator('.tab').first()).toBeVisible();
  const D = await dados(page);
  expect(D.onboarded).toBe(true);
  expect(D.recorrentes).toEqual([expect.objectContaining({ desc: 'Salário', valor: 650000, dia: 5 })]);
  await evidencia(page, info, '3. tela principal');
  expect(erros).toEqual([]);
});

/** Varredura: todas as abas e os primeiros itens/menus de cada uma, em vários tamanhos e temas. */
for (const [nome, w, h, tema] of [['iPhone claro', 390, 844, 'light'], ['iPhone escuro', 390, 844, 'dark'], ['iPhone SE', 375, 667, 'light'], ['tela estreita', 320, 640, 'dark']] as const) {
  test(`varredura de todas as telas · ${nome}`, async ({ page }, info) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: w, height: h });
    await page.emulateMedia({ colorScheme: tema });
    const erros = await abrir(page, realista());
    const achados: Record<string, string[]> = {};
    const checar = async (onde: string) => { const r = await problemasNaTela(page); if (r.length) achados[onde] = r; };
    const abas = (await page.locator('.tab').allInnerTexts()).map((t) => t.trim());
    let abertos = 0;
    const falhas: string[] = [];
    for (const t of abas) {
      await page.locator('.tab', { hasText: t }).first().click();
      await page.waitForTimeout(600);
      await checar(t);
      await evidencia(page, info, `aba ${t}`);
      const n = await page.evaluate(() => {
        document.querySelectorAll('[data-e2e]').forEach((e) => e.removeAttribute('data-e2e'));
        const s = [...document.querySelectorAll<HTMLElement>('main.on .item, main.on .row-item, main.on button, main.on [role=button]')].filter((e) => {
          if (e.closest('.sa') || !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
          const c = e.getBoundingClientRect(); const top = document.elementFromPoint(c.left + c.width / 2, c.top + Math.min(c.height / 2, 20));
          if (top && !e.contains(top) && !top.contains(e)) return false; // escondido atrás de outro (ex.: ações do deslize)
          const r = e.getBoundingClientRect(); const txt = (e.innerText || '').toLowerCase();
          return r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= innerWidth + 1 && !e.closest('.sheet') && !/apagar|excluir|zerar|limpar|sair|importar|exportar|restaurar|backup/.test(txt);
        });
        s.forEach((e, i) => e.setAttribute('data-e2e', String(i)));
        return s.length;
      });
      for (let i = 0; i < Math.min(n, 12); i++) {
        const el = page.locator(`[data-e2e="${i}"]`);
        if (!(await el.count())) continue;
        const rotulo = ((await el.innerText().catch(() => '')) || '').trim().slice(0, 30).replace(/\n/g, ' ');
        try { await el.scrollIntoViewIfNeeded({ timeout: 1500 }); await el.click({ timeout: 1500 }); } catch (e) { falhas.push(`${t}: ${rotulo} — ${String(e).split('\n').find((l) => /intercept|not visible|outside|detached|disabled/.test(l))?.trim().slice(0, 90) ?? 'sem clique'}`); continue; }
        await page.waitForTimeout(550);
        abertos++;
        if (await page.locator('.sheet').count()) { await checar(`${t} → ${rotulo}`); await fecharSheet(page); }
        if (!(await page.locator('.tab.on', { hasText: t }).count())) { await page.locator('.tab', { hasText: t }).first().click(); await page.waitForTimeout(400); }
        else await checar(`${t} → clique ${rotulo}`);
      }
    }
    await page.locator('.fab').click(); await page.waitForTimeout(600); await checar('＋ saída');
    await page.locator('.sheet .seg button', { hasText: 'Entrada' }).click(); await page.waitForTimeout(300); await checar('＋ entrada');
    info.annotations.push({ type: 'cobertura', description: `${abas.length} abas, ${abertos} itens/menus abertos` });
    if (falhas.length) info.annotations.push({ type: 'não clicáveis', description: falhas.join(' · ') });
    expect(achados).toEqual({});
    expect(erros).toEqual([]);
  });
}

test('nota de estimativa quando o gasto típico do cartão pesa na projeção', async ({ page }, info) => {
  await abrir(page, realista());
  await expect(page.locator('.est-nota')).toContainText('estimativa');
  await evidencia(page, info, 'nota de estimativa na tela principal');
});
