/**
 * v2.57 · Quando um fixo é cobrado (o dia da compra/débito) e quando sai da conta.
 * Usado pra decidir de quando vale uma alteração (a cobrança deste mês já passou?) e pra mostrar,
 * antes de salvar, onde cai a próxima (Pix no dia, ou fatura do cartão no vencimento).
 */
import { addDays, dateOf, monthKey, parse } from './dates';
import { pagamentoCartao, pagamentoFatura } from './engine';
import { agrupado, freqDe, ocorrencias, pagamentosAgrupados, pausado } from './recorrencia';
import type { Cartao, Data, ISODate, MonthKey, Recorrente } from './types';

const fimDoMes = (mk: MonthKey): ISODate => dateOf(+mk.slice(0, 4), +mk.slice(5) - 1, 31);

/** Dias de cobrança (compra/débito) do fixo em [de, ate] — mesmas regras do motor (vigência e pausas). */
export function cobrancas(r: Recorrente, de: ISODate, ate: ISODate): ISODate[] {
  if (r.freq) return ocorrencias(r, de, ate);
  const out: ISODate[] = [];
  const d0 = parse(de), d1 = parse(ate);
  for (let i = d0.getFullYear() * 12 + d0.getMonth(); i <= d1.getFullYear() * 12 + d1.getMonth(); i++) {
    const occ = dateOf(Math.floor(i / 12), i % 12, r.dia);
    const mk = monthKey(occ);
    if (occ >= de && occ <= ate && mk >= r.inicio && (!r.fim || mk <= r.fim) && !pausado(r, occ)) out.push(occ);
  }
  return out;
}

/**
 * A cobrança deste mês já aconteceu (antes de hoje)? Devolve o dia dela (a última, se for semanal),
 * ou null. No "pago junto", vale o dia do pagamento.
 */
export function jaCobrouNoMes(r: Recorrente, mk: MonthKey, hoje: ISODate): ISODate | null {
  const ontem = addDays(hoje, -1);
  if (ontem < `${mk}-01`) return null;
  const ate = fimDoMes(mk) < ontem ? fimDoMes(mk) : ontem;
  const lista = agrupado(r) ? pagamentosAgrupados(r, `${mk}-01`, ate).map((p) => p.data) : cobrancas(r, `${mk}-01`, ate);
  return lista.length ? lista[lista.length - 1] : null;
}

export interface Proxima { data: ISODate; sai: ISODate; cartao?: Cartao; venc?: ISODate }

/** Próxima cobrança do fixo a partir de `desde`: o dia dela e o dia em que sai da conta. */
export function proximaCobranca(D: Data, r: Recorrente, desde: ISODate): Proxima | null {
  const ate = addDays(desde, freqDe(r) === 'anual' ? 400 : 70);
  if (agrupado(r)) {
    const p = pagamentosAgrupados(r, desde, ate)[0];
    return p ? { data: p.data, sai: p.data } : null;
  }
  const data = cobrancas(r, desde, ate)[0];
  if (!data) return null;
  const c = r.cartaoId ? D.cartoes.find((x) => x.id === r.cartaoId) : undefined;
  if (!c) return { data, sai: data };
  const venc = pagamentoCartao(c, data);
  return { data, sai: pagamentoFatura(D, c, venc).data, cartao: c, venc };
}
