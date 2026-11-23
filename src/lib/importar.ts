/**
 * Importação de fatura de cartão e extrato bancário (OPCIONAL — o app funciona 100% sem isso).
 * Formatos: CSV (Nubank e similares), OFX (padrão de extrato) e texto extraído de PDF.
 * Tudo roda no aparelho.
 */
import { catE } from './categories';
import { addDays, addMonths, dateOf, monthKey, parse, pad } from './dates';
import { pagamentoCartao } from './engine';
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

/** Texto de PDF de fatura/extrato: linhas "dd/mm[/aa] descrição valor". Ano inferido pela data de referência. */
export function lerTextoPDF(texto: string, ref: ISODate): Linha[] {
  const out: Linha[] = [];
  const r = parse(ref);
  for (const bruta of texto.split(/\r?\n/)) {
    const l = bruta.replace(/\s+/g, ' ').trim();
    const m = l.match(/^(\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?|\d{1,2} (?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*)\s+(.+?)\s+(-?\s?R?\$?\s?-?[\d.]+,\d{2}-?)$/i);
    if (!m) continue;
    let data = lerData(m[1].replace(/(\d+ \w{3})\w*/, '$1'), r.getFullYear());
    const valor = lerValor(m[3]);
    if (!data || valor == null) continue;
    const temAno = /^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/.test(m[1]);
    if (!temAno && data > addDays(ref, 31)) data = `${+data.slice(0, 4) - 1}${data.slice(4)}`; // dez de ano anterior
    const p = detectarParcela(m[2]);
    out.push({ data, desc: p.desc, valor, parcela: p.parcela });
  }
  return out;
}

export function lerArquivo(nome: string, texto: string, ref: ISODate): Linha[] {
  const n = nome.toLowerCase();
  if (n.endsWith('.ofx') || /<OFX>/i.test(texto)) return lerOFX(texto);
  if (n.endsWith('.csv')) return lerCSV(texto);
  const csv = lerCSV(texto);
  return csv.length ? csv : lerTextoPDF(texto, ref);
}

// ---------------- revisão ----------------
export type Motivo = 'duplicado' | 'fixo' | 'pagamento' | 'entrada';
export interface Item extends Linha { id: string; cat: string; ico: string; incluir: boolean; motivo?: Motivo }

const PAGAMENTO = /pagamento (de )?fatura|pagamento recebido|pgto fatura|pag fatura|pagto fatura|pagamento efetuado|credito de pagamento/;

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

/** Converte os itens aprovados em lançamentos. Parcela 3/10 vira a compra inteira, posicionada pra 3ª cair nesta fatura. */
export function paraLancamentos(itens: Item[], tipo: TipoImport, cartao?: Cartao): Lancamento[] {
  const agora = Date.now();
  return itens.filter((i) => i.incluir).map((i) => {
    const saida = i.valor > 0;
    const base: Lancamento = { id: uid(), tipo: saida ? 'saida' : 'entrada', valor: Math.abs(i.valor), cat: i.cat, ico: i.ico !== catE(i.cat) ? i.ico : undefined, desc: i.desc, data: i.data, criado: agora };
    if (tipo === 'fatura' && cartao) {
      base.cartaoId = cartao.id; base.meio = 'credito';
      if (i.parcela) {
        const d = parse(i.data);
        base.data = dateOf(d.getFullYear(), d.getMonth() - (i.parcela.i - 1), d.getDate());
        base.parcelas = i.parcela.n;
        base.valor = Math.abs(i.valor) * i.parcela.n;
      }
    } else base.meio = 'pix';
    return base;
  });
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
  /** Sugestão de gasto típico pra este cartão (à vista + parcelas desta fatura). */
  tipicoSugerido: number;
}

export function analisar(itens: Item[], ref: ISODate, cartao?: Cartao): Analise {
  const ok = itens.filter((i) => i.incluir || i.motivo === 'duplicado' || i.motivo === 'fixo').filter((i) => i.valor > 0 && i.motivo !== 'pagamento');
  const total = ok.reduce((a, i) => a + i.valor, 0);
  const cats = new Map<string, number>();
  ok.forEach((i) => cats.set(i.cat, (cats.get(i.cat) ?? 0) + i.valor));
  const porCategoria = [...cats.entries()].map(([cat, valor]) => ({ cat, valor, pct: total ? valor / total : 0 })).sort((a, b) => b.valor - a.valor);
  const parcelados = ok.filter((i) => i.parcela && i.parcela.i < i.parcela.n).map((i) => {
    const faltam = i.parcela!.n - i.parcela!.i;
    const d = parse(i.data);
    const ultimaCompra = dateOf(d.getFullYear(), d.getMonth() + faltam, d.getDate());
    return { item: i, faltam, valorMes: i.valor, ultima: cartao ? pagamentoCartao(cartao, ultimaCompra) : ultimaCompra };
  });
  const mk0 = monthKey(ref);
  const proximosMeses = Array.from({ length: 6 }, (_, k) => {
    const mes = addMonths(mk0, k + 1);
    const valor = parcelados.filter((p) => p.faltam > k).reduce((a, p) => a + p.valorMes, 0);
    return { mes, valor };
  });
  const assinaturas = ok.filter((i) => i.cat === 'assinaturas');
  const avista = ok.filter((i) => !i.parcela).reduce((a, i) => a + i.valor, 0);
  return { total, porCategoria, maiores: [...ok].sort((a, b) => b.valor - a.valor).slice(0, 5), parcelados, proximosMeses, assinaturas, avista, tipicoSugerido: Math.round(total / 1000) * 1000 };
}
