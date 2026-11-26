import { describe, expect, it } from 'vitest';
import { chaveEvento, eventosEntre, projecao } from './engine';
import type { Data, Recorrente } from './types';

const HOJE = '2026-11-26';
const AJUSTE = 1_000_000; // momento em que o saldo foi informado (ms)
const D = (rec: Partial<Recorrente>, over: Partial<Data> = {}): Data => ({
  v: 1, onboarded: true, perfil: { nome: 'x' }, saldo: { valor: 100_000, data: HOJE, ts: AJUSTE }, uso: {},
  cartoes: [{ id: 'roxo', nome: 'Roxo', fechamento: 30, vencimento: 7 }], lancamentos: [],
  recorrentes: [{ id: 'ft', tipo: 'saida', desc: 'Fiel Torcedor', cat: 'lazer', valor: 8_990, dia: 26, inicio: '2026-11', meio: 'pix', ...rec }], ...over,
});
const hoje = (d: Data) => projecao(d, 0, HOJE).saldoEm(HOJE);

describe('saldo de hoje × fixo com vencimento hoje', () => {
  it('fixo criado DEPOIS de informar o saldo: desconta hoje (o caso do Fiel Torcedor)', () => {
    expect(hoje(D({ criado: AJUSTE + 60_000 }))).toBe(100_000 - 8_990);
  });
  it('fixo criado ANTES de informar o saldo: já estava no saldo do banco, não desconta de novo', () => {
    expect(hoje(D({ criado: AJUSTE - 60_000 }))).toBe(100_000);
  });
  it('fixo antigo, sem data de criação: continua como antes (já no saldo)', () => {
    expect(hoje(D({}))).toBe(100_000);
  });
  it('fixo no cartão: não sai da conta hoje, criado quando for', () => {
    expect(hoje(D({ criado: AJUSTE + 60_000, cartaoId: 'roxo', meio: 'credito' }))).toBe(100_000);
  });
  it('marcado "ainda não caiu" no ajuste: desconta, como sempre', () => {
    const d = D({});
    const ev = eventosEntre(d, HOJE, HOJE).find((e) => e.ref === 'ft')!;
    expect(hoje({ ...d, saldo: { ...d.saldo, pendentes: [chaveEvento(ev)] } })).toBe(100_000 - 8_990);
  });
});
