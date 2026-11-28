import { describe, expect, it } from 'vitest';
import { gerarInsights, parcelasAbertas } from './insights';
import type { Data, Lancamento } from './types';

const HOJE = '2026-11-23';
const base = (over: Partial<Data> = {}): Data => ({
  v: 1, onboarded: true, perfil: { nome: '' }, saldo: { valor: 300_000, data: HOJE, ts: 1 },
  recorrentes: [
    { id: 's', tipo: 'entrada', desc: 'Salário', cat: 'salario', valor: 800_000, dia: 5, inicio: '2026-01' },
    { id: 'a', tipo: 'saida', desc: 'Aluguel', cat: 'casa', valor: 200_000, dia: 1, inicio: '2026-01' },
  ],
  cartoes: [], lancamentos: [], uso: {}, ...over,
});
const lanc = (id: string, data: string, valor: number, cat = 'comida', desc = '', extra: Partial<Lancamento> = {}): Lancamento =>
  ({ id, tipo: 'saida', valor, cat, desc, data, criado: 1, ...extra });

describe('insights', () => {
  it('gasto por dia desconta as contas: 3.000 − aluguel 2.000 = 1.000 pra 11 dias até a véspera do salário', () => {
    const i = gerarInsights(base(), HOJE).find((x) => x.id === 'dia')!;
    // 24/11 … 04/12 = 11 dias → R$ 90/dia (o salário de 05/12 cobre o resto)
    expect(i.titulo).toBe('R$ 90,00 por dia');
    expect(i.texto).toContain('04/12');
  });
  it('v2.58: conta o que vem DEPOIS do salário (antes ficava de fora e a dica ficava folgada demais)', () => {
    // só salário (8.000 dia 5) + uma compra grande de 8.500 em 07/12, logo depois dele
    const D = base({ recorrentes: [base().recorrentes[0]], lancamentos: [lanc('g', '2026-12-07', 850_000, 'casa', 'Conserto', { meio: 'pix' })] });
    const i = gerarInsights(D, HOJE).find((x) => x.id === 'dia')!;
    // antes: 3.000 ÷ 12 dias até o salário = R$ 250/dia. Agora: 07/12 fica 2.500 e o próximo salário é 05/01
    // → 2.500 ÷ 42 dias (até 04/01) = R$ 59/dia
    expect(i.titulo).toBe('R$ 59,00 por dia');
    expect(i.texto).toContain('04/01');
  });
  it('v2.58: se o saldo fica negativo em algum dia dos próximos 90, não sugere gasto por dia', () => {
    const fatura = { id: 'f', tipo: 'saida' as const, desc: 'Fatura grande', cat: 'fatura', valor: 950_000, dia: 7, inicio: '2026-01' };
    const i = gerarInsights(base({ recorrentes: [...base().recorrentes, fatura] }), HOJE).find((x) => x.id === 'dia')!;
    expect(i.tom).toBe('alerta');
    expect(i.titulo).toBe('Contas acima do saldo');
    expect(i.texto).toContain('07/12');
  });
  it('alerta quando as contas passam do saldo', () => {
    const i = gerarInsights(base({ saldo: { valor: 100_000, data: HOJE, ts: 1 } }), HOJE).find((x) => x.id === 'dia')!;
    expect(i.tom).toBe('alerta');
  });
  it('categoria acima da média', () => {
    const D = base({ lancamentos: [lanc('1', '2026-09-10', 40_000), lanc('2', '2026-10-10', 40_000), lanc('3', '2026-11-10', 90_000)] });
    const i = gerarInsights(D, HOJE).find((x) => x.id === 'cat-comida')!;
    expect(i.titulo).toBe('Comida: +125% este mês');
  });
  it('sugere virar fixo o que se repete 3 meses', () => {
    const D = base({ lancamentos: ['2026-09-08', '2026-10-08', '2026-11-08'].map((d, k) => lanc(String(k), d, 2190, 'assinaturas', 'Spotify')) });
    const i = gerarInsights(D, HOJE).find((x) => x.id === 'rec-spotify')!;
    expect(i.acao?.tipo).toBe('virarFixo');
  });
  it('não sugere fixo pra quem já é fixo', () => {
    const D = base({ lancamentos: ['2026-09-08', '2026-10-08', '2026-11-08'].map((d, k) => lanc(String(k), d, 1000, 'casa', 'Aluguel')) });
    expect(gerarInsights(D, HOJE).some((x) => x.id === 'rec-aluguel')).toBe(false);
  });
  it('fatura prevista do cartão', () => {
    const D = base({ cartoes: [{ id: 'nu', nome: 'Nubank', fechamento: 3, vencimento: 10 }], lancamentos: [lanc('c', '2026-11-20', 15_000, 'compras', 'Tênis', { cartaoId: 'nu' })] });
    const i = gerarInsights(D, HOJE).find((x) => x.id === 'fat-nu-aberta')!;
    expect(i.titulo).toBe('Fatura Nubank: R$ 150,00');
    expect(i.texto).toContain('10/12');
  });
  it('parcelas em aberto', () => {
    const D = base({ lancamentos: [lanc('p', '2026-10-15', 100_000, 'compras', 'Celular', { parcelas: 10 })] });
    const [a] = parcelasAbertas(D, HOJE);
    expect(a.total).toBe(10);
    expect(a.pagas).toBe(2); // out e nov
    expect(a.restante).toBe(80_000);
    expect(a.ultima).toBe('2027-07-15');
  });
});

