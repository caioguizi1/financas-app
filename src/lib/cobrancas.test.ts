/**
 * v2.57 — mudar COMO um fixo é pago (Pix ↔ cartão, outro cartão), o dia ou o valor não pode mexer no que já
 * aconteceu: a cobrança deste mês que já passou fica como foi, e a mudança vale da próxima em diante.
 * Cartões: Roxo fecha 8 / vence 15 · Laranja fecha 30 / vence 7 (vence no mês seguinte). Hoje: 25/11/2026.
 */
import { describe, expect, it } from 'vitest';
import { cobrancas, jaCobrouNoMes, proximaCobranca } from './cobrancas';
import { eventosEntre, projecao } from './engine';
import { fatura, fixosNoCartao } from './faturas';
import { aplicarAlteracao, type Vigencia } from './versions';
import type { Data, Recorrente } from './types';

const HOJE = '2026-11-25';
const base = (): Data => ({
  v: 1, onboarded: true, perfil: { nome: 'A' }, saldo: { valor: 1_000_000, data: HOJE, ts: 1 }, lancamentos: [], uso: {}, backupEm: HOJE,
  cartoes: [{ id: 'roxo', nome: 'Roxo', fechamento: 8, vencimento: 15 }, { id: 'lar', nome: 'Laranja', fechamento: 30, vencimento: 7 }],
  recorrentes: [
    { id: 'net', tipo: 'saida', desc: 'Internet', cat: 'contas', valor: 12_000, dia: 12, inicio: '2026-01', meio: 'pix' },
    { id: 'aca', tipo: 'saida', desc: 'Academia', cat: 'saude', valor: 10_000, dia: 12, inicio: '2026-01', cartaoId: 'lar', meio: 'credito' },
    { id: 'alu', tipo: 'saida', desc: 'Aluguel', cat: 'casa', valor: 180_000, dia: 10, inicio: '2026-01', meio: 'boleto' },
    { id: 'str', tipo: 'saida', desc: 'Streaming', cat: 'assinaturas', valor: 5_000, dia: 3, inicio: '2026-01', cartaoId: 'roxo', meio: 'credito' },
  ],
});
const rec = (D: Data, id: string) => D.recorrentes.find((r) => r.id === id)!;
/** Como a tela salva: vale do mês que vem se a cobrança deste mês já passou. */
const editar = (D: Data, id: string, m: Partial<Recorrente>, vig?: Vigencia): Data => {
  const padrao: Vigencia = jaCobrouNoMes(rec(D, id), '2026-11', HOJE) ? '2026-12' : '2026-11';
  return { ...D, recorrentes: aplicarAlteracao(D.recorrentes, id, m, vig ?? padrao) };
};
const fat = (D: Data, c: string, v: string) => fatura(D, D.cartoes.find((x) => x.id === c)!, v, 'aberta');
const itens = (D: Data, c: string, v: string) => fat(D, c, v).itens.map((e) => e.desc).sort();
const saidas = (D: Data, desc: string, de: string, ate: string) => projecao(D, 80, HOJE).evs.filter((e) => e.desc === desc && e.data >= de && e.data <= ate).map((e) => e.data);

