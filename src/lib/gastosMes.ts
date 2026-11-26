/**
 * "Para onde foi": gastos do mês por categoria.
 * - Compra no cartão conta no mês em que você COMPROU (não no vencimento da fatura).
 * - Parcelado: cada parcela no mês dela (1ª no mês da compra, 2ª no seguinte…), como o motor faz.
 * - Fixos: a ocorrência do mês, quando já aconteceu (no mês atual, só até hoje).
 * - Fora: pagamento de fatura (senão as compras do cartão contariam duas vezes), estimativas, entradas.
 */
import { addMonths, dateOf, monthKey, parse } from './dates';
import { freqDe, ocorrencias } from './recorrencia';
import { ativaEm } from './versions';
import type { Data, ISODate } from './types';

export interface ItemGasto { ref: string; desc: string; valor: number; data: ISODate; cat: string; ico?: string; onde: string; fixo?: boolean; parcela?: { i: number; n: number } }
export interface CatMes { cat: string; total: number; pct: number; antes: number; itens: ItemGasto[] }
/** `antes` / `totalAntes`: o mês anterior — no mês em andamento, só até o mesmo dia (comparação justa). */
export interface GastosMes { mk: string; total: number; totalAntes: number; cats: CatMes[]; parcial: boolean; ateDia?: number }

const FORA = new Set(['fatura']);

function itensDoMes(D: Data, mk: string, hoje: ISODate, ateDia = 31): ItemGasto[] {
  const out: ItemGasto[] = [];
  const cartao = (id?: string | null) => (id ? D.cartoes.find((c) => c.id === id) : undefined);
  const ondeDe = (cartaoId?: string | null, meio?: string) => cartao(cartaoId)?.nome ?? (meio === 'boleto' ? 'Boleto' : 'Pix');
  const ini = `${mk}-01`, fim = dateOf(Number(mk.slice(0, 4)), Number(mk.slice(5, 7)) - 1, 31); // último dia do mês
  const ate = mk === monthKey(hoje) ? hoje : fim;
  const dentro = (d: ISODate) => parse(d).getDate() <= ateDia;

  for (const l of D.lancamentos) {
    if (l.tipo !== 'saida' || FORA.has(l.cat)) continue;
    const n = Math.max(1, l.parcelas ?? 1);
    const base = Math.floor(l.valor / n), resto = l.valor - base * n;
    const pd = parse(l.data);
    const c = cartao(l.cartaoId);
    for (let i = 0; i < n; i++) {
      const d = dateOf(pd.getFullYear(), pd.getMonth() + i + (c ? 0 : l.adiar ?? 0), pd.getDate());
      if (monthKey(d) !== mk || !dentro(d)) continue;
      out.push({ ref: l.id, desc: l.desc, valor: base + (i === 0 ? resto : 0), data: d, cat: l.cat, ico: l.ico, onde: ondeDe(l.cartaoId, l.meio), ...(n > 1 ? { parcela: { i: i + 1, n } } : {}) });
    }
  }
  for (const r of D.recorrentes) {
    if (r.tipo !== 'saida' || FORA.has(r.cat)) continue;
    const datas = freqDe(r) === 'mensal'
      ? (ativaEm(r, mk) ? [dateOf(Number(mk.slice(0, 4)), Number(mk.slice(5, 7)) - 1, r.dia)] : [])
      : ocorrencias(r, ini, fim);
    for (const d of datas) if (d <= ate && dentro(d)) out.push({ ref: r.id, desc: r.desc, valor: r.valor, data: d, cat: r.cat, ico: r.ico, onde: ondeDe(r.cartaoId, r.meio), fixo: true });
  }
  return out.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : b.valor - a.valor));
}

const somaPorCat = (xs: ItemGasto[]) => xs.reduce((m, x) => m.set(x.cat, (m.get(x.cat) ?? 0) + x.valor), new Map<string, number>());

export function gastosDoMes(D: Data, mk: string, hoje: ISODate): GastosMes {
  const itens = itensDoMes(D, mk, hoje);
  const parcial = mk === monthKey(hoje);
  const ateDia = parcial ? parse(hoje).getDate() : 31;
  const ant = somaPorCat(itensDoMes(D, addMonths(mk, -1), hoje, ateDia));
  const total = itens.reduce((a, x) => a + x.valor, 0);
  const porCat = new Map<string, ItemGasto[]>();
  for (const x of itens) porCat.set(x.cat, [...(porCat.get(x.cat) ?? []), x]);
  const cats: CatMes[] = [...porCat].map(([cat, xs]) => {
    const t = xs.reduce((a, x) => a + x.valor, 0);
    return { cat, total: t, pct: total ? t / total : 0, antes: ant.get(cat) ?? 0, itens: xs };
  }).sort((a, b) => b.total - a.total);
  return { mk, total, totalAntes: [...ant.values()].reduce((a, v) => a + v, 0), cats, parcial, ...(parcial ? { ateDia } : {}) };
}

/** Total de uma categoria nos últimos `n` meses (o último é `mk`). */
export function historicoCat(D: Data, cat: string, mk: string, hoje: ISODate, n = 4): { mk: string; total: number }[] {
  return Array.from({ length: n }, (_, i) => addMonths(mk, i - n + 1)).map((m) => ({
    mk: m, total: itensDoMes(D, m, hoje).filter((x) => x.cat === cat).reduce((a, x) => a + x.valor, 0),
  }));
}

/** Uma frase: quem leva mais e o que mais subiu em relação ao mês passado (se subiu de verdade). */
export function resumoGastos(g: GastosMes, nome: (cat: string) => string): string {
  if (!g.cats.length) return '';
  const top = g.cats[0];
  const partes = [`${nome(top.cat)} leva ${Math.round(top.pct * 100)}%.`];
  const subiu = g.cats.filter((c) => c.antes > 0 && c.total - c.antes >= 5_000 && c.total / c.antes >= 1.15).sort((a, b) => (b.total - b.antes) - (a.total - a.antes))[0];
  if (subiu) partes.push(`${nome(subiu.cat)} subiu ${Math.round((subiu.total - subiu.antes) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} em relação ao mês passado.`);
  return partes.join(' ');
}
