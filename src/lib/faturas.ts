/**
 * Faturas de cartão: ciclos (fechamento → vencimento), totais e conferência com o banco.
 * Regra: compra ANTES do dia de fechamento entra na fatura do ciclo; no dia ou depois, vai pra próxima.
 */
import { addDays, dateOf, parse } from './dates';
import { eventosEntre, pagamentoCartao } from './engine';
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
}

/** Data de fechamento do ciclo que vence em `venc`. */
export function fechamentoDe(c: Cartao, venc: ISODate): ISODate {
  const v = parse(venc);
  return dateOf(v.getFullYear(), v.getMonth() - (c.vencimento <= c.fechamento ? 1 : 0), c.fechamento);
}
/** Um dia de compra que cai com certeza na fatura que vence em `venc`. */
export const diaDoCiclo = (c: Cartao, venc: ISODate) => addDays(fechamentoDe(c, venc), -1);

function fatura(D: Data, c: Cartao, venc: ISODate, status: Fatura['status']): Fatura {
  const itens = eventosEntre(D, venc, venc).filter((e) => e.cartaoId === c.id);
  return { cartao: c, vencimento: venc, fecha: fechamentoDe(c, venc), status, total: -itens.reduce((a, e) => a + e.valor, 0), itens };
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
    cartaoId: f.cartao.id, meio: 'credito', criado: Date.now(),
  };
}

/** Junta as compras de cartão num único item "Fatura X" por vencimento (listas e gráfico). */
export function agruparFaturas(evs: Evento[], cartoes: Cartao[]): Evento[] {
  const out: Evento[] = [];
  const grupos = new Map<string, Evento>();
  for (const e of evs) {
    if (!e.cartaoId) { out.push(e); continue; }
    const k = `${e.cartaoId}|${e.data}`;
    const g = grupos.get(k);
    if (g) { g.valor += e.valor; g.itens!.push(e); continue; }
    const nome = cartoes.find((c) => c.id === e.cartaoId)?.nome ?? e.cartao ?? 'Cartão';
    const novo: Evento = { data: e.data, valor: e.valor, desc: `Fatura ${nome}`, cat: 'fatura', ico: '💳', ref: `fat:${e.cartaoId}:${e.data}`, cartao: nome, cartaoId: e.cartaoId, criado: 0, itens: [e] };
    grupos.set(k, novo);
    out.push(novo);
  }
  return out;
}