describe('quando a cobrança deste mês já passou', () => {
  it('mensal: passou só se o dia é antes de hoje', () => {
    const r = rec(base(), 'net');
    expect(jaCobrouNoMes(r, '2026-11', '2026-11-25')).toBe('2026-11-12');
    expect(jaCobrouNoMes(r, '2026-11', '2026-11-12')).toBeNull(); // hoje mesmo: ainda pode não ter caído
    expect(jaCobrouNoMes(r, '2026-11', '2026-11-05')).toBeNull();
  });
  it('semanal: a última sessão antes de hoje; "pago junto" vale o dia do pagamento', () => {
    const t: Recorrente = { id: 't', tipo: 'saida', desc: 'Sessão', cat: 'saude', valor: 20_000, dia: 1, inicio: '2026-01', freq: 'semanal', semana: 3, meio: 'pix' };
    expect(jaCobrouNoMes(t, '2026-11', HOJE)).toBe('2026-11-18');
    expect(jaCobrouNoMes({ ...t, agrupar: { dia: 30 } }, '2026-11', HOJE)).toBeNull();
    expect(jaCobrouNoMes({ ...t, agrupar: { dia: 20 } }, '2026-11', HOJE)).toBe('2026-11-20');
  });
  it('fixo que só começa depois ou está pausado não conta como cobrado', () => {
    const r = rec(base(), 'net');
    expect(jaCobrouNoMes({ ...r, inicio: '2026-12' }, '2026-11', HOJE)).toBeNull();
    expect(jaCobrouNoMes({ ...r, pausas: [{ de: '2026-11-01', ate: '2026-11-20' }] }, '2026-11', HOJE)).toBeNull();
  });
});

describe('trocar a forma de pagamento não mexe no que já aconteceu', () => {
  it('Pix → cartão Laranja: a de 12/nov (já paga no Pix) NÃO entra na fatura de 07/12; a de 12/dez vai pra 07/01', () => {
    const D = editar(base(), 'net', { cartaoId: 'lar', meio: 'credito' });
    expect(itens(D, 'lar', '2026-12-07')).toEqual(['Academia']);
    expect(itens(D, 'lar', '2027-01-07')).toEqual(['Academia', 'Internet']);
    expect(saidas(D, 'Internet', '2026-11-26', '2027-01-31')).toEqual(['2027-01-07']); // 1 cobrança, nenhuma em dobro
    // o jeito antigo (reescrever tudo) contava a de novembro de novo:
    const errado = editar(base(), 'net', { cartaoId: 'lar', meio: 'credito' }, 'sempre');
    expect(itens(errado, 'lar', '2026-12-07')).toEqual(['Academia', 'Internet']);
  });
  it('cartão Laranja → Pix: a de 12/nov continua na fatura de 07/12 (ela foi no cartão); a de 12/dez sai no Pix', () => {
    const D = editar(base(), 'aca', { cartaoId: null, meio: 'pix' });
    expect(itens(D, 'lar', '2026-12-07')).toEqual(['Academia']);
    expect(saidas(D, 'Academia', '2026-11-26', '2026-12-31')).toEqual(['2026-12-07', '2026-12-12']);
    const errado = editar(base(), 'aca', { cartaoId: null, meio: 'pix' }, 'sempre');
    expect(itens(errado, 'lar', '2026-12-07')).toEqual([]); // sumia da fatura: projeção otimista
  });
  it('cartão Roxo → Laranja: a de 03/nov fica na fatura Roxo (já paga); a de 03/dez vai pra Laranja 07/01', () => {
    const D = editar(base(), 'str', { cartaoId: 'lar' });
    expect(itens(D, 'lar', '2026-12-07')).toEqual(['Academia']);
    expect(itens(D, 'roxo', '2026-11-15')).toEqual(['Streaming']);
    expect(itens(D, 'roxo', '2026-12-15')).toEqual([]);
    expect(itens(D, 'lar', '2027-01-07')).toEqual(['Academia', 'Streaming']);
  });
  it('"Este mês" continua possível (ex.: a cobrança ainda não tinha caído) — quem escolhe é a pessoa', () => {
    const D = editar(base(), 'aca', { cartaoId: null, meio: 'pix' }, '2026-11');
    expect(itens(D, 'lar', '2026-12-07')).toEqual([]);
  });
});

