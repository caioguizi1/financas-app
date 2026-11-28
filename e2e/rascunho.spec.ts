import { expect, test, type Page } from '@playwright/test';
import { realista } from './dados';
import { aba, abrir, contrasteBaixo, evidencia, problemasNaTela } from './util';

/**
 * v2.44 — O valor digitado não pode sumir.
 * Bug real (iPhone): tocar em "Todo ano" com o dedo rolando ~8 px em 8 ms (normal numa tela de 120 Hz)
 * contava como "arrastar pra baixo rápido" e fechava a janela — e tudo o que foi digitado se perdia.
 */
test.use({ hasTouch: true, isMobile: true });

/** Toque como o de um iPhone: dedo desce `dy` px em 8 ms e solta (eventos de toque reais, com tempo controlado). */
const toqueTremido = (page: Page, sel: string, dy: number) => page.locator(sel).evaluate(async (el, dy) => {
  const r = el.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2;
  // Safari de computador não deixa criar Touch: aí o evento leva os mesmos campos que o app lê
  const ev = (tipo: string, yy: number | null) => { const pt = { identifier: 1, target: el, clientX: x, clientY: yy ?? y + dy };
    let e: Event; try { const t = new Touch(pt); e = new TouchEvent(tipo, { bubbles: true, cancelable: true, touches: yy == null ? [] : [t], changedTouches: [t] }); }
    catch { e = new Event(tipo, { bubbles: true, cancelable: true }); Object.defineProperties(e, { touches: { value: yy == null ? [] : [pt] }, changedTouches: { value: [pt] } }); }
    el.dispatchEvent(e); };
  ev('touchstart', y); await new Promise((ok) => setTimeout(ok, 8));
  ev('touchmove', y + dy); await new Promise((ok) => setTimeout(ok, 4));
  ev('touchend', null); el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
}, dy);

/** Arrasto de verdade pra baixo, pelo corpo da janela. */
const arrastarPraBaixo = (page: Page, dist: number) => page.locator('.sheet .sheet-head h3').evaluate(async (el, dist) => {
  const r = el.getBoundingClientRect(); const x = r.x + r.width / 2, y0 = r.y + r.height / 2;
  const ev = (tipo: string, yy: number | null) => { const pt = { identifier: 1, target: el, clientX: x, clientY: yy ?? y0 + dist };
    let e: Event; try { const t = new Touch(pt); e = new TouchEvent(tipo, { bubbles: true, cancelable: true, touches: yy == null ? [] : [t], changedTouches: [t] }); }
    catch { e = new Event(tipo, { bubbles: true, cancelable: true }); Object.defineProperties(e, { touches: { value: yy == null ? [] : [pt] }, changedTouches: { value: [pt] } }); }
    el.dispatchEvent(e); };
  ev('touchstart', y0);
  for (let i = 1; i <= 12; i++) { await new Promise((ok) => setTimeout(ok, 16)); ev('touchmove', y0 + (dist * i) / 12); }
  ev('touchend', null);
}, dist);

const valor = (page: Page) => page.locator('.sheet .amount').first().innerText().then((s) => s.replace(/\s+/g, ''));