import { trechoNegativo } from './insights';
describe('trecho negativo (alerta do Início)', () => {
  it('avisa o PRIMEIRO dia negativo, o pior ponto e a volta', () => {
    const pts = [['12-10', 5000], ['12-11', -8000], ['12-12', -8000], ['12-15', -115500], ['12-19', -20000], ['12-20', 242500], ['12-28', -1000]].map(([d, v]) => ({ d: `2026-${d}`, v: v as number }));
    const t = trechoNegativo(pts)!;
    expect([t.inicio.d, t.inicio.v]).toEqual(['2026-12-11', -8000]);
    expect([t.pior.d, t.pior.v]).toEqual(['2026-12-15', -115500]);
    expect(t.volta?.d).toBe('2026-12-20');
  });
  it('sem negativo → nada', () => {
    expect(trechoNegativo([{ d: '2026-12-01', v: 1 }])).toBeNull();
  });
});

import { parcelasPorMes } from './insights';
describe('parcelas mês a mês', () => {
  it('soma os cartões no mês em que sai da conta e compara com o que entra', () => {
    const pp = { id: 'pp', nome: 'PicPay', fechamento: 9, vencimento: 15 }, it_ = { id: 'it', nome: 'Itaú', fechamento: 31, vencimento: 7 };
    const L = (id: string, cartaoId: string, valor: number, parcelas: number, data: string) => ({ id, tipo: 'saida' as const, valor, cat: 'compras', desc: id, data, cartaoId, meio: 'credito' as const, parcelas, criado: 1 });
    const D = { v: 1, onboarded: true, perfil: { nome: 'X' }, saldo: { valor: 0, data: '2026-11-24', ts: 1 }, cartoes: [pp, it_], uso: {},
      recorrentes: [{ id: 'ad', tipo: 'entrada', desc: 'Adiantamento', cat: 'salario', valor: 265000, dia: 15, inicio: '2026-01' }, { id: 's', tipo: 'entrada', desc: 'Salário', cat: 'salario', valor: 265000, dia: 30, inicio: '2026-01' }],
      lancamentos: [L('a', 'pp', 30000, 3, '2026-11-20'), L('b', 'it', 60000, 2, '2026-11-20')] } as never;
    const m = parcelasPorMes(D, '2026-11-24');
    expect(m.map((x) => [x.mes, x.total, x.renda])).toEqual([['2026-12', 40000, 530000], ['2027-01', 40000, 530000], ['2027-02', 10000, 530000]]);
    expect(m[0].porOrigem.map((o) => [o.nome, o.valor])).toEqual([['PicPay', 10000], ['Itaú', 30000]]);
  });
});
