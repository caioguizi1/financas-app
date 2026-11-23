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

// ---- faturas em PDF (formato real dos bancos, dados fictícios) ----
import { linhasDosItens } from './pdfTexto';
import { encaixar, lerArquivo, lerMeta } from './importar';
import { faturasAtuais } from './faturas';

const ITAU = `Banco Itaú S.A.
Total da fatura anterior 1.000,00
L Lançamentos atuais 1.211,00
Postagem: 31/10/2026
Vencimento: 07/11/2026 = Total desta fatura 1.211,00
Previsão próx. Fechamento: 30/11/2026
07/11/2026 R$ 16.824,00
30/09 Pagamento via conta -1.000,00
21/01 LOJA XPTO 10/12 100,00
03/10 PADARIA BOA 11,00
19/10 CLINICA ABC 01/02 100,00
Próxima fatura 300,00
Total para próximas faturas 400,00
19/10 CLINICA ABC 02/02 100,00
Compras parceladas - próximas faturas
21/01 LOJA XPTO 11/12 100,00
19/10 CLINICA ABC 02/02 100,00`;

const PICPAY = `PicPay Mastercard BLACK
Vencimento: 15/11/2026 | Fechamento: 09/11/2026
Despesas do mês 238,00
Total da fatura R$ 200,00
25/09 IOF DIARIO PARCELADO 0,30 30/09 FIN LOJA YZPARC02/04 111,52
FIN BAR LONGO NOME
18/09 . 25,00
15/10 PAGAMENTO DE FATURA -4.267,44
15/10 CREDITO PULA COMPRA -38,00
13/03 SEGURADORA XPARC08/12 101,18
Total próximas faturas R$ 5.290,06`;

describe('fatura em PDF', () => {
  it('lê vencimento, fechamento real (não o previsto) e totais', () => {
    expect(lerMeta(ITAU)).toMatchObject({ banco: 'Itaú', vencimento: '2026-11-07', fechamento: '2026-10-31', proxFechamento: '2026-11-30', totalCompras: 121100, proximaFatura: 30000, totalProximas: 40000 });
    expect(lerMeta(PICPAY)).toMatchObject({ banco: 'PicPay', vencimento: '2026-11-15', fechamento: '2026-11-09', totalCompras: 23800, totalFatura: 20000 });
  });
  it('Itaú: ignora cabeçalho, pagamento entra marcado, lista de próximas faturas não entra', () => {
    const { linhas } = lerArquivo('f.pdf', ITAU, '2026-11-23');
    expect(linhas.map((l) => [l.data, l.desc, l.valor, l.parcela ? `${l.parcela.i}/${l.parcela.n}` : ''])).toEqual([
      ['2026-09-30', 'Pagamento via conta', -100000, ''], ['2026-01-21', 'LOJA XPTO', 10000, '10/12'], ['2026-10-03', 'PADARIA BOA', 1100, ''], ['2026-10-19', 'CLINICA ABC', 10000, '1/2'],
    ]);
  });
  it('PicPay: duas colunas, "PARC02/04" colado, prefixo FIN e descrição quebrada', () => {
    const { linhas } = lerArquivo('f.pdf', PICPAY, '2026-11-23');
    expect(linhas.map((l) => [l.desc, l.valor, l.parcela?.n ?? 0])).toEqual([
      ['IOF DIARIO PARCELADO', 30, 0], ['LOJA YZ', 11152, 4], ['BAR LONGO NOME', 2500, 0], ['PAGAMENTO DE FATURA', -426744, 0], ['CREDITO PULA COMPRA', -3800, 0], ['SEGURADORA X', 10118, 12],
    ]);
  });
  it('separa colunas pela posição (data longe do texto anterior = outra coluna)', () => {
    const it = (str: string, x: number, w = 30) => ({ str, x, y: 100, w });
    expect(linhasDosItens([it('18/09', 10), it('BAR', 45), it('74,14', 150), it('31/10', 300), it('PAGAMENTO', 335), it('-50,00', 450), it('Lan', 10, 12), it('ç', 22, 5), it('amentos', 27)].map((x, i) => (i > 5 ? { ...x, y: 80 } : x))))
      .toEqual(['18/09 BAR 74,14', '31/10 PAGAMENTO -50,00', 'Lançamentos']);
  });
  it('âncora no vencimento: a 10/12 da fatura de 07/11 deixa 11/12 em 07/12 e 12/12 em 07/01 — sem mexer no saldo de hoje', () => {
    const { linhas, meta } = lerArquivo('f.pdf', ITAU, '2026-11-23');
    const its = preparar(D(), linhas, 'fatura', itau);
    const ls = paraLancamentos(its, 'fatura', itau, meta.vencimento);
    const xpto = ls.find((l) => l.desc === 'LOJA XPTO')!;
    expect([xpto.data, xpto.fatura, xpto.parcelas, xpto.valor]).toEqual(['2026-01-21', '2026-02-07', 12, 120000]);
    const evs = eventosEntre(D({ lancamentos: ls }), '2026-11-01', '2027-03-01').filter((e) => e.ref === xpto.id);
    expect(evs.map((e) => [e.data, e.desc])).toEqual([['2026-11-07', 'LOJA XPTO 10/12'], ['2026-12-07', 'LOJA XPTO 11/12'], ['2027-01-07', 'LOJA XPTO 12/12']]);
    // a fatura aberta (07/12) já tem as parcelas que continuam: 100 (XPTO) + 100 (clínica 2/2)
    expect(faturasAtuais(D({ lancamentos: ls }), itau, '2026-11-23').map((f) => [f.vencimento, f.total])).toEqual([['2026-12-07', 20000]]);
  });
  it('valor digitado à mão na fatura seguinte é descontado das parcelas importadas (não conta em dobro)', () => {
    const manual = { id: 'aj', tipo: 'saida' as const, valor: 500000, cat: 'fatura', ico: '💳', desc: 'Ajuste fatura Itaú', data: '2026-11-29', cartaoId: 'it', fatura: '2026-12-07', criado: 1 };
    const { linhas, meta } = lerArquivo('f.pdf', ITAU, '2026-11-23');
    const base = D({ lancamentos: [manual] });
    const novos = paraLancamentos(preparar(base, linhas, 'fatura', itau), 'fatura', itau, meta.vencimento);
    const r = encaixar(base, novos, itau, meta.vencimento!);
    expect(r.reajustes).toEqual([{ venc: '2026-12-07', antes: 500000, depois: 480000 }]);
    expect(faturasAtuais({ ...base, lancamentos: r.lancamentos }, itau, '2026-11-23')[0].total).toBe(500000); // o total informado continua valendo
  });
  it('importar a fatura do mês seguinte não duplica a compra parcelada', () => {
    const { linhas, meta } = lerArquivo('f.pdf', ITAU, '2026-11-23');
    const ls = paraLancamentos(preparar(D(), linhas, 'fatura', itau), 'fatura', itau, meta.vencimento);
    const prox = preparar(D({ lancamentos: ls }), [{ data: '2026-01-21', desc: 'LOJA XPTO', valor: 10000, parcela: { i: 11, n: 12 } }], 'fatura', itau);
    expect([prox[0].incluir, prox[0].motivo]).toEqual([false, 'parcela']);
  });
});