test.describe('O que você digita não some', () => {
  test('toque tremido em "Todo ano" não fecha a janela nem apaga o valor @safari', async ({ page }, info) => {
    await abrir(page, realista());
    await aba(page, 'Fixos');
    await page.getByRole('button', { name: '＋ Gasto fixo' }).tap();
    await page.locator('.sheet .smart-desc input').fill('Assinatura anual');
    await page.locator('.sheet .amount.tap').tap();
    for (const k of '19990') await page.locator(`.sheet .key[aria-label="${k}"]`).tap();
    await page.locator('.sheet .tec-ok').tap();
    for (const [rot, dy] of [['Todo ano', 8], ['Toda semana', 12], ['Todo mês', 16], ['Todo ano', 20]] as const) {
      await toqueTremido(page, `.sheet .seg button:has-text("${rot}")`, dy);
      await page.waitForTimeout(500);
      await expect(page.locator('.sheet'), `toque em "${rot}" (${dy} px) fechou a janela`).toHaveCount(1);
      await expect(page.locator('.sheet .seg').first().locator('button.on')).toHaveText(rot); // 1º seletor = Repete (o "Como paga" do semanal é outro)
      expect(await valor(page)).toMatch(/R\$199,90/);
      await expect(page.locator('.sheet .smart-desc input')).toHaveValue('Assinatura anual');
    }
    // escolheu "Todo ano": o mês já vem marcado, então só falta o dia (antes dizia "o dia e o mês")
    await expect(page.locator('.sheet .sl-foot')).toContainText('Falta o dia');
    await expect(page.locator('.sheet .sl-foot')).not.toContainText('o mês');
    await evidencia(page, info, 'depois de 4 toques tremidos: janela aberta, valor e nome intactos');
  });

  test('com coisa digitada, fechar por gesto, fundo ou Cancelar pergunta antes @safari', async ({ page }, info) => {
    await abrir(page, realista());
    await page.locator('.fab').tap();
    await page.locator('.sheet .amount.tap').tap();
    for (const k of '4590') await page.locator(`.sheet .key[aria-label="${k}"]`).tap();
    await page.locator('.sheet .tec-ok').tap();
    // arrasto de verdade
    await arrastarPraBaixo(page, 260);
    await expect(page.locator('.sair')).toBeVisible();
    await evidencia(page, info, 'arrastou pra baixo com valor digitado: pergunta antes de sair');
    await page.getByRole('button', { name: 'Continuar editando' }).tap();
    await expect(page.locator('.sair')).toHaveCount(0);
    expect(await valor(page)).toMatch(/R\$45,90/);
    // Cancelar
    await page.locator('.sheet').getByRole('button', { name: 'Cancelar' }).tap();
    await expect(page.locator('.sair')).toBeVisible();
    await page.getByRole('button', { name: 'Continuar editando' }).tap();
    expect(await valor(page)).toMatch(/R\$45,90/);
    // fundo escuro
    await page.locator('.veil').tap({ position: { x: 20, y: 20 } });
    await expect(page.locator('.sair')).toBeVisible();
    await page.getByRole('button', { name: 'Sair sem salvar' }).tap();
    await expect(page.locator('.sheet')).toHaveCount(0);
  });

  for (const tema of ['light', 'dark'] as const) {
    test(`"Sair sem salvar?" legível no tema ${tema === 'light' ? 'claro' : 'escuro'}`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: tema });
      await abrir(page, realista());
      await page.locator('.fab').tap();
      await page.locator('.sheet .smart-desc input').fill('Mercado');
      await page.locator('.sheet').getByRole('button', { name: 'Cancelar' }).tap();
      await expect(page.locator('.sair')).toBeVisible();
      expect(await contrasteBaixo(page)).toEqual([]);
      expect(await problemasNaTela(page)).toEqual([]);
      await evidencia(page, info, `pergunta antes de sair · tema ${tema}`);
    });
  }

  test('janela sem nada digitado fecha direto, sem perguntar', async ({ page }) => {
    await abrir(page, realista());
    await page.locator('.fab').tap();
    await page.locator('.sheet').getByRole('button', { name: 'Cancelar' }).tap();
    await expect(page.locator('.sheet')).toHaveCount(0);
    await page.locator('.fab').tap();
    await arrastarPraBaixo(page, 260);
    await expect(page.locator('.sheet')).toHaveCount(0);
    await expect(page.locator('.sair')).toHaveCount(0);
  });

  test('"13º, PLR, férias…" leva o valor digitado e o Voltar devolve tudo', async ({ page }, info) => {
    await abrir(page, realista());
    await page.locator('.fab').tap();
    await page.locator('.sheet .seg button', { hasText: 'Entrada' }).tap();
    await page.locator('.sheet .smart-desc input').fill('Bônus anual');
    await page.locator('.sheet .amount.tap').tap();
    for (const k of '300000') await page.locator(`.sheet .key[aria-label="${k}"]`).tap();
    await page.locator('.sheet .tec-ok').tap();
    await page.locator('.sheet .chip', { hasText: '13º, PLR, férias' }).tap();
    await expect(page.locator('.sheet .sheet-head h3', { hasText: 'Recebimento extra' })).toBeVisible();
    await expect(page.locator('.sheet')).toHaveCount(1); // a janela anterior terminou de sair
    // Voltar devolve o "＋" como estava
    await page.locator('.sheet').getByRole('button', { name: '‹ Voltar' }).tap();
    await expect(page.locator('.sheet')).toHaveCount(1);
    await expect(page.locator('.sheet .seg button.on', { hasText: 'Entrada' })).toHaveCount(1);
    expect(await valor(page)).toMatch(/R\$3\.000,00/);
    await expect(page.locator('.sheet .smart-desc input')).toHaveValue('Bônus anual');
    // escolhendo Bônus, o valor digitado vira a parcela única
    await page.locator('.sheet .chip', { hasText: '13º, PLR, férias' }).tap();
    await expect(page.locator('.sheet')).toHaveCount(1);
    await page.locator('.sheet .extra-card', { hasText: 'Bônus' }).tap();
    await expect(page.locator('.sheet .sl-foot')).toContainText('3.000,00');
    await evidencia(page, info, 'Bônus com o valor que já estava digitado');
  });
});
