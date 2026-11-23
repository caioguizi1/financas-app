/**
 * Auditoria do motor: invariantes que precisam valer com TODOS os tipos de entrada juntos.
 * Conferência independente: o saldo final = saldo informado + soma dos eventos que entram na conta,
 * e cada movimento aparece exatamente uma vez.
 */
import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { entraNaConta, eventosEntre, fluxoMeses, projecao } from './engine';
import { faturasAtuais } from './faturas';
import type { Data } from './types';

const HOJE = '2026-11-23';
const base = (): Data => ({
  v: 1, onboarded: true, perfil: { nome: 'Caio' }, saldo: { valor: 40000, data: HOJE, ts: 1000 }, uso: {},
  cartoes: [
    { id: 'pp', nome: 'PicPay', fechamento: 9, vencimento: 15, estimativa: 300000 },
    { id: 'it', nome: 'Itaú', fechamento: 31, vencimento: 7 },
  ],
  recorrentes: [
    { id: 'adi', tipo: 'entrada', desc: 'Adiantamento', cat: 'salario', valor: 262500, dia: 15, inicio: '2026-01', onb: 'renda' },
    { id: 'sal', tipo: 'entrada', desc: 'Salário', cat: 'salario', valor: 262500, dia: 30, inicio: '2026-01', onb: 'renda' },
    { id: 'alu', tipo: 'saida', desc: 'Aluguel', cat: 'casa', valor: 180000, dia: 10, inicio: '2026-01', meio: 'pix' },
    { id: 'cel', tipo: 'saida', desc: 'Celular', cat: 'contas', valor: 5499, dia: 31, inicio: '2026-01', cartaoId: 'pp' },
    { id: 'net', tipo: 'saida', desc: 'Netflix', cat: 'assinaturas', valor: 5590, dia: 5, inicio: '2026-01', fim: '2027-02', cartaoId: 'it' },
  ],
  lancamentos: [
    { id: 'aj', tipo: 'saida', valor: 525000, cat: 'fatura', desc: 'Ajuste fatura Itaú', data: '2026-11-29', cartaoId: 'it', fatura: '2026-12-07', criado: 1 },
    { id: 'tv', tipo: 'saida', valor: 360000, cat: 'compras', desc: 'TV', data: '2026-11-20', cartaoId: 'pp', parcelas: 12, criado: 1 },
    { id: 'imp', tipo: 'saida', valor: 885828, cat: 'compras', desc: 'Loja', data: '2026-01-21', cartaoId: 'it', parcelas: 12, fatura: '2026-02-07', criado: 1 },
    { id: 'bol', tipo: 'saida', valor: 90000, cat: 'casa', desc: 'Sofá', data: '2026-11-25', parcelas: 3, meio: 'boleto', adiar: 1, criado: 1 },
    { id: 'pix', tipo: 'saida', valor: 4590, cat: 'comida', desc: 'iFood', data: HOJE, meio: 'pix', criado: 2000 }, // lançado hoje DEPOIS do saldo
    { id: 'velho', tipo: 'saida', valor: 9999, cat: 'comida', desc: 'Antes do saldo', data: HOJE, meio: 'pix', criado: 500 }, // hoje, ANTES do saldo: já está nele
    { id: 'd13', tipo: 'entrada', valor: 328206, cat: 'salario', desc: '13º 1ª parcela', data: '2026-11-30', criado: 1 },
  ],
  pagFaturas: { 'pp|2026-12-15': { data: '2026-12-02', ts: 5 } }, // paga a fatura do PicPay adiantado
});

