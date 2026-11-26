import { describe, expect, it } from 'vitest';
import { gastosDoMes, historicoCat, resumoGastos } from './gastosMes';
import type { Data, Lancamento } from './types';

const HOJE = '2026-11-26';
let n = 0;
const g = (cat: string, data: string, valor: number, over: Partial<Lancamento> = {}): Lancamento =>
  ({ id: `l${n++}`, tipo: 'saida', valor, cat, data, desc: cat, cartaoId: null, parcelas: 1, criado: 1, meio: 'pix', ...over });
const D = (lancamentos: Lancamento[], over: Partial<Data> = {}): Data => ({
  v: 1, onboarded: true, perfil: { nome: 'x' }, saldo: { valor: 0, data: HOJE, ts: 1 }, uso: {},
  cartoes: [{ id: 'it', nome: 'Itaú', fechamento: 1, vencimento: 10 }], recorrentes: [], lancamentos, ...over,
});
const tot = (d: Data, mk = '2026-11') => Object.fromEntries(gastosDoMes(d, mk, HOJE).cats.map((c) => [c.cat, c.total]));

describe('Para onde foi (gastos do mês por categoria)', () => {
  it('compra no cartão conta no mês da compra, não no vencimento da fatura', () => {
    const d = D([g('compras', '2026-11-20', 30_000, { cartaoId: 'it', meio: 'credito' })]); // fatura vence em dezembro
    expect(tot(d)).toEqual({ compras: 30_000 });
    expect(tot(d, '2026-12')).toEqual({});
  });
  it('parcelado: cada parcela no mês dela', () => {
    const d = D([g('casa', '2026-10-15', 90_000, { cartaoId: 'it', parcelas: 3, meio: 'credito' })]);
    expect(tot(d, '2026-10')).toEqual({ casa: 30_000 });
    expect(tot(d, '2026-11')).toEqual({ casa: 30_000 });
    expect(gastosDoMes(d, '2026-11', HOJE).cats[0].itens[0].parcela).toEqual({ i: 2, n: 3 });
  });
  it('fixos: entram quando já aconteceram (no mês atual, só até hoje)', () => {
    const d = D([], { recorrentes: [
      { id: 'a', tipo: 'saida', desc: 'Aluguel', cat: 'casa', valor: 180_000, dia: 10, inicio: '2026-01' },
      { id: 'n', tipo: 'saida', desc: 'Internet', cat: 'contas', valor: 12_000, dia: 28, inicio: '2026-01' }, // 28/11 ainda não chegou
    ] });
    expect(tot(d)).toEqual({ casa: 180_000 });
    expect(tot(d, '2026-10')).toEqual({ casa: 180_000, contas: 12_000 });
    expect(gastosDoMes(d, '2026-11', HOJE).parcial).toBe(true);
  });
  it('fora: pagamento de fatura e entradas', () => {
    const d = D([g('fatura', '2026-11-10', 450_000), g('mercado', '2026-11-05', 20_000), { ...g('salario', '2026-11-05', 650_000), tipo: 'entrada' }]);
    expect(tot(d)).toEqual({ mercado: 20_000 });
  });
  it('percentual, ordem e comparação com o mês passado', () => {
    const d = D([g('casa', '2026-11-02', 60_000), g('mercado', '2026-11-03', 40_000), g('mercado', '2026-10-03', 20_000)]);
    const m = gastosDoMes(d, '2026-11', HOJE);
    expect(m.total).toBe(100_000);
    expect(m.cats.map((c) => [c.cat, c.pct, c.antes])).toEqual([['casa', 0.6, 0], ['mercado', 0.4, 20_000]]);
    expect(m.totalAntes).toBe(20_000);
    expect(resumoGastos(m, (c) => c)).toMatch(/^casa leva 60%\. mercado subiu R\$\s200 em relação ao mês passado\.$/);
  });
  it('mês em andamento compara com o mês passado até o mesmo dia', () => {
    const d = D([g('mercado', '2026-11-05', 10_000), g('mercado', '2026-10-05', 10_000), g('mercado', '2026-10-29', 50_000)]);
    const m = gastosDoMes(d, '2026-11', HOJE);
    expect(m.ateDia).toBe(26);
    expect(m.totalAntes).toBe(10_000); // o de 29/10 fica de fora: novembro ainda não chegou no dia 29
  });
  it('histórico de 4 meses de uma categoria', () => {
    const d = D([g('mercado', '2026-08-03', 10_000), g('mercado', '2026-10-03', 20_000), g('mercado', '2026-11-03', 30_000)]);
    expect(historicoCat(d, 'mercado', '2026-11', HOJE)).toEqual([{ mk: '2026-08', total: 10_000 }, { mk: '2026-09', total: 0 }, { mk: '2026-10', total: 20_000 }, { mk: '2026-11', total: 30_000 }]);
  });
  it('fixo semanal: cada semana que já passou', () => {
    const d = D([], { recorrentes: [{ id: 'f', tipo: 'saida', desc: 'Feira', cat: 'mercado', valor: 8_000, dia: 1, inicio: '2026-11', freq: 'semanal', semana: 6 }] });
    expect(tot(d)).toEqual({ mercado: 24_000 }); // sábados 7, 14 e 21; o de 28 ainda não chegou
  });
});
