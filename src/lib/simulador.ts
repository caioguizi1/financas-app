/**
 * Simulador "E se eu comprar…?": o impacto de uma compra ANTES de fazer, comparando à vista e parceladas.
 * Nada é salvo. A compra conta como gasto A MAIS: soma-se à projeção atual sem recalcular a estimativa
 * ("gasto típico") do cartão — senão uma compra no cartão sumiria dentro da estimativa e pareceria não pesar.
 * Parcelas sem juros (o app não modela juros).
 */
import { addDays, monthKey, today } from './dates';
import { eventosEntre, projecao, type Ponto } from './engine';
import { parcelasPorMes } from './insights';
import type { Data, ISODate, Lancamento } from './types';

export const HORIZONTE = 90;

export interface CompraSim { valor: number; cartaoId: string | null; parcelas: number; desc?: string; cat?: string }
export type Veredito = 'tranquilo' | 'atencao' | 'aperta';

export interface OpcaoSim {
  parcelas: number;
  /** saldo dia a dia, de hoje até o horizonte, já com a compra */
  pts: Ponto[];
  minimo: { v: number; d: ISODate };
  diasNeg: number;
  /** mês em que o primeiro pagamento sai da conta, e o saldo no fim dele */
  mes: string;
  fimMes: number;
  /** primeiro pagamento (data e valor que sai da conta) */
  primeira: { d: ISODate; v: number } | null;
  /** parcelas ÷ renda no mês do primeiro pagamento: antes e com a compra (só parcelado) */
  comprometimento?: { antes: number; depois: number };
  veredito: Veredito;
  melhor?: boolean;
}

export interface Simulacao {
  compra: CompraSim;
  base: { pts: Ponto[]; minimo: { v: number; d: ISODate }; diasNeg: number };
  opcoes: OpcaoSim[];
  dica: string;
}

const fantasma = (c: CompraSim, parcelas: number, hoje: ISODate): Lancamento => ({
  id: 'simulacao', tipo: 'saida', valor: c.valor, cat: c.cat || 'compras', data: hoje, desc: c.desc || 'Simulação',
  cartaoId: c.cartaoId, parcelas: c.cartaoId ? parcelas : 1, meio: c.cartaoId ? 'credito' : 'pix',
  criado: Number.MAX_SAFE_INTEGER, // "lançado agora": conta mesmo no dia do saldo informado
});

const minimoDe = (pts: Ponto[]) => pts.reduce((m, p) => (p.v < m.v ? { v: p.v, d: p.d } : m), { v: pts[0].v, d: pts[0].d });
const negativos = (pts: Ponto[]) => pts.filter((p) => p.v < 0).length;
const fimDoMes = (pts: Ponto[], mk: string) => {
  const doMes = pts.filter((p) => monthKey(p.d) === mk);
  return doMes.length ? doMes[doMes.length - 1].v : pts[pts.length - 1].v;
};
const pct = (total: number, renda: number) => (renda ? Math.round((total / renda) * 100) : 0);

export function simular(D: Data, compra: CompraSim, opcoes: number[], hoje: ISODate = today()): Simulacao {
  const p = projecao(D, HORIZONTE, hoje);
  const basePts = p.pts.filter((x) => x.d >= hoje);
  const base = { pts: basePts, minimo: minimoDe(basePts), diasNeg: negativos(basePts) };
  const fim = addDays(hoje, HORIZONTE);
  const lista = [...new Set(compra.cartaoId ? opcoes : [1])].sort((a, b) => a - b);

  const res: OpcaoSim[] = lista.map((n) => {
    const g = fantasma(compra, n, hoje);
    // só os pagamentos da compra (datas de fatura/vencimento do cartão), somados à projeção atual
    const evs = eventosEntre({ ...D, lancamentos: [g], recorrentes: [] }, hoje, fim);
    const porDia = new Map<ISODate, number>();
    for (const e of evs) porDia.set(e.data, (porDia.get(e.data) ?? 0) + e.valor);
    let acum = 0;
    const pts = basePts.map((x) => { acum += porDia.get(x.d) ?? 0; return { d: x.d, v: x.v + acum }; });
    const prim = evs.length ? evs.reduce((a, e) => (e.data < a.data ? e : a)) : null;
    const mes = prim ? monthKey(prim.data) : monthKey(hoje);
    let comprometimento: OpcaoSim['comprometimento'];
    if (n > 1) {
      const antes = parcelasPorMes(D, hoje).find((m) => m.mes === mes);
      const depois = parcelasPorMes({ ...D, lancamentos: [...D.lancamentos, g] }, hoje).find((m) => m.mes === mes);
      const renda = depois?.renda ?? antes?.renda ?? 0;
      comprometimento = { antes: pct(antes?.total ?? 0, renda), depois: pct(depois?.total ?? 0, renda) };
    }
    const minimo = minimoDe(pts), diasNeg = negativos(pts);
    const veredito: Veredito = diasNeg > base.diasNeg || (minimo.v < 0 && base.minimo.v >= 0) ? 'aperta' : diasNeg > 0 ? 'atencao' : 'tranquilo';
    return { parcelas: n, pts, minimo, diasNeg, mes, fimMes: fimDoMes(pts, mes), primeira: prim ? { d: prim.data, v: -prim.valor } : null, comprometimento, veredito };
  });

  // "melhor" só quando é DE FATO melhor: menos dias no negativo, ou saldo mais baixo maior (mais de R$ 1).
  // Empate nisso (ex.: o ponto mais baixo vem depois de todas as parcelas pagas) = sem selo; a dica explica.
  if (res.length > 1) {
    const melhorQue = (a: OpcaoSim, b: OpcaoSim) => a.diasNeg < b.diasNeg || (a.diasNeg === b.diasNeg && a.minimo.v - b.minimo.v > 100);
    // o grupo do topo: as que nenhuma outra supera; se nele estão todas, empate geral (sem selo)
    const topo = res.filter((a) => !res.some((b) => melhorQue(b, a)));
    if (topo.length < res.length) topo.reduce((a, b) => (b.parcelas < a.parcelas ? b : a)).melhor = true;
  }
  return { compra, base, opcoes: res, dica: dicaDe(base, res) };
}

