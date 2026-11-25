/**
 * Faturas de cartão: ciclos (fechamento → vencimento), totais e conferência com o banco.
 * Regra: compra ANTES do dia de fechamento entra na fatura do ciclo; no dia ou depois, vai pra próxima.
 */
import { addDays, dateOf, parse } from './dates';
import { eventosEntre, pagamentoCartao, pagamentoFatura } from './engine';
import { uid } from './money';
import type { Cartao, Data, Evento, ISODate, Lancamento } from './types';

export interface Fatura {
  cartao: Cartao;
  vencimento: ISODate;
  /** Dia em que a fatura fecha (compras a partir dele vão pra próxima). */
  fecha: ISODate;
  status: 'fechada' | 'aberta';
  total: number;
  itens: Evento[];
  /** Data em que sai da conta (vencimento ou pagamento antecipado/agendado). */
  pagaEm: ISODate;
  antecipada: boolean;
}

/** Data de fechamento do ciclo que vence em `venc`. */
export function fechamentoDe(c: Cartao, venc: ISODate): ISODate {
  const v = parse(venc);
  return dateOf(v.getFullYear(), v.getMonth() - (c.vencimento <= c.fechamento ? 1 : 0), c.fechamento);
}
/** Um dia de compra que cai com certeza na fatura que vence em `venc`. */
export const diaDoCiclo = (c: Cartao, venc: ISODate) => addDays(fechamentoDe(c, venc), -1);

export function fatura(D: Data, c: Cartao, venc: ISODate, status: Fatura['status']): Fatura {
  // a fatura é identificada pelo vencimento original, mesmo que paga em outra data
  const itens = eventosEntre(D, addDays(venc, -62), addDays(venc, 45)).filter((e) => e.cartaoId === c.id && e.venc === venc);
  const pg = pagamentoFatura(D, c, venc);
  return { cartao: c, vencimento: venc, fecha: fechamentoDe(c, venc), status, total: -itens.reduce((a, e) => a + e.valor, 0) || 0, itens, pagaEm: pg.data, antecipada: pg.data !== venc };
}

/** Marca a fatura como paga (ou agendada) numa data diferente do vencimento. `null` volta pro vencimento. */
export function pagarFatura(D: Data, c: Cartao, venc: ISODate, data: ISODate | null): Data {
  const pag = { ...(D.pagFaturas ?? {}) };
  const k = `${c.id}|${venc}`;
  if (!data || data === venc) delete pag[k];
  else pag[k] = { data, ts: Date.now() };
  return { ...D, pagFaturas: pag };
}

/**
 * Faturas que ainda vão sair da conta: a FECHADA (já fechou, vence em breve), se houver,
 * e a ABERTA (recebendo compras hoje).
 */
export function faturasAtuais(D: Data, c: Cartao, hoje: ISODate): Fatura[] {
  const vAberta = pagamentoCartao(c, hoje);
  const va = parse(vAberta);
  const vAnterior = dateOf(va.getFullYear(), va.getMonth() - 1, c.vencimento);
  const out: Fatura[] = [];
  if (vAnterior >= hoje) out.push(fatura(D, c, vAnterior, 'fechada'));
  out.push(fatura(D, c, vAberta, 'aberta'));
  return out;
}

/** Lançamento de ajuste pra que a fatura do app bata com o valor real do banco. */
export function ajusteFatura(f: Fatura, real: number): Lancamento | null {
  const diff = real - f.total;
  if (!diff) return null;
  return {
    id: uid(), tipo: diff > 0 ? 'saida' : 'entrada', valor: Math.abs(diff), cat: 'fatura', ico: '💳',
    desc: `Ajuste fatura ${f.cartao.nome}`, data: diaDoCiclo(f.cartao, f.vencimento),
    cartaoId: f.cartao.id, meio: 'credito', fatura: f.vencimento, criado: Date.now(),
  };
}

