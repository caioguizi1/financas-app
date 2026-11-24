/**
 * Leitura da fatura em foco: o que chama atenção (concentração numa categoria, categoria acima do
 * normal, peso das parcelas, compras novas parceladas, acima/abaixo do típico, compromisso futuro).
 * Tudo derivado dos dados — recalcula a cada lançamento/importação.
 */
import { catN } from './categories';
import { addDays, mesCurto, monthKey } from './dates';
import { eventosEntre } from './engine';
import { brl } from './money';
import type { Cartao, Data, Evento, ISODate } from './types';
import { nomeVisivel } from './nomes';

export interface DicaFatura { id: string; tom: 'alerta' | 'atencao' | 'bom' | 'info'; texto: string; peso: number }

const PARC = /(\d+)\/(\d+)$/;
const parcelaDe = (e: Evento) => { const m = e.desc.match(PARC); return m ? { i: +m[1], n: +m[2] } : null; };
const pct = (x: number) => `${Math.round(x * 100)}%`;
/** 'a média…' → 'da média…'; 'seu gasto típico' → 'do seu gasto típico' */
const de = (t: string) => (t.startsWith('a ') ? `da ${t.slice(2)}` : `do ${t}`);
const compra = (e: Evento) => e.valor < 0 && !e.estimativa && e.cat !== 'fatura';