describe('trocar o dia ou o valor', () => {
  it('Aluguel do dia 10 pro 28 em 25/nov: o de novembro já foi pago, não sai de novo em 28/11', () => {
    const D = editar(base(), 'alu', { dia: 28 });
    expect(saidas(D, 'Aluguel', '2026-11-26', '2026-12-31')).toEqual(['2026-12-28']);
    expect(saidas(editar(base(), 'alu', { dia: 28 }, '2026-11'), 'Aluguel', '2026-11-26', '2026-11-30')).toEqual(['2026-11-28']); // o risco do "Este mês"
  });
  it('valor novo no cartão vale da próxima cobrança: a de 12/nov fica com o valor antigo na fatura de 07/12', () => {
    const D = editar(base(), 'aca', { valor: 15_000 });
    expect(fat(D, 'lar', '2026-12-07').total).toBe(10_000);
    expect(fat(D, 'lar', '2027-01-07').total).toBe(15_000);
  });
  it('dia que cruza o fechamento do cartão muda de fatura: Roxo (fecha 8) dia 5 → 15/12, dia 9 → 15/01', () => {
    const D = base();
    const r = { ...rec(D, 'str'), inicio: '2026-12' };
    expect(proximaCobranca(D, { ...r, dia: 5 }, '2026-12-01')).toMatchObject({ data: '2026-12-05', venc: '2026-12-15' });
    expect(proximaCobranca(D, { ...r, dia: 8 }, '2026-12-01')).toMatchObject({ data: '2026-12-08', venc: '2027-01-15' }); // no dia do fechamento já é a próxima
    expect(proximaCobranca(D, { ...r, dia: 9 }, '2026-12-01')).toMatchObject({ data: '2026-12-09', venc: '2027-01-15' });
  });
});

describe('próxima cobrança (o que a tela mostra antes de salvar)', () => {
  it('Pix sai no dia; cartão sai no vencimento (ou no dia em que a fatura foi paga/agendada)', () => {
    const D = base();
    expect(proximaCobranca(D, rec(D, 'net'), '2026-12-01')).toEqual({ data: '2026-12-12', sai: '2026-12-12' });
    expect(proximaCobranca(D, rec(D, 'aca'), '2026-12-01')).toMatchObject({ data: '2026-12-12', venc: '2027-01-07', sai: '2027-01-07' });
    const pago = { ...D, pagFaturas: { 'lar|2027-01-07': { data: '2027-01-02', ts: 9 } } };
    expect(proximaCobranca(pago, rec(D, 'aca'), '2026-12-01')).toMatchObject({ venc: '2027-01-07', sai: '2027-01-02' });
  });
  it('mesmas datas que o motor (mensal com 31, anual, pausas)', () => {
    const r: Recorrente = { id: 'x', tipo: 'saida', desc: 'X', cat: 'contas', valor: 100, dia: 31, inicio: '2026-01', meio: 'pix', pausas: [{ de: '2027-01-01', ate: '2027-01-31' }] };
    const D = { ...base(), recorrentes: [r] };
    expect(cobrancas(r, '2026-11-01', '2027-02-28')).toEqual(eventosEntre(D, '2026-11-01', '2027-02-28').map((e) => e.data));
    expect(cobrancas(r, '2026-11-01', '2027-02-28')).toEqual(['2026-11-30', '2026-12-31', '2027-02-28']);
  });
});

describe('extrato: fixo no cartão aparece no dia da cobrança', () => {
  it('lista o fixo no cartão com a fatura dele, e segue a versão (troca de Pix pro cartão vale de dezembro)', () => {
    const D = editar(base(), 'net', { cartaoId: 'lar', meio: 'credito' });
    const nov = fixosNoCartao(D, '2026-11-01', '2026-11-30').map((x) => `${x.r.desc} ${x.data} → ${x.venc}`).sort();
    expect(nov).toEqual(['Academia 2026-11-12 → 2026-12-07', 'Streaming 2026-11-03 → 2026-11-15']);
    const dez = fixosNoCartao(D, '2026-12-01', '2026-12-31').map((x) => `${x.r.desc} ${x.data} → ${x.venc}`).sort();
    expect(dez).toEqual(['Academia 2026-12-12 → 2027-01-07', 'Internet 2026-12-12 → 2027-01-07', 'Streaming 2026-12-03 → 2026-12-15']);
  });
});