/** Junta as compras de cartão num único item "Fatura X" por vencimento (listas e gráfico). */
export function agruparFaturas(evs: Evento[], cartoes: Cartao[]): Evento[] {
  const out: Evento[] = [];
  const grupos = new Map<string, Evento>();
  for (const e of evs) {
    if (!e.cartaoId) { out.push(e); continue; }
    const k = `${e.cartaoId}|${e.venc ?? e.data}`;
    const g = grupos.get(k);
    if (g) { g.valor += e.valor; g.itens!.push(e); continue; }
    const nome = cartoes.find((c) => c.id === e.cartaoId)?.nome ?? e.cartao ?? 'Cartão';
    const novo: Evento = { data: e.data, venc: e.venc, valor: e.valor, desc: `Fatura ${nome}`, cat: 'fatura', ico: '💳', ref: `fat:${e.cartaoId}:${e.venc ?? e.data}`, cartao: nome, cartaoId: e.cartaoId, criado: 0, itens: [e] };
    grupos.set(k, novo);
    out.push(novo);
  }
  for (const g of grupos.values()) if (g.itens!.every((x) => x.estimativa)) { g.desc += ' (estimada)'; g.estimativa = true; }
  return out;
}

/**
 * Histórico: faturas que já venceram (mais recente primeiro), importadas ou lançadas à mão.
 * Só entram as que têm algum lançamento. Vai até 3 anos pra trás.
 */
export function faturasAnteriores(D: Data, c: Cartao, hoje: ISODate, maxMeses = 36): Fatura[] {
  const atuais = new Set(faturasAtuais(D, c, hoje).map((f) => f.vencimento));
  const primeira = D.lancamentos.filter((l) => l.cartaoId === c.id).reduce((m, l) => (l.data < m ? l.data : m), hoje);
  const va = parse(pagamentoCartao(c, hoje));
  const vencs: ISODate[] = [];
  for (let k = 1; k <= maxMeses; k++) {
    const v = dateOf(va.getFullYear(), va.getMonth() - k, c.vencimento);
    if (v < addDays(primeira, -62)) break;
    if (!atuais.has(v)) vencs.push(v);
  }
  if (!vencs.length) return [];
  // uma passada só pelos eventos do período (antes: uma por mês, o que travava a abertura das Faturas)
  const porVenc = new Map<ISODate, Evento[]>();
  for (const e of eventosEntre(D, addDays(vencs[vencs.length - 1], -62), addDays(vencs[0], 45)))
    if (e.cartaoId === c.id && e.venc) { const l = porVenc.get(e.venc); if (l) l.push(e); else porVenc.set(e.venc, [e]); }
  const out: Fatura[] = [];
  for (const v of vencs) {
    const itens = porVenc.get(v);
    if (!itens?.length) continue;
    const pg = pagamentoFatura(D, c, v);
    out.push({ cartao: c, vencimento: v, fecha: fechamentoDe(c, v), status: 'fechada', total: -itens.reduce((a, e) => a + e.valor, 0) || 0, itens, pagaEm: pg.data, antecipada: pg.data !== v });
  }
  return out;
}

/**
 * Compras no cartão feitas num mês, pela DATA DA COMPRA — só pra mostrar no extrato (o dinheiro sai
 * no vencimento da fatura, então não entram nos totais). Fica de fora o que veio de importação
 * (já aparece completo na fatura), pra não lotar o extrato com a fatura inteira.
 */
export function comprasNoCartao(D: Data, ini: ISODate, fim: ISODate) {
  const out: { l: Data['lancamentos'][number]; cartao: Cartao; venc: ISODate | null }[] = [];
  for (const l of D.lancamentos) {
    if (!l.cartaoId || l.tipo !== 'saida' || l.importado || l.cat === 'fatura' || l.data < ini || l.data > fim) continue;
    const cartao = D.cartoes.find((c) => c.id === l.cartaoId);
    if (!cartao) continue;
    const ev = eventosEntre({ ...D, recorrentes: [], lancamentos: [l] }, addDays(l.data, -1), addDays(l.data, 120)).find((e) => e.venc);
    out.push({ l, cartao, venc: ev?.venc ?? null });
  }
  return out;
}
