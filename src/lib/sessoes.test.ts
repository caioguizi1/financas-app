import { describe, expect, it } from 'vitest';
import { eventosEntre, projecao } from './engine';
import { ocorrencias, pagamentosAgrupados, reembolsosDoFixo, sessoesNoMes } from './recorrencia';
import type { Data, Recorrente } from './types';

/**
 * v2.54 — o caso da terapia (valores fictícios): R$ 200 por sessão, toda segunda, paga junto no dia 30,
 * reembolso de 100% até o dia 7 do mês seguinte, pausa de 21/12 a 04/01 (férias).
 * Segundas: nov/26 = 2, 9, 16, 23, 30 · dez = 7, 14, (21, 28 pausadas) · jan/27 = (4 pausada), 11, 18, 25 · fev = 1, 8, 15, 22.
 */
const terapia: Recorrente = {
  id: 't', tipo: 'saida', desc: 'Terapia', cat: 'saude', valor: 20_000, dia: 1, inicio: '2026-11',
  freq: 'semanal', semana: 1, meio: 'pix', agrupar: { dia: 30 }, reembolso: { pct: 100, dia: 7 },
  pausas: [{ de: '2026-12-21', ate: '2027-01-04' }],
};
const base = (recorrentes: Recorrente[], over: Partial<Data> = {}): Data => ({
  v: 1, onboarded: true, perfil: { nome: 'Teste' },
  saldo: { valor: 300_000, data: '2026-11-28', ts: 1000 },
  recorrentes, cartoes: [], lancamentos: [], uso: {}, ...over,
});
const resumo = (D: Data, de: string, ate: string) => eventosEntre(D, de, ate).map((e) => [e.data, e.valor, e.sessoes, e.cat]);

describe('sessões: contagem com pausas', () => {
  it('5 em novembro, 2 em dezembro, 3 em janeiro, 4 em fevereiro', () => {
    expect(sessoesNoMes(terapia, '2026-11')).toHaveLength(5);
    expect(sessoesNoMes(terapia, '2026-12')).toEqual(['2026-12-07', '2026-12-14']);
    expect(sessoesNoMes(terapia, '2027-01')).toEqual(['2027-01-11', '2027-01-18', '2027-01-25']);
    expect(sessoesNoMes(terapia, '2027-02')).toHaveLength(4);
  });
  it('pausa vale também para quem paga por sessão', () => {
    expect(ocorrencias({ ...terapia, agrupar: undefined }, '2026-12-01', '2027-01-10')).toEqual(['2026-12-07', '2026-12-14']);
  });
});

describe('pago junto no fim do mês', () => {
  it('um pagamento por mês, no dia 30 (fev: último dia), com todas as sessões do mês', () => {
    expect(pagamentosAgrupados(terapia, '2026-11-28', '2027-02-28').map((p) => [p.data, p.n, p.valor])).toEqual([
      ['2026-11-30', 5, 100_000], ['2026-12-30', 2, 40_000], ['2027-01-30', 3, 60_000], ['2027-02-28', 4, 80_000],
    ]);
  });
  it('mês todo pausado: nada a pagar nem a reembolsar', () => {
    const r = { ...terapia, pausas: [{ de: '2026-12-01', ate: '2026-12-31' }] };
    expect(pagamentosAgrupados(r, '2026-12-01', '2026-12-31')).toEqual([]);
    expect(reembolsosDoFixo(r, '2027-01-01', '2027-01-31')).toEqual([]);
  });
});

describe('reembolso no mês seguinte', () => {
  it('100% do que foi pago, no dia 7 do mês seguinte', () => {
    expect(reembolsosDoFixo(terapia, '2026-11-28', '2027-03-31').map((x) => [x.data, x.mk, x.valor])).toEqual([
      ['2026-12-07', '2026-11', 100_000], ['2027-01-07', '2026-12', 40_000], ['2027-02-07', '2027-01', 60_000], ['2027-03-07', '2027-02', 80_000],
    ]);
  });
  it('percentual parcial arredonda no centavo', () => {
    expect(reembolsosDoFixo({ ...terapia, reembolso: { pct: 80, dia: 7 } }, '2026-12-01', '2026-12-31')[0].valor).toBe(80_000);
    expect(reembolsosDoFixo({ ...terapia, valor: 33_333, reembolso: { pct: 70, dia: 7 } }, '2026-12-01', '2026-12-31')[0].valor).toBe(116_666); // 5 × 333,33 × 70% = 1.166,655 → 1.166,66
  });
  it('caiu antes (dia 3): vale no dia em que caiu, e não no dia 7', () => {
    const r = { ...terapia, reembolso: { pct: 100, dia: 7, datas: { '2026-11': '2026-12-03' } } };
    const x = reembolsosDoFixo(r, '2026-11-28', '2026-12-31');
    expect(x.map((y) => [y.data, y.valor, y.ajustado])).toEqual([['2026-12-03', 100_000, true]]);
  });
});

describe('no motor: os valores entram certinho na projeção', () => {
  const D = base([terapia]);
  it('eventos: saída no dia 30 e reembolso no dia 7, sessão a sessão contada', () => {
    expect(resumo(D, '2026-11-28', '2027-01-31')).toEqual([
      ['2026-11-30', -100_000, 5, 'saude'], ['2026-12-07', 100_000, 5, 'reembolso'],
      ['2026-12-30', -40_000, 2, 'saude'], ['2027-01-07', 40_000, 2, 'reembolso'], ['2027-01-30', -60_000, 3, 'saude'],
    ]);
  });
  it('saldo: cai R$ 1.000 no dia 30 e volta inteiro no dia 7 (o reembolso desconta tudo)', () => {
    const p = projecao(D, 70, '2026-11-28');
    expect(p.saldoEm('2026-11-29')).toBe(300_000);
    expect(p.saldoEm('2026-11-30')).toBe(200_000);
    expect(p.saldoEm('2026-12-06')).toBe(200_000);
    expect(p.saldoEm('2026-12-07')).toBe(300_000);
    expect(p.saldoEm('2026-12-30')).toBe(260_000);
    expect(p.saldoEm('2027-01-07')).toBe(300_000);
  });
  it('reembolso que caiu antes do saldo conferido não conta de novo', () => {
    // conferiu o saldo em 03/12 já com o reembolso dentro
    const r = { ...terapia, reembolso: { pct: 100, dia: 7, datas: { '2026-11': '2026-12-03' } } };
    const D2 = base([r], { saldo: { valor: 300_000, data: '2026-12-03', ts: 2000 } });
    const p = projecao(D2, 40, '2026-12-03');
    expect(p.saldoEm('2026-12-07')).toBe(300_000); // nada entra no dia 7
    expect(p.saldoEm('2026-12-30')).toBe(260_000);
  });
  it('sem reembolso e por sessão: cada segunda sai da conta, menos as pausadas', () => {
    const r = { ...terapia, agrupar: undefined, reembolso: undefined };
    expect(resumo(base([r]), '2026-12-01', '2027-01-12').map((x) => x[0])).toEqual(['2026-12-07', '2026-12-14', '2027-01-11']);
  });
  it('pausa também vale para fixo mensal', () => {
    const m: Recorrente = { id: 'a', tipo: 'saida', desc: 'Academia', cat: 'saude', valor: 12_000, dia: 10, inicio: '2026-11', pausas: [{ de: '2027-01-01', ate: '2027-01-31' }] };
    expect(resumo(base([m]), '2026-12-01', '2027-02-28').map((x) => x[0])).toEqual(['2026-12-10', '2027-02-10']);
  });
});
