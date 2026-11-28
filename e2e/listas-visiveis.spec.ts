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

  // v2.56 — a causa de verdade (print do app real: linhas desalinhadas em Saídas): o motion deixava o item
  // preso transparente E 8 px abaixo. Agora a entrada é CSS puro: nenhum item guarda estilo, e as linhas
  // ficam coladas umas nas outras, sem sobrepor nem abrir buraco.
  for (const tema of ['dark', 'light'] as const) {
    test(`linhas alinhadas e sem estilo preso em todas as listas · ${tema === 'dark' ? 'escuro' : 'claro'}`, { tag: '@safari' }, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema });
      await abrir(page, realista());
      const probs: string[] = [];
      for (const t of ['Início', 'Extrato', 'Fixos', 'Ajustes', 'Fixos', 'Início'] as const) {
        await aba(page, t);
        await page.waitForTimeout(900);
        probs.push(...(await page.evaluate((t) => {
          const out: string[] = [];
          for (const l of document.querySelectorAll('main.on .list')) {
            const rows = [...l.children].filter((e) => (e as HTMLElement).offsetParent !== null) as HTMLElement[];
            rows.forEach((r, i) => {
              const st = r.getAttribute('style') ?? '';
              if (/opacity|transform/.test(st)) out.push(`${t}: estilo preso na linha "${r.innerText.split('\n')[0]}" (${st})`);
              const cs = getComputedStyle(r);
              if (cs.transform !== 'none' && !cs.animationName.includes('entra')) out.push(`${t}: linha "${r.innerText.split('\n')[0]}" deslocada (${cs.transform})`);
              if (i > 0) {
                const a = rows[i - 1].getBoundingClientRect(), b = r.getBoundingClientRect();
                if (Math.abs(b.top - a.bottom) > 1.5) out.push(`${t}: entre "${rows[i - 1].innerText.split('\n')[0]}" e "${r.innerText.split('\n')[0]}" há ${Math.round(b.top - a.bottom)} px`);
              }
            });
          }
          return out;
        }, t)));
      }
      expect(probs).toEqual([]);
    });
  }
});
