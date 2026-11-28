/**
 * Frequência dos fixos: todo mês (padrão, como sempre foi), toda semana ou todo ano.
 * O caminho mensal continua no motor como antes; aqui só ficam as regras de semanal/anual.
 */
import { addDays, addMonths, dateOf, monthKey, parse } from './dates';
import type { ISODate, MonthKey, Recorrente } from './types';

export type Freq = 'mensal' | 'semanal' | 'anual';
export const freqDe = (r: Pick<Recorrente, 'freq'>): Freq => r.freq ?? 'mensal';

export const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MES_CURTO = MESES_CURTO;

const dentro = (r: Recorrente, d: ISODate) => {
  const mk = monthKey(d);
  return mk >= r.inicio && (!r.fim || mk <= r.fim);
};

/** O dia cai numa pausa (ex.: férias)? */
export const pausado = (r: Pick<Recorrente, 'pausas'>, d: ISODate) => !!r.pausas?.some((p) => d >= p.de && d <= p.ate);

/** Datas de ocorrência (dia da compra/recebimento) de um fixo semanal ou anual entre `de` e `ate`. */
export function ocorrencias(r: Recorrente, de: ISODate, ate: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const f = freqDe(r);
  if (f === 'semanal') {
    const dow = r.semana ?? 0;
    const ini = de > `${r.inicio}-01` ? de : `${r.inicio}-01`;
    let d = ini;
    const atual = parse(d).getDay();
    d = addDays(d, (dow - atual + 7) % 7);
    for (; d <= ate; d = addDays(d, 7)) if (dentro(r, d) && !pausado(r, d)) out.push(d);
  } else if (f === 'anual') {
    const mes = (r.mes ?? 1) - 1;
    for (let y = parse(de).getFullYear(); y <= parse(ate).getFullYear(); y++) {
      const d = dateOf(y, mes, r.dia);
      if (d >= de && d <= ate && dentro(r, d) && !pausado(r, d)) out.push(d);
    }
  }
  return out;
}

const fimDoMes = (mk: MonthKey): ISODate => dateOf(+mk.slice(0, 4), +mk.slice(5) - 1, 31);
const meses = (de: MonthKey, ate: MonthKey) => { const out: MonthKey[] = []; for (let m = de; m <= ate; m = addMonths(m, 1)) out.push(m); return out; };

/** Sessões (ocorrências) de um fixo semanal num mês inteiro, sem as pausadas. */
export const sessoesNoMes = (r: Recorrente, mk: MonthKey) => ocorrencias(r, `${mk}-01`, fimDoMes(mk));

/** Paga as sessões juntas no mês? (só semanal, fora do cartão) */
export const agrupado = (r: Recorrente) => freqDe(r) === 'semanal' && !!r.agrupar && !r.cartaoId;

/**
 * v2.54 · Pagamentos de um fixo semanal "pago junto": um por mês, no dia `agrupar.dia` (31 → último dia),
 * com o valor de todas as sessões daquele mês (sem as pausadas). Só os que caem em [de, ate].
 */
export function pagamentosAgrupados(r: Recorrente, de: ISODate, ate: ISODate): { data: ISODate; mk: MonthKey; n: number; valor: number }[] {
  if (!agrupado(r)) return [];
  const out: { data: ISODate; mk: MonthKey; n: number; valor: number }[] = [];
  for (const mk of meses(monthKey(de), monthKey(ate))) {
    if (mk < r.inicio || (r.fim && mk > r.fim)) continue;
    const data = dateOf(+mk.slice(0, 4), +mk.slice(5) - 1, r.agrupar!.dia);
    if (data < de || data > ate) continue;
    const n = sessoesNoMes(r, mk).length;
    if (n) out.push({ data, mk, n, valor: n * r.valor });
  }
  return out;
}

/**
 * v2.54 · Reembolsos de um fixo semanal: um por mês de sessões, no dia `reembolso.dia` do mês seguinte
 * (ou na data em que caiu / nova previsão, em `reembolso.datas`), com `pct`% do que foi pago naquele mês.
 */
export function reembolsosDoFixo(r: Recorrente, de: ISODate, ate: ISODate): { data: ISODate; mk: MonthKey; n: number; valor: number; ajustado: boolean }[] {
  if (!r.reembolso || freqDe(r) !== 'semanal' || !r.reembolso.pct) return [];
  const out: { data: ISODate; mk: MonthKey; n: number; valor: number; ajustado: boolean }[] = [];
  // o mês das sessões vai de 2 meses antes de `de` (reembolso que ainda cai dentro) até o mês de `ate`
  for (const mk of meses(addMonths(monthKey(de), -2), monthKey(ate))) {
    if (mk < r.inicio || (r.fim && mk > r.fim)) continue;
    const prox = addMonths(mk, 1);
    const ajuste = r.reembolso.datas?.[mk];
    const data = ajuste ?? dateOf(+prox.slice(0, 4), +prox.slice(5) - 1, r.reembolso.dia);
    if (data < de || data > ate) continue;
    const n = sessoesNoMes(r, mk).length;
    if (n) out.push({ data, mk, n, valor: Math.round((n * r.valor * r.reembolso.pct) / 100), ajustado: !!ajuste });
  }
  return out;
}

/** Quanto pesa por mês, pra somar com os mensais (anual ÷ 12; semanal × 52 ÷ 12). */
export function porMes(r: Recorrente): number {
  const f = freqDe(r);
  if (f === 'anual') return Math.round(r.valor / 12);
  if (f === 'semanal') return Math.round((r.valor * 52) / 12);
  return r.valor;
}

/** "Todo dia 5" · "Toda segunda" · "Todo ano, 10/mar". */
export function quando(r: Pick<Recorrente, 'freq' | 'dia' | 'semana' | 'mes'>): string {
  const f = freqDe(r);
  if (f === 'semanal') {
    const s = r.semana ?? 0;
    return `${s === 0 || s === 6 ? 'Todo' : 'Toda'} ${DIAS_SEMANA[s]}`;
  }
  if (f === 'anual') return `Todo ano, ${r.dia}/${MESES_CURTO[(r.mes ?? 1) - 1]}`;
  return `Todo dia ${r.dia}`;
}

/** Um lançamento importado (data) parece ser este fixo? Tolerância de alguns dias, respeitando a frequência. */
export function bateComFixo(r: Recorrente, data: ISODate): boolean {
  const d = parse(data);
  const f = freqDe(r);
  if (f === 'semanal') return Math.min((d.getDay() - (r.semana ?? 0) + 7) % 7, ((r.semana ?? 0) - d.getDay() + 7) % 7) <= 1;
  const perto = Math.abs(r.dia - d.getDate()) <= 3;
  if (f === 'anual') return perto && d.getMonth() + 1 === (r.mes ?? 1);
  return perto;
}