describe('auditoria do saldo e do gráfico', () => {
  const D = base();
  const p = projecao(D, 400, HOJE);

  it('saldo final = saldo informado + soma de tudo que entra na conta (sem perder nem duplicar)', () => {
    const soma = p.evs.reduce((a, e) => a + e.valor, 0);
    expect(p.pts[p.pts.length - 1].v).toBe(D.saldo.valor + soma);
    const ids = p.evs.map((e) => `${e.ref}|${e.data}|${e.desc}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('hoje: conta o lançado depois do saldo e ignora o que já estava nele', () => {
    expect(p.saldoEm(HOJE)).toBe(40000 - 4590);
  });

  it('fixo do dia 31 cai no último dia de meses curtos — uma vez por mês, sem pular', () => {
    const evs = eventosEntre(D, '2027-01-01', '2027-12-31').filter((e) => e.ref === 'sal');
    expect(evs.length).toBe(12);
    expect(evs.find((e) => e.data.startsWith('2027-02'))!.data).toBe('2027-02-28');
  });

  it('assinatura com fim para de sair depois do mês final', () => {
    const net = eventosEntre(D, '2026-12-01', '2027-12-31').filter((e) => e.ref === 'net');
    expect(net.every((e) => e.venc! <= '2027-03-07')).toBe(true);
  });

  it('parcelas somam exatamente o valor da compra (centavos inclusos)', () => {
    for (const id of ['tv', 'imp', 'bol']) {
      const l = D.lancamentos.find((x) => x.id === id)!;
      const evs = eventosEntre(D, '2025-01-01', '2028-12-31').filter((e) => e.ref === id);
      expect([evs.length, -evs.reduce((a, e) => a + e.valor, 0)]).toEqual([l.parcelas, l.valor]);
    }
  });

  it('boleto parcelado com "1º pagamento no mês seguinte" começa em dezembro', () => {
    expect(eventosEntre(D, '2026-11-01', '2027-03-31').filter((e) => e.ref === 'bol').map((e) => e.data)).toEqual(['2026-12-25', '2027-01-25', '2027-02-25']);
  });

  it('fatura paga adiantado sai no dia do pagamento e não no vencimento (e só uma vez)', () => {
    const pp = p.evs.filter((e) => e.cartaoId === 'pp' && e.venc === '2026-12-15');
    expect(pp.length).toBeGreaterThan(0);
    expect(pp.every((e) => e.data === '2026-12-02')).toBe(true);
  });

  it('estimativa só completa até o gasto típico — nunca soma por cima do que já foi lançado', () => {
    for (const venc of ['2026-12-15', '2027-01-15', '2027-02-15']) {
      const tot = -p.evs.filter((e) => e.cartaoId === 'pp' && e.venc === venc).reduce((a, e) => a + e.valor, 0);
      expect(tot).toBe(300000);
    }
  });

  it('fatura do Itaú de dezembro = valor informado + Netflix (fixo) — sem contar as parcelas importadas em dobro só se o ajuste foi refeito', () => {
    const f = faturasAtuais(D, D.cartoes[1], HOJE)[0];
    expect(f.vencimento).toBe('2026-12-07');
    expect(f.total).toBe(525000 + 73819 + 5590);
  });

  it('resumo dos meses fecha e encadeia com o gráfico', () => {
    const ms = fluxoMeses(D, HOJE, 6);
    ms.forEach((m, k) => {
      expect(m.inicio + m.ent - m.sai).toBe(m.fim);
      if (k > 0) expect(m.inicio).toBe(ms[k - 1].fim);
      expect(m.fim).toBe(p.saldoEm(m.ate));
    });
    expect(ms[0].inicio).toBe(p.saldoEm(HOJE));
  });

  it('saldo informado no passado: o que aconteceu entre aquela data e hoje entra no saldo de hoje', () => {
    const D2 = { ...base(), saldo: { valor: 40000, data: '2026-11-08', ts: 1 } };
    const p2 = projecao(D2, 10, HOJE);
    const entre = p2.evs.filter((e) => e.data > '2026-11-08' && e.data <= HOJE).reduce((a, e) => a + e.valor, 0);
    expect(p2.saldoEm(HOJE)).toBe(40000 + entre);
    expect(entre).toBe(262500 - 180000 - 5499 - 4590 - 9999); // adiantamento 15/11, aluguel 10/11, fatura PicPay 15/11 (celular), lançamentos de hoje
  });

  it('cada evento que aparece no gráfico passa pela regra do saldo', () => {
    expect(p.evs.every((e) => entraNaConta(D, e))).toBe(true);
    expect(p.pts[0].d).toBe(HOJE);
    expect(p.pts.length).toBe(401);
    for (let i = 1; i < p.pts.length; i++) expect(p.pts[i].d).toBe(addDays(p.pts[i - 1].d, 1));
  });
});

describe('saldo conferido no dia de um movimento previsto', () => {
  it('salário de hoje marcado como "ainda não caiu" entra na previsão; o que já caiu não duplica', () => {
    const D = { ...base(), saldo: { valor: 40000, data: '2026-11-30', ts: 1000 } };
    const sem = projecao(D, 0, '2026-11-30').saldoEm('2026-11-30');
    const com = projecao({ ...D, saldo: { ...D.saldo, pendentes: ['sal|2026-11-30'] } }, 0, '2026-11-30').saldoEm('2026-11-30');
    expect(com! - sem!).toBe(262500);
  });
});

describe('resumo do mês com salário de hoje ainda não caído', () => {
  it('saldo de agora fica sem ele; o salário aparece em "ainda entra"; a conta fecha', () => {
    const D = { ...base(), saldo: { valor: 40000, data: '2026-11-30', ts: 1000, pendentes: ['sal|2026-11-30'] } };
    const [m] = fluxoMeses(D, '2026-11-30', 1);
    expect(m.inicio).toBe(40000);
    expect(m.ent).toBeGreaterThanOrEqual(262500);
    expect(m.inicio + m.ent - m.sai).toBe(m.fim);
  });
});
