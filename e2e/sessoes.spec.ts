import { expect, test, type Page } from '@playwright/test';
import { vazio } from './dados';
import { abrir, dados, evidencia } from './util';
import type { Data, Recorrente } from '../src/lib/types';

/**
 * v2.54 — fixo por sessão (o caso da terapia, valores fictícios): R$ 200 toda segunda, pago junto no dia 30,
 * reembolso de 100% até o dia 7 do mês seguinte, pausa de 21/12 a 04/01. Hoje fictício = 25/11/2026.
 */
test.use({ hasTouch: true, isMobile: true });
const TERAPIA: Recorrente = { id: 't', tipo: 'saida', desc: 'Terapia', cat: 'saude', valor: 20_000, dia: 1, inicio: '2026-11', freq: 'semanal', semana: 1, meio: 'pix', agrupar: { dia: 30 }, reembolso: { pct: 100, dia: 7 }, pausas: [{ de: '2026-12-21', ate: '2027-01-04' }] };
const comTerapia = (r: Partial<Recorrente> = {}, d: Partial<Data> = {}) => { const D = { ...vazio(), ...d }; D.recorrentes = [{ ...TERAPIA, ...r }]; return D; };
const mes = async (p: Page, nome: string) => {
  // navega o Extrato até o mês pedido e devolve as linhas (data · título · valor)
  for (let i = 0; i < 6 && !(await p.locator('main.on').innerText()).includes(nome); i++) await p.locator('main.on').getByRole('button', { name: /próximo|›/i }).first().click();
  return (await p.locator('main.on .item').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
};

test.describe('Fixo por sessão: pago junto, reembolso e pausas', () => {
  test('criar como na prévia: o resumo dos próximos meses bate', { tag: '@safari' }, async ({ page }, info) => {
    await abrir(page, vazio());
    await page.locator('.tab', { hasText: 'Fixos' }).tap();
    await page.getByRole('button', { name: '＋ Gasto fixo' }).tap();
    await page.locator('.sheet .smart-desc input').fill('Terapia');
    await page.locator('.sheet .amount.tap').tap();
    for (const k of '20000') await page.locator(`.sheet .key[aria-label="${k}"]`).tap();
    await page.locator('.sheet .tec-ok').tap();
    await page.locator('.sheet .seg button', { hasText: 'Toda semana' }).tap();
    await page.locator('.sheet .chips.sem .chip', { hasText: 'Seg' }).tap();
    await expect(page.locator('.sheet .fs-sub')).toHaveText('valor de cada segunda');
    await page.locator('.sheet .seg button', { hasText: 'Junto, no fim do mês' }).tap();
    await expect(page.locator('.sheet .fs-linha .stepper span')).toHaveText('30');
    await page.locator('.sheet .fs-sw').tap();
    await expect(page.locator('.sheet .fs-sw')).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: '＋ Pausar um período' }).tap();
    await page.getByLabel('Pausa de').fill('2026-12-21');
    await page.getByLabel('Pausa até').fill('2027-01-04');
    await page.locator('.sheet .fs-nova').getByRole('button', { name: 'Pausar' }).tap();
    await expect(page.locator('.sheet .fs-pausa')).toContainText('21/12 a 04/01');
    await expect(page.locator('.sheet .fs-pausa')).toContainText('3 segundas sem cobrança');
    // o resumo: nov 5 · dez 2 (2 pausadas) · jan 3 (1 pausada) · fev 4
    const linhas = page.locator('.sheet .fs-mes');
    await expect(linhas).toHaveCount(4);
    await expect(linhas.nth(0)).toContainText(/nov.*5 sessões.*−R\$ 1\.000,00.*30\/11.*\+R\$ 1\.000,00.*até 07\/12/s);
    await expect(linhas.nth(1)).toContainText(/dez.*2 sessões · 2 pausadas.*−R\$ 400,00.*30\/12.*\+R\$ 400,00.*até 07\/01/s);
    await expect(linhas.nth(2)).toContainText(/jan.*3 sessões · 1 pausada.*−R\$ 600,00.*30\/01.*\+R\$ 600,00.*até 07\/02/s);
    await expect(linhas.nth(3)).toContainText(/fev.*4 sessões.*−R\$ 800,00.*28\/02.*\+R\$ 800,00.*até 07\/03/s);
    await linhas.nth(0).scrollIntoViewIfNeeded();
    await evidencia(page, info, 'fixo da terapia: resumo dos próximos meses');
    await page.locator('.sheet').getByRole('button', { name: 'Salvar' }).tap();
    await page.waitForTimeout(600);
    const r = (await dados(page)).recorrentes[0];
    expect(r).toMatchObject({ desc: 'Terapia', valor: 20_000, freq: 'semanal', semana: 1, agrupar: { dia: 30 }, reembolso: { pct: 100, dia: 7 }, pausas: [{ de: '2026-12-21', ate: '2027-01-04' }] });
    await expect(page.locator('main.on .item', { hasText: 'Terapia' })).toContainText('paga junto dia 30');
    await expect(page.locator('main.on .item', { hasText: 'Terapia' })).toContainText('reembolso 100%');
    await expect(page.locator('main.on .item', { hasText: 'Terapia' })).toContainText('pausa 21/12–04/01');
  });

  test('na projeção: sai no dia 30 e volta no dia 7, mês a mês (o reembolso desconta tudo)', { tag: '@safari' }, async ({ page }, info) => {
    await abrir(page, comTerapia());
    await page.locator('.tab', { hasText: 'Extrato' }).tap();
    expect((await mes(page, 'Novembro 2026')).join(' / ')).toMatch(/Terapia.*5 sessões.*−R\$ 1\.000,00/);
    const dez = (await mes(page, 'Dezembro 2026')).join(' / ');
    expect(dez).toMatch(/Reembolso · Terapia.*5 sessões de nov.*\+R\$ 1\.000,00/);
    expect(dez).toMatch(/Terapia.*2 sessões.*−R\$ 400,00/);
    await evidencia(page, info, 'Extrato de dezembro: reembolso de novembro e as 2 sessões');
    const jan = (await mes(page, 'Janeiro 2027')).join(' / ');
    expect(jan).toMatch(/Reembolso · Terapia.*2 sessões de dez.*\+R\$ 400,00/);
    expect(jan).toMatch(/Terapia.*3 sessões.*−R\$ 600,00/);
  });

  test('conferindo o saldo: "já caiu?" — sim vale hoje e não conta de novo; atrasado que não caiu vai pra amanhã', async ({ page }, info) => {
    // reembolso de outubro previsto pra 28/11 (daqui 3 dias) e o de setembro atrasado (era pra 22/11, saldo conferido em 20/11)
    const D = comTerapia({ inicio: '2026-09', agrupar: undefined, reembolso: { pct: 100, dia: 28 }, pausas: undefined }, { saldo: { valor: 320_000, data: '2026-11-20', ts: 1 } });
    D.recorrentes[0].reembolso!.datas = { '2026-09': '2026-11-22' };
    await abrir(page, D);
    await page.getByRole('button', { name: 'Conferir com o saldo do banco' }).tap();
    const box = page.locator('.sheet .reemb-box');
    await expect(box).toContainText('Reembolso — já caiu na conta?');
    const itens = box.locator('.hoje-it');
    await expect(itens).toHaveCount(2);
    await expect(itens.nth(0)).toContainText('era pra 22/11');
    await expect(itens.nth(0)).toContainText('✓ já caiu'); // atrasado: começa em "já caiu"
    await expect(itens.nth(1)).toContainText('previsto até 28/11');
    await expect(itens.nth(1)).toContainText('ainda não'); // futuro: começa em "ainda não"
    await itens.nth(0).tap(); // o atrasado ainda não caiu
    await itens.nth(1).tap(); // o de outubro já caiu (antes do dia 28)
    await evidencia(page, info, 'conferir o saldo: reembolso já caiu?');
    await page.locator('.sheet').getByRole('button', { name: 'Atualizar saldo' }).tap();
    await page.waitForTimeout(600);
    const r = (await dados(page)).recorrentes[0];
    expect(r.reembolso!.datas).toEqual({ '2026-09': '2026-11-26', '2026-10': '2026-11-25' });
    // o de outubro está no saldo de hoje e não volta em 28/11; o de setembro entra amanhã (26/11)
    await page.locator('.tab', { hasText: 'Extrato' }).tap();
    const nov = (await mes(page, 'Novembro 2026')).join(' / ');
    expect(nov).toMatch(/Reembolso · Terapia.*sessões de set/);
    expect(nov).not.toMatch(/28 Nov.*Reembolso/);
  });
});
