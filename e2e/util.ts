import { expect, type Page, type TestInfo } from '@playwright/test';
import type { Data } from '../src/lib/types';
import { HOJE } from './dados';

const CHAVE = 'fluxo.v1';

/** Abre o app com estes dados (só na 1ª carga: recarregar a página mantém o que o teste fez). */
export async function abrir(page: Page, D: Data | null) {
  await page.clock.setFixedTime(new Date(`${HOJE}T12:00:00-03:00`));
  await page.addInitScript(([k, json]) => {
    if (sessionStorage.getItem('e2e-semeado')) return;
    sessionStorage.setItem('e2e-semeado', '1');
    localStorage.clear();
    if (json) localStorage.setItem(k, json);
  }, [CHAVE, D ? JSON.stringify(D) : ''] as const);
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  await page.goto('./');
  await page.waitForTimeout(600);
  return erros;
}

export const dados = (page: Page): Promise<Data> => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), CHAVE);

/** Print anexado ao relatório (evidência da etapa). */
export async function evidencia(page: Page, info: TestInfo, nome: string) {
  await page.waitForTimeout(250);
  await info.attach(nome, { body: await page.screenshot(), contentType: 'image/png' });
}

export async function aba(page: Page, nome: string) {
  await page.locator('.tab', { hasText: nome }).first().click();
  await page.waitForTimeout(500);
}

/** Abre o ＋ e digita o valor pelo teclado do app (que só aparece ao tocar no valor). */
export async function novoLancamento(page: Page, centavos: string, desc?: string) {
  await page.locator('.fab').click();
  await expect(page.locator('.sheet')).toBeVisible();
  await page.waitForTimeout(400);
  await page.locator('.sheet .amount.tap').click();
  for (const k of centavos) await page.locator(`.sheet .key[aria-label="${k}"]`).click();
  await page.locator('.sheet .tec-ok').click();
  if (desc) await page.locator('.sheet .smart-desc input').fill(desc);
  await page.waitForTimeout(250);
}

export async function fecharSheet(page: Page) {
  for (let i = 0; i < 3 && (await page.locator('.sheet').count()); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
  }
}

/** Texto “quebrado” na tela, vazamento horizontal e texto cortado sem reticências. */
export const problemasNaTela = (page: Page) => page.evaluate(() => {
  const out: string[] = [];
  const W = innerWidth;
  const txt = document.body.innerText;
  for (const bad of ['NaN', 'undefined', 'Invalid Date', '[object', 'Infinity']) if (txt.includes(bad)) {
    const i = txt.indexOf(bad); out.push(`texto "${bad}": …${txt.slice(Math.max(0, i - 40), i + 30).replace(/\n/g, ' ')}…`);
  }
  for (const el of document.querySelectorAll<HTMLElement>('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (r.right > W + 2) {
      let a = el.parentElement, clip = false;
      while (a && a !== document.body) { if (getComputedStyle(a).overflowX !== 'visible') { clip = true; break; } a = a.parentElement; }
      if (!clip) out.push(`vaza à direita: ${typeof el.className === 'string' ? el.className : el.tagName} "${(el.innerText || '').slice(0, 30)}"`);
    }
    if (!el.children.length && el.textContent?.trim() && el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible' && cs.textOverflow !== 'ellipsis')
      out.push(`texto cortado: "${el.textContent.trim().slice(0, 40)}"`);
  }
  // botão principal (roxo): texto branco em qualquer tema (no claro herdava a cor escura do tema — v2.40)
  for (const b of document.querySelectorAll<HTMLElement>('[data-primary]')) {
    if (b.checkVisibility() && getComputedStyle(b).color !== 'rgb(255, 255, 255)') out.push(`botão principal sem texto branco: "${b.innerText.trim().slice(0, 30)}" (${getComputedStyle(b).color})`);
  }
  return [...new Set(out)].slice(0, 12);
});

/** Ícone sozinho numa caixa (quadradinho, botão redondo…) tem que estar no centro dela (tolerância 1 px). */
export const iconesForaDoCentro = (page: Page) => page.evaluate(() => {
  const out: string[] = [];
  const icones = document.querySelectorAll<Element>('svg, .emo, .smart-ico > span, .ico > span, .in-ico > span');
  for (const ic of icones) {
    const pai = ic.parentElement;
    if (!pai || ic.closest('.chart') || pai.closest('svg')) continue;
    // sozinho: a caixa não tem outro elemento nem texto além do ícone
    const outros = [...pai.childNodes].filter((n) => n !== ic && (n.nodeType === 1 ? (n as HTMLElement).getBoundingClientRect().width > 0 : (n.textContent ?? '').trim()));
    if (outros.length) continue;
    const r = ic.getBoundingClientRect(), b = pai.getBoundingClientRect();
    if (!r.width || !b.width || b.width > 90 || b.height > 90 || r.width >= b.width - 1) continue; // só caixas pequenas com folga
    const cs = getComputedStyle(pai);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const bl = parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft), br = parseFloat(cs.borderRightWidth) + parseFloat(cs.paddingRight);
    const bt = parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop), bb = parseFloat(cs.borderBottomWidth) + parseFloat(cs.paddingBottom);
    const dx = (r.left + r.width / 2) - (b.left + bl + (b.width - bl - br) / 2);
    const dy = (r.top + r.height / 2) - (b.top + bt + (b.height - bt - bb) / 2);
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1.5) {
      const nome = (e: Element) => e.tagName.toLowerCase() + (typeof (e as HTMLElement).className === 'string' && (e as HTMLElement).className ? '.' + (e as HTMLElement).className.trim().split(/\s+/).slice(0, 2).join('.') : '');
      out.push(`${nome(pai)} > ${ic.tagName.toLowerCase()} (${ic.getAttribute('class')?.split(' ').slice(0, 2).join('.') ?? ''}): ${dx.toFixed(1)} px ${dx < 0 ? '←' : '→'}, ${dy.toFixed(1)} px ${dy < 0 ? '↑' : '↓'}`);
    }
  }
  return [...new Set(out)];
});
