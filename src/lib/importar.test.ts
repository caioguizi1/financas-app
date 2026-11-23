import { describe, expect, it } from 'vitest';
import { eventosEntre } from './engine';
import { analisar, detectarParcela, lerCSV, lerData, lerOFX, lerTextoPDF, lerValor, paraLancamentos, preparar } from './importar';
import type { Data } from './types';

const itau = { id: 'it', nome: 'Itaú', fechamento: 30, vencimento: 7 };
const D = (over: Partial<Data> = {}): Data => ({ v: 1, onboarded: true, perfil: { nome: '' }, saldo: { valor: 0, data: '2026-11-23', ts: 1 }, recorrentes: [], cartoes: [itau], lancamentos: [], uso: {}, ...over });

describe('leitura de valores e datas', () => {
  it('formatos brasileiros e internacionais', () => {
    expect(lerValor('R$ 1.234,56')).toBe(123456);
    expect(lerValor('-12,30')).toBe(-1230);
    expect(lerValor('1234.56')).toBe(123456);
    expect(lerValor('(50,00)')).toBe(-5000);
    expect(lerValor('89,90-')).toBe(-8990);
  });
  it('datas', () => {
    expect(lerData('23/11/2026')).toBe('2026-11-23');
    expect(lerData('2026-11-23')).toBe('2026-11-23');
    expect(lerData('20261123120000[-3:BRT]')).toBe('2026-11-23');
    expect(lerData('05/11', 2026)).toBe('2026-11-05');
    expect(lerData('5 nov', 2026)).toBe('2026-11-05');
  });
  it('parcelas', () => {
    expect(detectarParcela('MAGALU PARC 03/10')).toEqual({ desc: 'MAGALU', parcela: { i: 3, n: 10 } });
    expect(detectarParcela('Celular - Parcela 2 de 12')).toEqual({ desc: 'Celular', parcela: { i: 2, n: 12 } });
    expect(detectarParcela('Amazon 1/3')).toEqual({ desc: 'Amazon', parcela: { i: 1, n: 3 } });
    expect(detectarParcela('Uber 23/11').parcela).toBeUndefined(); // parece data, não parcela
  });
});

describe('formatos', () => {
  it('CSV estilo Nubank (date,title,amount)', () => {
    const l = lerCSV('date,title,amount\n2026-11-02,iFood,45.90\n2026-11-03,Magalu - Parcela 3/10,120.00\n2026-11-05,Pagamento recebido,-800.00');
    expect(l).toEqual([
      { data: '2026-11-02', desc: 'iFood', valor: 4590, parcela: undefined },
      { data: '2026-11-03', desc: 'Magalu', valor: 12000, parcela: { i: 3, n: 10 } },
      { data: '2026-11-05', desc: 'Pagamento recebido', valor: -80000, parcela: undefined },
    ]);
  });
  it('CSV com ; e cabeçalho em português', () => {
    expect(lerCSV('Data;Descrição;Valor\n10/11/2026;"Padaria, Pão";R$ 12,50')).toEqual([{ data: '2026-11-10', desc: 'Padaria, Pão', valor: 1250, parcela: undefined }]);
  });
  it('OFX (débito negativo)', () => {
    const ofx = '<OFX><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261110<TRNAMT>-89.90<MEMO>NETFLIX</STMTTRN><STMTTRN><DTPOSTED>20261105<TRNAMT>5100.00<MEMO>SALARIO</STMTTRN></OFX>';
    expect(lerOFX(ofx).map((l) => [l.data, l.desc, l.valor])).toEqual([['2026-11-10', 'NETFLIX', 8990], ['2026-11-05', 'SALARIO', -510000]]);
  });
  it('texto de PDF de fatura', () => {
    const t = 'FATURA ITAÚ\n02/11 IFOOD *RESTAURANTE 45,90\n15/10 MAGALU PARC 03/10 R$ 120,00\nTotal da fatura 165,90\n28/12 HOTEL 300,00';
    const l = lerTextoPDF(t, '2026-11-23');
    expect(l.map((x) => [x.data, x.desc, x.valor, x.parcela?.n])).toEqual([
      ['2026-11-02', 'IFOOD *RESTAURANTE', 4590, undefined], ['2026-10-15', 'MAGALU', 12000, 10], ['2025-12-28', 'HOTEL', 30000, undefined],
    ]);
  });
});

describe('revisão e lançamentos', () => {
  it('categoriza, ignora pagamento da fatura e marca duplicados', () => {
    const base = D({ lancamentos: [{ id: 'x', tipo: 'saida', valor: 4590, cat: 'comida', desc: 'ifood', data: '2026-11-03', cartaoId: 'it', criado: 1 }] });
    const its = preparar(base, lerCSV('date,title,amount\n2026-11-02,iFood,45.90\n2026-11-04,Uber,22.00\n2026-11-05,Pagamento recebido,-800.00'), 'fatura', itau);
    expect(its.map((i) => [i.desc, i.cat, i.incluir, i.motivo ?? ''])).toEqual([
      ['iFood', 'comida', false, 'duplicado'], ['Uber', 'transporte', true, ''], ['Pagamento recebido', 'fatura', false, 'pagamento'],
    ]);
  });
  it('parcela 3/10 vira compra de 10x posicionada: 3ª nesta fatura e as 7 seguintes nos meses seguintes', () => {
    const its = preparar(D(), lerCSV('date,title,amount\n2026-11-03,Magalu - Parcela 3/10,120.00'), 'fatura', itau);
    const [l] = paraLancamentos(its, 'fatura', itau);
    expect([l.data, l.valor, l.parcelas, l.cartaoId]).toEqual(['2026-09-03', 120000, 10, 'it']);
    const evs = eventosEntre(D({ lancamentos: [l] }), '2026-12-01', '2027-12-31');
    expect(evs.map((e) => e.data)).toEqual(['2026-12-07', '2027-01-07', '2027-02-07', '2027-03-07', '2027-04-07', '2027-05-07', '2027-06-07', '2027-07-07']);
  });
  it('extrato: o que já é fixo não entra de novo', () => {
    const base = D({ recorrentes: [{ id: 'n', tipo: 'saida', desc: 'Netflix', cat: 'assinaturas', valor: 8990, dia: 10, inicio: '2026-01' }] });
    const its = preparar(base, lerOFX('<STMTTRN><DTPOSTED>20261110<TRNAMT>-89.90<MEMO>NETFLIX</STMTTRN>'), 'extrato');
    expect([its[0].incluir, its[0].motivo]).toEqual([false, 'fixo']);
  });
});

describe('análise (meses seguintes e padrões)', () => {
  it('compromisso futuro das parcelas, categorias e gasto típico', () => {
    const its = preparar(D(), lerCSV('date,title,amount\n2026-11-02,iFood,100.00\n2026-11-03,Magalu - Parcela 9/10,200.00\n2026-11-04,Netflix,50.00\n2026-11-05,Celular 1/3,300.00'), 'fatura', itau);
    const a = analisar(its, '2026-11-23', itau);
    expect(a.total).toBe(65000);
    expect(a.porCategoria.map((c) => c.cat)).toEqual(['compras', 'comida', 'assinaturas']); // parcelado nunca vira 'contas'
    expect(a.proximosMeses.slice(0, 3).map((m) => [m.mes, m.valor])).toEqual([['2026-12', 50000], ['2027-01', 30000], ['2027-02', 0]]);
    expect(a.assinaturas.map((i) => i.desc)).toEqual(['Netflix']);
    expect(a.tipicoSugerido).toBe(65000);
  });
});
