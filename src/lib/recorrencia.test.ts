import { describe, expect, it } from 'vitest';
import { eventosEntre } from './engine';
import { bateComFixo, ocorrencias, porMes, quando } from './recorrencia';
import type { Data, Recorrente } from './types';

const base = (recorrentes: Recorrente[], over: Partial<Data> = {}): Data => ({
  v: 1, onboarded: true, perfil: { nome: 'Teste' },
  saldo: { valor: 100_000, data: '2026-11-20', ts: 1000 },
  recorrentes, cartoes: [], lancamentos: [], uso: {}, ...over,
});
const rec = (p: Partial<Recorrente>): Recorrente => ({ id: 'r', tipo: 'saida', desc: 'X', cat: 'casa', valor: 10_000, dia: 10, inicio: '2026-11', ...p });

describe('semanal', () => {
  const feira = rec({ freq: 'semanal', semana: 6, desc: 'Feira', valor: 8_000 }); // sábado
  it('cai em todo sábado dentro do período', () => {
    expect(ocorrencias(feira, '2026-11-01', '2026-11-30')).toEqual(['2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28']);
  });
  it('respeita início e fim (mês)', () => {
    const r = { ...feira, inicio: '2026-12', fim: '2026-12' };
    expect(ocorrencias(r, '2026-11-01', '2027-01-31')).toEqual(['2026-12-05', '2026-12-12', '2026-12-19', '2026-12-26']);
  });
  it('vira eventos no motor (saída, marcada como fixo)', () => {
    const evs = eventosEntre(base([feira]), '2026-11-21', '2026-12-05');
    expect(evs.map((e) => [e.data, e.valor, e.fixo])).toEqual([['2026-11-21', -8_000, true], ['2026-11-28', -8_000, true], ['2026-12-05', -8_000, true]]);
  });
  it('média do mês: 52 semanas ÷ 12', () => {
    expect(porMes(feira)).toBe(Math.round((8_000 * 52) / 12));
  });
});

describe('anual', () => {
  const ipva = rec({ freq: 'anual', mes: 3, dia: 15, desc: 'IPVA', valor: 120_000, inicio: '2026-01' });
  it('uma vez por ano, no dia e mês escolhidos', () => {
    expect(ocorrencias(ipva, '2026-01-01', '2028-12-31')).toEqual(['2026-03-15', '2027-03-15', '2028-03-15']);
  });
  it('não começa antes do início', () => {
    expect(ocorrencias({ ...ipva, inicio: '2026-04' }, '2026-01-01', '2027-12-31')).toEqual(['2027-03-15']);
  });
  it('29/fev em ano não bissexto cai no último dia', () => {
    const r = rec({ freq: 'anual', mes: 2, dia: 29, inicio: '2027-01' });
    expect(ocorrencias(r, '2027-01-01', '2028-12-31')).toEqual(['2027-02-28', '2028-02-29']);
  });
  it('no cartão: sai no vencimento da fatura', () => {
    const c = { id: 'nu', nome: 'Nubank', fechamento: 3, vencimento: 10 };
    const evs = eventosEntre(base([{ ...ipva, cartaoId: 'nu', meio: 'credito' }], { cartoes: [c] }), '2026-01-01', '2026-12-31');
    expect(evs.map((e) => [e.data, e.venc, e.cartao])).toEqual([['2026-04-10', '2026-04-10', 'Nubank']]);
  });
  it('média do mês: ÷ 12', () => {
    expect(porMes(ipva)).toBe(10_000);
  });
});

describe('mensal continua como sempre', () => {
  it('sem freq = todo mês, mesmo resultado de antes', () => {
    const r = rec({ dia: 31 });
    const evs = eventosEntre(base([r]), '2026-11-01', '2027-02-28');
    expect(evs.map((e) => e.data)).toEqual(['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28']);
    expect(porMes(r)).toBe(r.valor);
  });
});

describe('rótulos e importação', () => {
  it('quando()', () => {
    expect(quando({ dia: 5 })).toBe('Todo dia 5');
    expect(quando({ freq: 'semanal', dia: 1, semana: 1 })).toBe('Toda segunda');
    expect(quando({ freq: 'semanal', dia: 1, semana: 6 })).toBe('Todo sábado');
    expect(quando({ freq: 'anual', dia: 10, mes: 3 })).toBe('Todo ano, 10/mar');
  });
  it('bateComFixo respeita a frequência', () => {
    expect(bateComFixo(rec({ dia: 10 }), '2026-11-12')).toBe(true);
    expect(bateComFixo(rec({ dia: 10 }), '2026-11-20')).toBe(false);
    expect(bateComFixo(rec({ freq: 'anual', mes: 3, dia: 15 }), '2026-03-14')).toBe(true);
    expect(bateComFixo(rec({ freq: 'anual', mes: 3, dia: 15 }), '2026-04-15')).toBe(false);
    expect(bateComFixo(rec({ freq: 'semanal', semana: 6 }), '2026-11-07')).toBe(true); // sábado
    expect(bateComFixo(rec({ freq: 'semanal', semana: 6 }), '2026-11-04')).toBe(false); // quarta
  });
});

import { diasSemBackup, lembrarBackup } from './backupInfo';
describe('lembrete de backup', () => {
  const muitos = Array.from({ length: 12 }, () => ({}));
  it('nunca fez: lembra só quando já tem uso de verdade', () => {
    expect(lembrarBackup({ lancamentos: [], recorrentes: [] }, '2026-11-25')).toBe(false);
    expect(lembrarBackup({ lancamentos: muitos, recorrentes: [] }, '2026-11-25')).toBe(true);
  });
  it('lembra depois de 30 dias', () => {
    expect(diasSemBackup('2026-10-25', '2026-11-25')).toBe(31);
    expect(lembrarBackup({ backupEm: '2026-10-26', lancamentos: muitos, recorrentes: [] }, '2026-11-25')).toBe(false);
    expect(lembrarBackup({ backupEm: '2026-10-25', lancamentos: muitos, recorrentes: [] }, '2026-11-25')).toBe(true);
  });
});
