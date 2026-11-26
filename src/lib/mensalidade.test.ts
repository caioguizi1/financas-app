import { describe, expect, it } from 'vitest';
import { chaveNaoMensal, provaveisMensalidades } from './mensalidade';
import type { Data, Lancamento } from './types';

const HOJE = '2026-11-26';
let n = 0;
const g = (desc: string, data: string, valor: number, cartaoId: string | null = 'it'): Lancamento =>
  ({ id: `l${n++}`, tipo: 'saida', valor, cat: 'outros', data, desc, cartaoId, parcelas: 1, criado: 1, meio: cartaoId ? 'credito' : 'pix' });
const D = (lancamentos: Lancamento[], over: Partial<Data> = {}): Data => ({
  v: 1, onboarded: true, perfil: { nome: 'x' }, saldo: { valor: 0, data: HOJE, ts: 1 }, uso: {},
  cartoes: [{ id: 'it', nome: 'Itaú', fechamento: 1, vencimento: 10 }], recorrentes: [], lancamentos, ...over,
});
const nomes = (d: Data) => provaveisMensalidades(d, HOJE).map((p) => p.chave);

describe('provável mensalidade', () => {
  it('mesmo nome, valor e dia em 2 meses seguidos → pergunta', () => {
    const p = provaveisMensalidades(D([g('PETLOVE*SAUDE', '2026-10-08', 15_000), g('PETLOVE*SAUDE', '2026-11-08', 15_000)]), HOJE);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ meses: ['2026-10', '2026-11'], valor: 15_000, dia: 8 });
  });
  it('só um mês (uma fatura importada) → ainda não dá pra saber', () => {
    expect(nomes(D([g('PETLOVE', '2026-11-08', 15_000)]))).toEqual([]);
  });
  it('Uber: várias no mês → nunca', () => {
    expect(nomes(D([g('UBER *TRIP', '2026-10-03', 2_300), g('UBER *TRIP', '2026-10-15', 2_300), g('UBER *TRIP', '2026-11-03', 2_300)]))).toEqual([]);
  });
  it('Uber que repetiu o valor uma vez por mês, mas em dias diferentes → não', () => {
    expect(nomes(D([g('UBER *TRIP', '2026-10-03', 2_300), g('UBER *TRIP', '2026-11-21', 2_300)]))).toEqual([]);
  });
  it('valor variando mais de 10% → não', () => {
    expect(nomes(D([g('MERCADO X', '2026-10-05', 30_000), g('MERCADO X', '2026-11-05', 45_000)]))).toEqual([]);
  });
  it('reajuste pequeno (até 10%) → sim', () => {
    expect(nomes(D([g('ACADEMIA', '2026-10-05', 10_000), g('ACADEMIA', '2026-11-05', 10_900)]))).toEqual(['academia']);
  });
  it('dia que "dá a volta" no mês (30/out e 02/dez não são seguidos; 29/out e 01/nov são parecidos)', () => {
    expect(nomes(D([g('STREAM', '2026-10-29', 3_990), g('STREAM', '2026-11-01', 3_990)]))).toEqual(['stream']);
  });
  it('meses não seguidos → não', () => {
    expect(nomes(D([g('SEGURO', '2026-08-10', 9_000), g('SEGURO', '2026-11-10', 9_000)]))).toEqual([]);
  });
  it('parcelado não conta', () => {
    expect(nomes(D([{ ...g('LOJA', '2026-10-05', 30_000), parcelas: 3 }, { ...g('LOJA', '2026-11-05', 30_000), parcelas: 3 }]))).toEqual([]);
  });
  it('já é fixo (pelo nome, ou com outro nome mas mesmo valor/dia/cartão) → não pergunta', () => {
    const ls = [g('PETLOVE*SAUDE', '2026-10-08', 15_000), g('PETLOVE*SAUDE', '2026-11-08', 15_000)];
    expect(nomes(D(ls, { recorrentes: [{ id: 'r', tipo: 'saida', desc: 'petlove*saude', cat: 'pets', valor: 15_000, dia: 8, inicio: '2026-01' }] }))).toEqual([]);
    expect(nomes(D(ls, { recorrentes: [{ id: 'r', tipo: 'saida', desc: 'Convênio da cachorra', cat: 'pets', valor: 15_000, dia: 9, inicio: '2026-01', cartaoId: 'it' }] }))).toEqual([]);
  });
  it('respondeu "Não é" → não pergunta mais', () => {
    const ls = [g('PETLOVE', '2026-10-08', 15_000), g('PETLOVE', '2026-11-08', 15_000)];
    expect(nomes(D(ls, { dispensados: [chaveNaoMensal('petlove')] }))).toEqual([]);
  });
  it('antiga (último mês há 2 meses ou mais) → não', () => {
    expect(nomes(D([g('VELHA', '2026-08-08', 5_000), g('VELHA', '2026-09-08', 5_000)]))).toEqual([]);
  });
});
