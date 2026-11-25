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
  return [...new Set(out)].slice(0, 12);
});
