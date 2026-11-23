/**
 * Importação de fatura de cartão e extrato bancário (OPCIONAL — o app funciona 100% sem isso).
 * Formatos: CSV (Nubank e similares), OFX (padrão de extrato) e texto extraído de PDF.
 * Tudo roda no aparelho.
 */
import { catE } from './categories';
import { addDays, addMonths, dateOf, monthKey, parse, pad } from './dates';
import { eventosEntre, pagamentoCartao } from './engine';
import { uid } from './money';
import { normalizar, sugerir } from './smart';
import { ativaEm } from './versions';
import type { Cartao, Data, ISODate, Lancamento } from './types';

export type TipoImport = 'fatura' | 'extrato';

/** Linha lida do arquivo. `valor` em centavos: > 0 = saída (gasto), < 0 = entrada/estorno. */
export interface Linha { data: ISODate; desc: string; valor: number; parcela?: { i: number; n: number } }

// ---------------- leitura de valores e datas ----------------
export function lerValor(s: string): number | null {
  let t = s.replace(/R\$|\s| /g, '').trim();
  if (!t) return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  if (t.startsWith('-') || t.startsWith('−')) { neg = true; t = t.slice(1); }
  if (t.endsWith('-')) { neg = true; t = t.slice(0, -1); }
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); // 1.234,56
  else t = t.replace(/,/g, ''); // 1,234.56
  const n = Number(t);
  if (!isFinite(n)) return null;
  return Math.round((neg ? -n : n) * 100);
}

export function lerData(s: string, anoRef?: number): ISODate | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{4})(\d{2})(\d{2})/); // OFX 20261123...
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : anoRef;
    if (!y) return null;
    return `${y}-${pad(+m[2])}-${pad(+m[1])}`;
  }
  const MES: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  m = normalizar(t).match(/^(\d{1,2}) (jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?: (\d{4}))?$/);
  if (m && (m[3] || anoRef)) return `${m[3] ?? anoRef}-${pad(MES[m[2]])}-${pad(+m[1])}`;
  return null;
}

/** "PARC 03/10", "Parcela 3 de 10", "3/10" no fim da descrição. Retorna a descrição limpa. */
export function detectarParcela(desc: string): { desc: string; parcela?: { i: number; n: number } } {
  const re = [/\s*-?\s*parc(?:ela)?\.?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i, /\s+(\d{1,2})\s*\/\s*(\d{1,2})\s*$/];
  for (const r of re) {
    const m = desc.match(r);
    if (m) {
      const i = +m[1], n = +m[2];
      if (n >= 2 && n <= 48 && i >= 1 && i <= n) return { desc: desc.replace(r, '').trim(), parcela: { i, n } };
    }
  }
  return { desc };
}

