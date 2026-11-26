import { describe, expect, it } from 'vitest';
import { eventosEntre } from './engine';
import { fixoDoLancamento } from './insights';
import type { Data, Lancamento } from './types';

const c = { id: 'it', nome: 'Itaú', fechamento: 1, vencimento: 10 };
const pet = (id: string, data: string): Lancamento => ({ id, tipo: 'saida', valor: 15_000, cat: 'pets', data, desc: 'PETLOVE', cartaoId: 'it', parcelas: 1, criado: 1, meio: 'credito', importado: true });
const D = (lancamentos: Lancamento[]): Data => ({ v: 1, onboarded: true, perfil: { nome: 'x' }, saldo: { valor: 0, data: '2026-11-26', ts: 1 }, cartoes: [c], uso: {}, lancamentos, recorrentes: [] });

describe('Virar fixo (gasto que se repete)', () => {
  it('mês atual já lançado: o fixo começa no mês seguinte e a fatura não conta duas vezes', () => {
    const ls = [pet('a', '2026-09-08'), pet('b', '2026-10-08'), pet('c', '2026-11-08')];
    const r = fixoDoLancamento(ls[2], '2026-11-26', 'r');
    expect(r).toMatchObject({ inicio: '2026-12', dia: 8, cartaoId: 'it', meio: 'credito', valor: 15_000 });
    const evs = eventosEntre({ ...D(ls), recorrentes: [r] }, '2026-11-26', '2027-02-28').filter((e) => e.desc === 'PETLOVE');
    // fatura de 10/12 = compra de novembro (1x); 10/01 e 10/02 = o fixo
    expect(evs.map((e) => [e.data, e.valor])).toEqual([['2026-12-10', -15_000], ['2027-01-10', -15_000], ['2027-02-10', -15_000]]);
  });
  it('mês atual ainda não lançado: o fixo já vale para este mês', () => {
    const r = fixoDoLancamento(pet('b', '2026-10-08'), '2026-11-26', 'r');
    expect(r.inicio).toBe('2026-11');
  });
  it('fora do cartão: mantém Pix ou boleto', () => {
    expect(fixoDoLancamento({ ...pet('x', '2026-10-05'), cartaoId: null, meio: 'boleto' }, '2026-11-26', 'r')).toMatchObject({ cartaoId: null, meio: 'boleto' });
  });
});