export function dicasDaFatura(D: Data, c: Cartao, venc: ISODate, itens: Evento[]): DicaFatura[] {
  const compras = itens.filter(compra);
  // valor informado à mão (sem detalhe) também é gasto desta fatura: entra na base dos percentuais
  const manual = -itens.filter((e) => e.cat === 'fatura' && !e.estimativa).reduce((a, e) => a + e.valor, 0);
  const total = -compras.reduce((a, e) => a + e.valor, 0) + Math.max(0, manual);
  if (total <= 0 || !compras.length) return [];
  // fatura futura (ainda com previsão pelo gasto típico): só parcelas estão lançadas — falar de
  // "concentração" ou "maior compra" engana; o que importa é quanto já está comprometido
  const previsto = -itens.filter((e) => e.estimativa).reduce((a, e) => a + e.valor, 0);
  const futura = previsto > 0;
  const out: DicaFatura[] = [];

  // por categoria (nesta fatura)
  const porCat = new Map<string, number>();
  for (const e of compras) porCat.set(e.cat, (porCat.get(e.cat) ?? 0) - e.valor);
  const cats = [...porCat.entries()].sort((a, b) => b[1] - a[1]);

  // histórico: faturas anteriores deste cartão com compras lançadas (até 3)
  // só faturas COMPLETAS contam: importadas, ou com compras à vista lançadas. Uma fatura antiga que só tem
  // as parcelas anteriores de compras importadas depois não representa o gasto daquele mês.
  const ant = eventosEntre(D, addDays(venc, -130), addDays(venc, -1)).filter((e) => e.cartaoId === c.id && e.venc && e.venc < venc && compra(e));
  const importadas = new Set((D.importacoes ?? []).filter((x) => x.cartaoId === c.id && x.venc).map((x) => x.venc!));
  const completa = (v: ISODate) => importadas.has(v) || ant.filter((e) => e.venc === v && !parcelaDe(e)).length >= 3;
  const vencsAnt = [...new Set(ant.map((e) => e.venc!))].filter(completa).sort().slice(-3);
  const base = vencsAnt.length === 1 ? `a fatura de ${mesCurto(monthKey(vencsAnt[0]))}` : 'a média das últimas faturas';
  const media = (cat: string) => vencsAnt.length ? -ant.filter((e) => vencsAnt.includes(e.venc!) && e.cat === cat).reduce((a, e) => a + e.valor, 0) / vencsAnt.length : null;
  const mediaTotal = vencsAnt.length ? -ant.filter((e) => vencsAnt.includes(e.venc!)).reduce((a, e) => a + e.valor, 0) / vencsAnt.length : null;

  // 1) categoria bem acima do normal
  for (const [cat, v] of cats.slice(0, 4)) {
    const m = media(cat);
    if (m != null && m > 0 && v >= m * 1.5 && v - m >= 15000)
      out.push({ id: `alta-${cat}`, tom: 'alerta', peso: 90 + (v - m) / 10000, texto: `Você está gastando mais com ${catN(cat)}: ${brl(v)}, ${(v / m).toFixed(1).replace('.', ',')}x ${base} (+${brl(v - m)}).` });
    else if (m === 0 && v >= 20000 && vencsAnt.length >= 2)
      out.push({ id: `nova-${cat}`, tom: 'atencao', peso: 60, texto: `${catN(cat)} apareceu agora: ${brl(v)} que não tinha em ${base.replace('a média das últimas faturas', 'nas faturas anteriores')}.` });
  }

  // 2) concentração numa categoria
  const [topCat, topV] = cats[0];
  if (!futura && topV / total >= 0.35 && topV >= 20000 && !out.some((d) => d.id === `alta-${topCat}`))
    out.push({ id: 'conc', tom: 'atencao', peso: 70, texto: `${catN(topCat)} é ${pct(topV / total)} desta fatura (${brl(topV)}) — é onde mais dá pra cortar.` });

  // 3) peso das parcelas e compras novas parceladas
  const parc = compras.map((e) => ({ e, p: parcelaDe(e) })).filter((x) => x.p);
  const vParc = -parc.reduce((a, x) => a + x.e.valor, 0);
  const novas = parc.filter((x) => x.p!.i === 1);
  if (futura && vParc > 0) {
    const base = total + previsto;
    out.push({ id: 'parc', tom: vParc / base >= 0.6 ? 'alerta' : vParc / base >= 0.4 ? 'atencao' : 'info', peso: 80, texto: `${brl(vParc)} (${pct(vParc / base)} da fatura prevista) já estão comprometidos em ${parc.length} ${parc.length === 1 ? 'parcela' : 'parcelas'}. Sobra ${brl(Math.max(0, base - total))} até o seu gasto típico.` });
  } else if (vParc / total >= 0.4 && parc.length >= 3)
    out.push({ id: 'parc', tom: vParc / total >= 0.6 ? 'alerta' : 'atencao', peso: 80 + (vParc / total) * 10, texto: `${pct(vParc / total)} desta fatura são parcelas (${parc.length} compras, ${brl(vParc)}). Novas compras no cartão somam em cima disso.` });
  if (novas.length >= 2) {
    const mensal = -novas.reduce((a, x) => a + x.e.valor, 0);
    const ate = novas.reduce((m, x) => Math.max(m, x.p!.n - 1), 0);
    const [y, mo] = monthKey(venc).split('-').map(Number);
    const fim = new Date(y, mo - 1 + ate, 1);
    out.push({ id: 'novasparc', tom: 'atencao', peso: 65, texto: `${novas.length} compras novas parceladas nesta fatura: +${brl(mensal)} por mês até ${mesCurto(`${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, '0')}`)}.` });
  }

  // 4) contra o típico / a média
  const ref = c.estimativa ?? mediaTotal;
  if (ref && ref > 0) {
    const nome = c.estimativa ? 'seu gasto típico' : base;
    if (total > ref * 1.1) out.push({ id: 'acima', tom: 'alerta', peso: 85, texto: `${brl(total - ref)} acima ${de(nome)} (${brl(ref)}).` });
    else if (!futura && total < ref * 0.8 && total > 0 && vencsAnt.length) out.push({ id: 'abaixo', tom: 'bom', peso: 40, texto: `${brl(ref - total)} abaixo ${de(nome)} até agora. Bom ritmo.` });
  }

  // 5) uma compra pesando muito
  const maior = [...compras].sort((a, b) => a.valor - b.valor)[0];
  if (!futura && maior && -maior.valor / total >= 0.2 && compras.length >= 3)
    out.push({ id: 'maior', tom: 'info', peso: 50, texto: `A maior compra, ${nomeVisivel(D, maior.desc.replace(PARC, '').trim())}, é ${pct(-maior.valor / total)} da fatura (${brl(-maior.valor)}).` });

  // 6) compromisso que já vem desta fatura
  const futuro = parc.reduce((a, x) => a + -x.e.valor * (x.p!.n - x.p!.i), 0);
  if (futuro >= 50000) out.push({ id: 'futuro', tom: 'info', peso: 45, texto: `As parcelas desta fatura ainda somam ${brl(futuro)} nas próximas.` });

  return out.sort((a, b) => b.peso - a.peso).slice(0, 4);
}