// ---------------- formatos ----------------
function separar(linha: string, sep: string) {
  const out: string[] = []; let cur = ''; let q = false;
  for (const ch of linha) {
    if (ch === '"') q = !q;
    else if (ch === sep && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** CSV com cabeçalho (data / descrição / valor), separador , ou ; */
export function lerCSV(texto: string): Linha[] {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length < 2) return [];
  const sep = (linhas[0].match(/;/g)?.length ?? 0) > (linhas[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const cab = separar(linhas[0], sep).map(normalizar);
  const idx = (...nomes: string[]) => cab.findIndex((c) => nomes.some((n) => c === n || c.startsWith(n)));
  const iData = idx('data', 'date', 'dt');
  const iDesc = idx('descricao', 'title', 'titulo', 'historico', 'estabelecimento', 'lancamento', 'description', 'memo', 'nome');
  const iValor = idx('valor', 'amount', 'value', 'quantia');
  if (iData < 0 || iValor < 0) return [];
  const out: Linha[] = [];
  for (const l of linhas.slice(1)) {
    const c = separar(l, sep);
    const data = lerData(c[iData] ?? '');
    const valor = lerValor(c[iValor] ?? '');
    if (!data || valor == null) continue;
    const p = detectarParcela(c[iDesc] ?? '');
    out.push({ data, desc: p.desc || 'Sem descrição', valor, parcela: p.parcela });
  }
  return out;
}

/** OFX (SGML ou XML): blocos <STMTTRN> com DTPOSTED, TRNAMT, MEMO/NAME. */
export function lerOFX(texto: string): Linha[] {
  const out: Linha[] = [];
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  const tag = (b: string, t: string) => b.match(new RegExp(`<${t}>([^<\\r\\n]*)`, 'i'))?.[1]?.trim() ?? '';
  for (const b of blocos) {
    const data = lerData(tag(b, 'DTPOSTED'));
    const v = Number(tag(b, 'TRNAMT').replace(',', '.'));
    if (!data || !isFinite(v)) continue;
    const p = detectarParcela(tag(b, 'MEMO') || tag(b, 'NAME'));
    // OFX: negativo = débito. Convertemos pra convenção interna (positivo = saída).
    out.push({ data, desc: p.desc || 'Sem descrição', valor: -Math.round(v * 100), parcela: p.parcela });
  }
  return out;
}

/** O que a própria fatura informa (quando é PDF de banco). */
export interface MetaFatura {
  banco?: string;
  vencimento?: ISODate;
  fechamento?: ISODate;
  proxFechamento?: ISODate;
  /** Soma das compras/despesas do período, como o banco imprime. */
  totalCompras?: number;
  totalFatura?: number;
  /** Parcelas já agendadas: na próxima fatura e no total das próximas. */
  proximaFatura?: number;
  totalProximas?: number;
}

const DATA_CHEIA = '(\\d{2}\\/\\d{2}\\/\\d{4})';
const DINHEIRO = '(-?\\s?[\\d.]+,\\d{2})';
const achar = (t: string, re: RegExp) => t.match(re)?.[1];
const dataBR = (s?: string) => (s ? lerData(s) ?? undefined : undefined);

export function lerMeta(texto: string): MetaFatura {
  const t = texto.replace(/\s+/g, ' ');
  const v = (re: RegExp) => { const x = achar(t, re); return x ? lerValor(x) ?? undefined : undefined; };
  const banco = /picpay/i.test(t) ? 'PicPay' : /ita[uú]/i.test(t) ? 'Itaú' : /nubank|nu pagamentos/i.test(t) ? 'Nubank' : /banco inter\b/i.test(t) ? 'Inter' : /bradesco/i.test(t) ? 'Bradesco' : /santander/i.test(t) ? 'Santander' : /caixa econ/i.test(t) ? 'Caixa' : /mercado ?pago/i.test(t) ? 'Mercado Pago' : /\bC6\b/.test(t) ? 'C6' : undefined;
  return {
    banco,
    vencimento: dataBR(achar(t, new RegExp(`vencimento:?\\s*(?:em\\s*)?${DATA_CHEIA}`, 'i'))),
    // "Fechamento: 09/11/2026" — mas não "Previsão próx. Fechamento" (esse é o próximo)
    fechamento: dataBR([...t.matchAll(new RegExp(`(.{0,8})fechamento(?: da fatura)?:?\\s*${DATA_CHEIA}`, 'gi'))].find((m) => !/pr[óo]x/i.test(m[1]))?.[2] ?? achar(t, new RegExp(`(?:postagem|emiss[ãa]o|data do corte|corte):?\\s*${DATA_CHEIA}`, 'i'))),
    proxFechamento: dataBR(achar(t, new RegExp(`pr[óo]x(?:imo|\\.)?\\s*fechamento:?\\s*${DATA_CHEIA}`, 'i'))),
    totalCompras: v(new RegExp(`(?:lan[çc]amentos atuais|total geral dos lan[çc]amentos|despesas do m[êe]s)\\s*${DINHEIRO}`, 'i')),
    totalFatura: v(new RegExp(`total (?:desta|da) fatura(?! anterior)\\s*(?:R\\$)?\\s*${DINHEIRO}`, 'i')),
    proximaFatura: v(new RegExp(`pr[óo]xima fatura\\s*(?:R\\$)?\\s*${DINHEIRO}`, 'i')),
    totalProximas: v(new RegExp(`total (?:para )?pr[óo]ximas faturas\\s*(?:R\\$)?\\s*${DINHEIRO}`, 'i')),
  };
}

const LINHA_PDF = /^(\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?|\d{1,2} (?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*)\s+(?:(.*?)\s+)?(-?\s?R?\$?\s?-?[\d.]+,\d{2}-?)(?=\s|$)/i;
/** Seções que listam o FUTURO (parcelas das próximas faturas): o app já projeta isso sozinho. */
const SECAO_FUTURA = /compras parceladas\s*-?\s*pr[óo]ximas faturas|parcelas futuras|lan[çc]amentos futuros/i;
const SECAO_ATUAL = /lan[çc]amentos:? compras|transa[çc][õo]es (nacionais|internacionais)|lan[çc]amentos nacionais|lan[çc]amentos internacionais/i;

function limparDesc(d: string) {
  return d.replace(/^FIN\s+/i, '').replace(/\s+\.$/, '').replace(/\s{2,}/g, ' ').trim();
}

/** Texto de PDF de fatura/extrato: "dd/mm descrição valor" (até 2 por linha, em faturas de duas colunas). */
export function lerTextoPDF(texto: string, ref: ISODate, faturaDeBanco = false): Linha[] {
  const out: Linha[] = [];
  const r = parse(ref);
  let futura = false;
  let anterior = '';
  for (const bruta of texto.split(/\r?\n/)) {
    let l = bruta.replace(/\s+/g, ' ').trim();
    if (SECAO_FUTURA.test(l)) futura = true;
    else if (SECAO_ATUAL.test(l)) futura = false;
    let achou = false;
    while (!futura && l) {
      const m = l.match(LINHA_PDF);
      if (!m) break;
      achou = true;
      l = l.slice(m[0].length).trim();
      let desc = limparDesc(m[2] ?? '');
      // descrição que quebrou pra linha de cima ("FIN MARINKOVIC COQUETELARI" / "18/09 . 313,01")
      if (!desc || desc === '.') desc = limparDesc(anterior);
      const valor = lerValor(m[3]);
      let data = lerData(m[1].replace(/(\d+ \w{3})\w*/, '$1'), r.getFullYear());
      if (!data || valor == null || !desc) continue;
      const temAno = /^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/.test(m[1]);
      if (temAno && faturaDeBanco) continue; // em fatura, lançamento é "dd/mm"; data com ano é cabeçalho/boleto
      if (!temAno && data > addDays(ref, 5)) data = `${+data.slice(0, 4) - 1}${data.slice(4)}`; // compra de dez numa fatura de jan
      const p = detectarParcela(desc);
      out.push({ data, desc: p.desc || desc, valor, parcela: p.parcela });
      if (!/^\d{1,2}[/.]\d{1,2}\s/.test(l)) break; // o resto da linha não é outro lançamento
    }
    if (!achou) anterior = l;
  }
  return out;
}

/**
 * A mesma compra aparecendo como 1/2 e 2/2 no mesmo arquivo: a de número maior é da lista
 * "próximas faturas" (às vezes em outra coluna/página). Fica a menor.
 */
export function semParcelaFutura(linhas: Linha[]): Linha[] {
  const chave = (l: Linha) => `${l.data}|${normalizar(l.desc)}|${l.parcela!.n}|${Math.abs(l.valor)}`;
  const menor = new Map<string, number>();
  for (const l of linhas) if (l.parcela) menor.set(chave(l), Math.min(menor.get(chave(l)) ?? 99, l.parcela.i));
  return linhas.filter((l) => !l.parcela || l.parcela.i === menor.get(chave(l)));
}

export function lerArquivo(nome: string, texto: string, hoje: ISODate): { linhas: Linha[]; meta: MetaFatura } {
  const n = nome.toLowerCase();
  if (n.endsWith('.ofx') || /<OFX>/i.test(texto)) return { linhas: lerOFX(texto), meta: {} };
  if (n.endsWith('.csv')) return { linhas: lerCSV(texto), meta: {} };
  const csv = lerCSV(texto);
  if (csv.length) return { linhas: csv, meta: {} };
  const meta = lerMeta(texto);
  // o ano das compras "dd/mm" sai do fechamento da própria fatura (não de hoje)
  const linhas = lerTextoPDF(texto, meta.fechamento ?? meta.vencimento ?? hoje, !!meta.vencimento);
  return { linhas: semParcelaFutura(linhas), meta };
}

// ---------------- revisão ----------------
export type Motivo = 'duplicado' | 'parcela' | 'fixo' | 'pagamento' | 'entrada';
export interface Item extends Linha { id: string; cat: string; ico: string; incluir: boolean; motivo?: Motivo }

const PAGAMENTO = /pagamento (de )?fatura|pagamento recebido|pagamento via|pagamento em conta|pgto fatura|pag fatura|pagto fatura|pagamento efetuado|credito de pagamento|pagamento debito automatico/;

export function preparar(D: Data, linhas: Linha[], tipo: TipoImport, cartao?: Cartao): Item[] {
  // fatura: o sinal predominante é o de compra (alguns bancos exportam compras negativas)
  const sinal = tipo === 'fatura' && linhas.filter((l) => l.valor < 0).length > linhas.length / 2 ? -1 : 1;
  const mk = monthKey(linhas[0]?.data ?? dateOf(2000, 0, 1));
  return linhas.map((l0) => {
    const l = { ...l0, valor: l0.valor * sinal };
    const ehSaida = l.valor > 0;
    let sug = sugerir(l.desc, ehSaida ? 'saida' : 'entrada', D.aprendido);
    // compra parcelada é um bem/serviço comprado, não conta mensal nem assinatura
    if (l.parcela && (!sug || sug.cat === 'contas' || sug.cat === 'assinaturas')) sug = { cat: 'compras', ico: sug?.ico ?? catE('compras') } as typeof sug;
    const it: Item = { ...l, id: uid(), cat: sug?.cat ?? (ehSaida ? 'outros' : 'outros_in'), ico: sug?.ico || catE(sug?.cat ?? 'outros'), incluir: true };
    const n = normalizar(l.desc);
    if (PAGAMENTO.test(n)) return { ...it, cat: 'fatura', ico: '💳', incluir: false, motivo: 'pagamento' };
    if (tipo === 'fatura' && !ehSaida) return { ...it, motivo: 'entrada' }; // estorno: entra como crédito na fatura
    // parcela de uma compra já importada antes (fatura do mês passado traz a mesma compra como 2/10, 3/10…)
    if (l.parcela && cartao) {
      const mesma = D.lancamentos.some((x) => x.cartaoId === cartao.id && x.parcelas === l.parcela!.n && Math.abs(Math.round(x.valor / x.parcelas!) - Math.abs(l.valor)) <= 2 * x.parcelas! && (x.data === l.data || normalizar(x.desc) === normalizar(l.desc)));
      if (mesma) return { ...it, incluir: false, motivo: 'parcela' };
    }
    // duplicado: mesmo valor, ±3 dias, mesmo meio
    const dup = D.lancamentos.some((x) => {
      if ((tipo === 'fatura') !== !!x.cartaoId || (cartao && x.cartaoId && x.cartaoId !== cartao.id)) return false;
      const v = x.parcelas && x.parcelas > 1 ? Math.round(x.valor / x.parcelas) : x.valor;
      const dd = Math.abs(parse(x.data).getTime() - parse(l.data).getTime()) / 86400000;
      return (v === Math.abs(l.valor) || x.valor === Math.abs(l.valor)) && dd <= 3 && x.cat !== 'fatura';
    });
    if (dup) return { ...it, incluir: false, motivo: 'duplicado' };
    // extrato: o que já é fixo (mesmo valor ±1%, dia ±3) não entra de novo
    const fixo = D.recorrentes.some((r) => ativaEm(r, mk) && Math.abs(r.valor - Math.abs(l.valor)) <= r.valor * 0.01 && Math.abs(r.dia - parse(l.data).getDate()) <= 3 && (tipo === 'extrato' ? !r.cartaoId : r.cartaoId === cartao?.id));
    if (fixo) return { ...it, incluir: false, motivo: 'fixo' };
    return it;
  });
}

/**
 * Converte os itens aprovados em lançamentos.
 * Com o vencimento da fatura (`venc`, lido do PDF): tudo fica preso a ESSA fatura, e a parcela i/n
 * vira a compra inteira de n vezes cuja 1ª parcela caiu i−1 meses antes — as restantes caem nas seguintes.
 * Sem vencimento (CSV/OFX): usa a data e a regra de fechamento do cartão.
 */
export function paraLancamentos(itens: Item[], tipo: TipoImport, cartao?: Cartao, venc?: ISODate): Lancamento[] {
  const agora = Date.now();
  return itens.filter((i) => i.incluir).map((i) => {
    const saida = i.valor > 0;
    const base: Lancamento = { id: uid(), tipo: saida ? 'saida' : 'entrada', valor: Math.abs(i.valor), cat: i.cat, ico: i.ico !== catE(i.cat) ? i.ico : undefined, desc: i.desc, data: i.data, criado: agora };
    if (tipo !== 'fatura' || !cartao) return { ...base, meio: 'pix' };
    base.cartaoId = cartao.id; base.meio = 'credito';
    if (i.parcela) {
      base.parcelas = i.parcela.n;
      base.valor = Math.abs(i.valor) * i.parcela.n;
    }
    if (venc) {
      const v = parse(venc);
      base.fatura = dateOf(v.getFullYear(), v.getMonth() - ((i.parcela?.i ?? 1) - 1), cartao.vencimento);
    } else if (i.parcela) {
      const d = parse(i.data);
      base.data = dateOf(d.getFullYear(), d.getMonth() - (i.parcela.i - 1), d.getDate());
    }
    return base;
  });
}

export interface Reajuste { venc: ISODate; antes: number; depois: number }

/**
 * Encaixa a importação no que já existia:
 * - a fatura importada substitui o valor informado à mão nela (ajuste);
 * - nas faturas SEGUINTES, o valor informado à mão já incluía as parcelas que agora vêm da importação:
 *   o ajuste é reduzido por elas, pra não contar em dobro (o total que você informou continua valendo).
 */
export function encaixar(D: Data, novos: Lancamento[], cartao: Cartao, venc: ISODate): { lancamentos: Lancamento[]; reajustes: Reajuste[] } {
  const ehAjuste = (l: Lancamento) => l.cartaoId === cartao.id && l.cat === 'fatura' && l.desc.startsWith('Ajuste fatura');
  const vencDe = (l: Lancamento) => l.fatura ?? pagamentoCartao(cartao, l.data);
  // quanto a importação põe em cada fatura futura
  const porVenc = new Map<ISODate, number>();
  for (const e of eventosEntre({ ...D, lancamentos: novos, recorrentes: [] }, addDays(venc, 1), addDays(venc, 31 * 50)))
    if (e.venc && e.venc > venc) porVenc.set(e.venc, (porVenc.get(e.venc) ?? 0) - e.valor);
  const reajustes: Reajuste[] = [];
  const lancamentos: Lancamento[] = [];
  for (const l of D.lancamentos) {
    if (!ehAjuste(l)) { lancamentos.push(l); continue; }
    const v = vencDe(l);
    if (v === venc) continue; // fatura importada: o PDF manda
    const add = porVenc.get(v) ?? 0;
    if (v < venc || !add) { lancamentos.push(l); continue; }
    const antes = l.tipo === 'saida' ? l.valor : -l.valor;
    const depois = antes - add;
    porVenc.set(v, 0); // um ajuste por fatura absorve
    reajustes.push({ venc: v, antes, depois });
    if (depois) lancamentos.push({ ...l, tipo: depois > 0 ? 'saida' : 'entrada', valor: Math.abs(depois), fatura: v });
  }
  return { lancamentos: [...lancamentos, ...novos], reajustes };
}

// ---------------- análise ----------------
export interface Analise {
  total: number;
  porCategoria: { cat: string; valor: number; pct: number }[];
  maiores: Item[];
  parcelados: { item: Item; faltam: number; valorMes: number; ultima: ISODate }[];
  /** Compromisso já assumido nos próximos meses (parcelas que continuam). */
  proximosMeses: { mes: string; valor: number }[];
  assinaturas: Item[];
  avista: number;
  /** Estornos/créditos (abatem a fatura). */
  creditos: number;
  /** Soma das parcelas que ainda vão cair. */
  restante: number;
  /** Sugestão de gasto típico (total da fatura, arredondado). */
  tipicoSugerido: number;
  /** Conferências com o que o próprio banco imprimiu. */
  conferencia?: { banco: number; lido: number };
  confProxima?: { banco: number; calc: number };
  confRestante?: { banco: number; calc: number };
}

export function analisar(itens: Item[], ref: ISODate, cartao?: Cartao, meta: MetaFatura = {}): Analise {
  const ok = itens.filter((i) => i.motivo !== 'pagamento' && i.valor > 0);
  const total = ok.reduce((a, i) => a + i.valor, 0);
  const cats = new Map<string, number>();
  ok.forEach((i) => cats.set(i.cat, (cats.get(i.cat) ?? 0) + i.valor));
  const porCategoria = [...cats.entries()].map(([cat, valor]) => ({ cat, valor, pct: total ? valor / total : 0 })).sort((a, b) => b.valor - a.valor);
  const parcelados = ok.filter((i) => i.parcela && i.parcela.i < i.parcela.n).map((i) => {
    const faltam = i.parcela!.n - i.parcela!.i;
    const d = parse(meta.vencimento ?? i.data);
    const ultimaCompra = dateOf(d.getFullYear(), d.getMonth() + faltam, d.getDate());
    return { item: i, faltam, valorMes: i.valor, ultima: meta.vencimento || !cartao ? ultimaCompra : pagamentoCartao(cartao, ultimaCompra) };
  });
  const mk0 = monthKey(meta.vencimento ?? ref);
  const proximosMeses = Array.from({ length: 6 }, (_, k) => {
    const mes = addMonths(mk0, k + 1);
    const valor = parcelados.filter((p) => p.faltam > k).reduce((a, p) => a + p.valorMes, 0);
    return { mes, valor };
  });
  const assinaturas = ok.filter((i) => i.cat === 'assinaturas');
  const avista = ok.filter((i) => !i.parcela).reduce((a, i) => a + i.valor, 0);
  const creditos = -itens.filter((i) => i.valor < 0 && i.motivo !== 'pagamento').reduce((a, i) => a + i.valor, 0);
  const restante = parcelados.reduce((a, p) => a + p.faltam * p.valorMes, 0);
  return {
    total, porCategoria, maiores: [...ok].sort((a, b) => b.valor - a.valor).slice(0, 5), parcelados, proximosMeses, assinaturas, avista, creditos, restante,
    tipicoSugerido: Math.round(total / 1000) * 1000,
    conferencia: meta.totalCompras != null ? { banco: meta.totalCompras, lido: total } : undefined,
    confProxima: meta.proximaFatura != null ? { banco: meta.proximaFatura, calc: proximosMeses[0]?.valor ?? 0 } : undefined,
    confRestante: meta.totalProximas != null ? { banco: meta.totalProximas, calc: restante } : undefined,
  };
}