const mesNome = (mk: string) => new Date(`${mk}-15T12:00`).toLocaleDateString('pt-BR', { month: 'long' });
const addMes = (mk: string, n: number) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const brl0 = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dm = (d: ISODate) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export const rotuloOpcao = (n: number) => (n === 1 ? 'À vista' : `${n}x`);

function dicaDe(base: Simulacao['base'], ops: OpcaoSim[]): string {
  const partes: string[] = [];
  if (base.diasNeg > 0) partes.push(`O saldo já fica negativo em ${dm(base.minimo.d)} mesmo sem essa compra.`);
  const melhor = ops.find((o) => o.melhor) ?? ops.find((o) => o.veredito !== 'aperta') ?? ops[0];
  const pioram = ops.filter((o) => o.veredito === 'aperta');
  if (!pioram.length && base.diasNeg === 0) partes.push(ops.length > 1 ? 'Qualquer opção cabe: seu saldo não fica negativo nos próximos 90 dias.' : 'Cabe: seu saldo não fica negativo nos próximos 90 dias.');
  else if (pioram.length && pioram.length < ops.length) {
    const p = pioram[0];
    partes.push(`${rotuloOpcao(p.parcelas)} te deixa ${p.diasNeg - base.diasNeg} dia${p.diasNeg - base.diasNeg > 1 ? 's' : ''} a mais no negativo; ${rotuloOpcao(melhor.parcelas).toLowerCase()} não.`);
  } else if (pioram.length) {
    partes.push(`Nas opções simuladas o saldo fica mais dias no negativo (o mais baixo: ${brl0(melhor.minimo.v)} em ${dm(melhor.minimo.d)}).`);
  }
  const temMelhor = ops.some((o) => o.melhor);
  const vista = ops.find((o) => o.parcelas === 1);
  const parc = ops.filter((o) => o.parcelas > 1);
  if (!temMelhor && vista && parc.length) {
    // empate no aperto: o que muda é quanto sobra no mês do 1º pagamento × quanto fica pros meses seguintes
    const p = parc[0];
    const sobra = p.fimMes - vista.fimMes;
    const aperto = base.diasNeg > 0 || ops.some((o) => o.diasNeg > 0);
    if (sobra > 0) partes.push(`${aperto ? 'No aperto dos próximos 90 dias dá no mesmo. ' : ''}Em ${p.parcelas}x sobram ${brl0(sobra)} a mais no fim de ${mesNome(p.mes)}, mas as parcelas seguem até ${mesNome(addMes(p.mes, p.parcelas - 1))}.`);
  } else if (melhor.melhor && melhor.parcelas > 1) {
    const pior = ops.find((o) => o.parcelas === 1) ?? ops.find((o) => o !== melhor)!;
    if (!pioram.length) partes.push(`Em ${melhor.parcelas}x o saldo mais baixo fica em ${brl0(melhor.minimo.v)}; ${rotuloOpcao(pior.parcelas).toLowerCase()}, ${brl0(pior.minimo.v)} em ${dm(pior.minimo.d)}.`);
    if (melhor.primeira) partes.push(`O primeiro pagamento é de ${brl0(melhor.primeira.v)} em ${dm(melhor.primeira.d)}.`);
  }
  return partes.join(' ');
}
