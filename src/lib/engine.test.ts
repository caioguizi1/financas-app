import { describe, expect, it } from 'vitest';
import { eventosEntre, pagamentoCartao, projecao, resumoMes } from './engine';
import type { Data } from './types';

const base = (over: Partial<Data> = {}): Data => ({
  v: 1, onboarded: true, perfil: { nome: 'Teste' },
  saldo: { valor: 100_000, data: '2026-11-20', ts: 1000 },
  recorrentes: [], cartoes: [], lancamentos: [], uso: {}, ...over,
});
const nubank = { id: 'nu', nome: 'Nubank', fechamento: 3, vencimento: 10 };

describe('pagamentoCartao', () => {
  it('compra antes do fechamento vence no mesmo mês', () => {
    expect(pagamentoCartao(nubank, '2026-11-02')).toBe('2026-11-10');
  });
  it('compra no dia do fechamento ou depois vai pra próxima fatura', () => {
    expect(pagamentoCartao(nubank, '2026-11-03')).toBe('2026-12-10');
    expect(pagamentoCartao(nubank, '2026-11-20')).toBe('2026-12-10');
  });
  it('vencimento antes do fechamento cai no mês seguinte', () => {
    const c = { id: 'x', nome: 'X', fechamento: 25, vencimento: 5 };
    expect(pagamentoCartao(c, '2026-11-10')).toBe('2026-12-05');
    expect(pagamentoCartao(c, '2026-11-26')).toBe('2027-01-05');
  });
  it('virada de ano', () => {
    expect(pagamentoCartao(nubank, '2026-12-15')).toBe('2027-01-10');
  });
});

describe('recorrentes', () => {
  it('dia 31 vira o último dia em meses curtos', () => {
    const D = base({ recorrentes: [{ id: 'r', tipo: 'saida', desc: 'X', cat: 'contas', valor: 100, dia: 31, inicio: '2026-01' }] });
    const datas = eventosEntre(D, '2027-02-01', '2027-02-28').map((e) => e.data);
    expect(datas).toEqual(['2027-02-28']);
  });
  it('respeita início e fim', () => {
    const D = base({ recorrentes: [{ id: 'r', tipo: 'saida', desc: 'X', cat: 'contas', valor: 100, dia: 10, inicio: '2026-12', fim: '2027-01' }] });
    expect(eventosEntre(D, '2026-11-01', '2027-03-31').map((e) => e.data)).toEqual(['2026-12-10', '2027-01-10']);
  });
  it('salário em duas partes gera duas entradas por mês', () => {
    const D = base({ recorrentes: [
      { id: 'a', tipo: 'entrada', desc: 'Adiantamento', cat: 'salario', valor: 340_000, dia: 20, inicio: '2026-11' },
      { id: 's', tipo: 'entrada', desc: 'Salário', cat: 'salario', valor: 510_000, dia: 5, inicio: '2026-11' },
    ] });
    const r = resumoMes(D, 2026, 11); // dezembro
    expect(r.ent).toBe(850_000);
    expect(r.evs.map((e) => e.data)).toEqual(['2026-12-05', '2026-12-20']);
  });
});

describe('parcelas no cartão', () => {
  it('divide em N faturas e o resto dos centavos fica na 1ª', () => {
    const D = base({ cartoes: [nubank], lancamentos: [{ id: 'l', tipo: 'saida', valor: 1000, cat: 'compras', desc: 'Tênis', data: '2026-11-20', cartaoId: 'nu', parcelas: 3, criado: 2000 }] });
    const evs = eventosEntre(D, '2026-11-01', '2027-03-31');
    expect(evs.map((e) => [e.data, e.valor])).toEqual([['2026-12-10', -334], ['2027-01-10', -333], ['2027-02-10', -333]]);
    expect(evs.reduce((a, e) => a + e.valor, 0)).toBe(-1000);
  });
});

describe('projecao', () => {
  it('não conta o que já estava no saldo informado', () => {
    const D = base({ lancamentos: [
      { id: 'antes', tipo: 'saida', valor: 5000, cat: 'comida', desc: '', data: '2026-11-20', criado: 500 },
      { id: 'depois', tipo: 'saida', valor: 3000, cat: 'comida', desc: '', data: '2026-11-20', criado: 2000 },
    ] });
    const p = projecao(D, 10, '2026-11-20');
    expect(p.saldoEm('2026-11-20')).toBe(100_000 - 3000);
  });
  it('acumula entradas e saídas futuras', () => {
    const D = base({ recorrentes: [
      { id: 's', tipo: 'entrada', desc: 'Salário', cat: 'salario', valor: 500_000, dia: 5, inicio: '2026-11' },
      { id: 'f', tipo: 'saida', desc: 'Aluguel', cat: 'casa', valor: 200_000, dia: 10, inicio: '2026-11' },
    ] });
    const p = projecao(D, 30, '2026-11-20');
    expect(p.saldoEm('2026-12-05')).toBe(600_000);
    expect(p.saldoEm('2026-12-10')).toBe(400_000);
  });
});
