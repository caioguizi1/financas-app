import { expect, test, type Page } from '@playwright/test';
import { realista } from './dados';
import { abrir, aba } from './util';

/**
 * v2.55 — print do app real: em Fixos, as caixas de Entradas e Saídas apareciam vazias (os itens ocupavam
 * espaço, mas invisíveis). Os itens nascem transparentes e aparecem numa animação em cascata; se a animação
 * travar, eles não podem ficar invisíveis. Aqui: vários caminhos até a tela e, em todos, os itens à vista.
 */
test.use({ hasTouch: true, isMobile: true });

/** Itens das listas da tela atual que estão (quase) invisíveis depois de dar tempo à animação. */
const invisiveis = (p: Page) => p.evaluate(() => [...document.querySelectorAll('main.on .list .swipe, main.on .stats .stat, main.on .insight')]
  .filter((e) => { let o = 1; for (let n: Element | null = e; n && n !== document.body; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o < 0.95 && (e as HTMLElement).getBoundingClientRect().height > 0; })
  .map((e) => (e as HTMLElement).innerText.split('\n')[0] || e.className));

test.describe('Listas nunca ficam invisíveis', () => {
  test('Fixos por vários caminhos: itens sempre à vista', { tag: '@safari' }, async ({ page }) => {
    await abrir(page, realista());
    const checar = async (como: string) => { await page.waitForTimeout(1500); expect(await invisiveis(page), `itens invisíveis · ${como}`).toEqual([]); };
    await aba(page, 'Fixos'); await checar('1ª vez em Fixos');
    await page.locator('main.on .item', { hasText: 'Salário' }).first().tap();
    await page.locator('.sheet').getByRole('button', { name: 'Cancelar' }).tap();
    await checar('depois de abrir e fechar um fixo');
    await aba(page, 'Início'); await aba(page, 'Fixos'); await checar('voltando do Início');
    // muda os dados com Fixos escondida (novo lançamento no Início) e volta
    await aba(page, 'Início');
    await page.locator('.fab').tap();
    await page.locator('.sheet .amount.tap').tap();
    for (const k of '1000') await page.locator(`.sheet .key[aria-label="${k}"]`).tap();
    await page.locator('.sheet .tec-ok').tap();
    await page.locator('.sheet [data-primary]').tap();
    await page.waitForTimeout(500);
    await aba(page, 'Fixos'); await checar('dados mudaram com a tela escondida');
    // troca rápida de abas
    for (const t of ['Extrato', 'Fixos', 'Ajustes', 'Fixos', 'Início', 'Fixos'] as const) await aba(page, t);
    await checar('troca rápida de abas');
    // app vai pro fundo e volta (como trocar de app no iPhone)
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(300);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await checar('voltando do fundo');
  });

  test('abrindo o app já em Fixos (recarregar com a aba aberta)', { tag: '@safari' }, async ({ page }) => {
    await abrir(page, realista());
    await aba(page, 'Fixos');
    await page.reload();
    await page.waitForTimeout(1500);
    const aberta = await page.locator('main.on').innerText();
    if (!aberta.includes('Entradas')) await aba(page, 'Fixos');
    await page.waitForTimeout(1500);
    expect(await invisiveis(page)).toEqual([]);
  });

  // a garantia em si: simula a animação travada (o estilo que o motion deixa no item: opacidade 0)
  test('animação travada: o item preso em opacidade 0 aparece mesmo assim', { tag: '@safari' }, async ({ page }) => {
    await abrir(page, realista());
    await aba(page, 'Fixos');
    await page.waitForTimeout(1600);
    // (1) item que já estava na tela e ficou preso
    await page.evaluate(() => document.querySelectorAll<HTMLElement>('main.on .list > .swipe').forEach((e) => { e.style.opacity = '0'; }));
    expect(await invisiveis(page)).toEqual([]);
    // (2) item novo que nasce preso (como numa tela que muda escondida)
    await page.evaluate(() => {
      const l = document.querySelector('main.on .list')!, n = l.querySelector('.swipe')!.cloneNode(true) as HTMLElement;
      n.style.opacity = '0'; n.dataset.teste = 'novo'; l.appendChild(n);
    });
    const op = () => page.locator('main.on [data-teste="novo"]').evaluate((e) => Number(getComputedStyle(e).opacity));
    expect(await op()).toBeLessThan(0.1); // no começo, preso
    await page.waitForTimeout(1600);
    expect(await op()).toBe(1); // depois de 1,4 s, à vista
  });
});
