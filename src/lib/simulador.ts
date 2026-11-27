/**
 * Simulador "E se eu comprar…?": o impacto de uma compra ANTES de fazer, comparando à vista e parceladas.
 * Nada é salvo. A compra conta como gasto A MAIS: soma-se à projeção atual sem recalcular a estimativa
 * ("gasto típico") do cartão — senão uma compra no cartão sumiria dentro da estimativa e pareceria não pesar.
 * Parcelas sem juros (o app não modela juros).
 */
import { addDays, monthKey, today } from './dates';
import { brl } from './money';
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
  /** todos os pagamentos da compra dentro do horizonte (data e valor que sai da conta) */
  pagamentos: { d: ISODate; v: number }[];
  /** quanto o dia mais apertado fica mais fundo que sem a compra (≥ 0) */
  aMais: number;
  /** quanto da compra só sai DEPOIS do dia mais apertado (por isso não pesa nele) */
  depoisDoAperto: number;
  /** parcelas ÷ renda no mês do primeiro pagamento: antes e com a compra (à vista: igual) */
  comprometimento?: { antes: number; depois: number };
  veredito: Veredito;
  melhor?: boolean;
}

export interface Simulacao {
  compra: CompraSim;
  /** sem a compra: ponto mais baixo, dias no negativo e o 1º dia no negativo */
  base: { pts: Ponto[]; minimo: { v: number; d: ISODate }; diasNeg: number; primeiroNeg: ISODate | null };
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
// entradas na conta no mês (mesma regra de parcelasPorMes: sem créditos de cartão e sem estimativas)
function rendaMes(D: Data, mes: string, hoje: ISODate) {
  const m0 = `${mes}-01` as ISODate, ini = m0 > hoje ? m0 : addDays(hoje, 1);
  return eventosEntre(D, ini, addDays(m0, 30)).filter((e) => monthKey(e.data) === mes && e.valor > 0 && !e.cartaoId && !e.estimativa).reduce((t, e) => t + e.valor, 0);
}
// parcelas do mês sem a compra (com a renda do mês, mesmo que ainda não haja parcela nele)
const cacheParc = new WeakMap<Data, ReturnType<typeof parcelasPorMes>>();
function parcelasMes(D: Data, hoje: ISODate, mes: string) {
  let l = cacheParc.get(D); if (!l) { l = parcelasPorMes(D, hoje); cacheParc.set(D, l); }
  return l.find((m) => m.mes === mes);
}

export function simular(D: Data, compra: CompraSim, opcoes: number[], hoje: ISODate = today()): Simulacao {
  const p = projecao(D, HORIZONTE, hoje);
  const basePts = p.pts.filter((x) => x.d >= hoje);
  const base = { pts: basePts, minimo: minimoDe(basePts), diasNeg: negativos(basePts), primeiroNeg: basePts.find((x) => x.v < 0)?.d ?? null };
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
    // parcelas ÷ renda no mês do 1º pagamento, em TODAS as opções (à vista não cria parcela: fica igual)
    let comprometimento: OpcaoSim['comprometimento'];
    const antesM = parcelasMes(D, hoje, mes);
    const depoisM = n > 1 ? parcelasPorMes({ ...D, lancamentos: [...D.lancamentos, g] }, hoje).find((m) => m.mes === mes) : antesM;
    const renda = depoisM?.renda || antesM?.renda || rendaMes(D, mes, hoje);
    if (renda) comprometimento = { antes: pct(antesM?.total ?? 0, renda), depois: pct(depoisM?.total ?? 0, renda) };
    const minimo = minimoDe(pts), diasNeg = negativos(pts);
    const pagamentos = evs.map((e) => ({ d: e.data, v: -e.valor })).sort((a, b) => a.d.localeCompare(b.d));
    const aMais = Math.max(0, base.minimo.v - minimo.v);
    const depoisDoAperto = pagamentos.filter((x) => x.d > minimo.d).reduce((t, x) => t + x.v, 0);
    const veredito: Veredito = diasNeg > base.diasNeg || (minimo.v < 0 && base.minimo.v >= 0) ? 'aperta' : diasNeg > 0 ? 'atencao' : 'tranquilo';
    return { parcelas: n, pts, minimo, diasNeg, mes, fimMes: fimDoMes(pts, mes), primeira: prim ? { d: prim.data, v: -prim.valor } : null, pagamentos, aMais, depoisDoAperto, comprometimento, veredito };
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
const dm = (d: ISODate) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
/** dinheiro sem quebrar a linha no meio ("−R$" + número juntos) */
const R = (c: number) => brl(c).replace(' ', ' ');
export const rotuloOpcao = (n: number) => (n === 1 ? 'À vista' : `${n}x`);
const dias = (n: number) => `${n} dia${n > 1 ? 's' : ''}`;
/** "15/12", "15/12 e 15/01", "15/12 a 15/05" */
export const datasPagamento = (ps: { d: ISODate }[]) => (ps.length === 0 ? '—' : ps.length === 1 ? dm(ps[0].d) : ps.length === 2 ? `${dm(ps[0].d)} e ${dm(ps[1].d)}` : `${dm(ps[0].d)} a ${dm(ps[ps.length - 1].d)}`);

/**
 * A dica explica a DIFERENÇA entre as opções e o porquê — os números de cada uma já estão nos cartões.
 * Uma ideia por frase: (1) como está sem a compra, (2) o que muda entre as opções e por quê.
 */
function dicaDe(base: Simulacao['base'], ops: OpcaoSim[]): string {
  const partes: string[] = [];
  const vista = ops.find((o) => o.parcelas === 1);
  const melhor = ops.find((o) => o.melhor);
  const pioram = ops.filter((o) => o.diasNeg > base.diasNeg);

  // (1) sem a compra
  if (base.primeiroNeg) partes.push(`Mesmo sem essa compra, o saldo fica negativo a partir de ${dm(base.primeiroNeg)}.`);

  // (2) o que muda
  if (ops.length === 1) {
    const o = ops[0];
    if (o.diasNeg > base.diasNeg) partes.push(`Com ela, são ${dias(o.diasNeg - base.diasNeg)} a mais no negativo.`);
    else if (!base.primeiroNeg && o.minimo.v >= 0) partes.push('Cabe: o saldo não fica negativo nos próximos 90 dias.');
    else if (o.aMais > 0) partes.push(`O dia mais apertado (${dm(o.minimo.d)}) fica ${R(o.aMais)} mais fundo.`);
    return partes.join(' ');
  }
  if (!pioram.length && !base.primeiroNeg && ops.every((o) => o.minimo.v >= 0)) {
    partes.push('Qualquer opção cabe: o saldo não fica negativo nos próximos 90 dias.');
  } else if (pioram.length && pioram.length < ops.length) {
    const p = pioram[0], ok = melhor ?? ops.find((o) => o.diasNeg <= base.diasNeg)!;
    partes.push(`${rotuloOpcao(p.parcelas)} te deixa ${dias(p.diasNeg - base.diasNeg)} a mais no negativo; ${rotuloOpcao(ok.parcelas).toLowerCase()} não.`);
    if (ok.parcelas > 1 && ok.depoisDoAperto > 0) partes.push(`É que ${R(ok.depoisDoAperto)} das parcelas só saem depois do dia mais apertado.`);
  } else if (pioram.length) {
    const menos = melhor ?? ops.reduce((a, b) => (b.diasNeg < a.diasNeg ? b : a));
    partes.push(`Qualquer opção deixa o saldo mais dias no negativo; ${rotuloOpcao(menos.parcelas).toLowerCase()} é a que aperta menos (+${dias(menos.diasNeg - base.diasNeg)}).`);
  } else if (melhor && melhor.parcelas > 1 && vista) {
    // mesmos dias no negativo, mas o dia mais apertado fica menos fundo parcelando
    const dif = melhor.minimo.v - vista.minimo.v;
    partes.push(`Os dias no negativo não mudam. Em ${melhor.parcelas}x o dia mais apertado (${dm(melhor.minimo.d)}) fica ${R(dif)} menos fundo que à vista${melhor.depoisDoAperto > 0 ? `, porque ${R(melhor.depoisDoAperto)} só ${melhor.parcelas === 2 ? 'sai' : 'saem'} depois dele` : ''}.`);
  } else if (vista) {
    // empate: tudo sai antes do dia mais apertado
    const p = ops.find((o) => o.parcelas > 1)!;
    const ultimo = p.pagamentos[p.pagamentos.length - 1];
    partes.push(`No dia mais apertado (${dm(vista.minimo.d)}) dá no mesmo: as parcelas já saíram antes dele.${ultimo ? ` Parcelando, o pagamento só se espalha até ${mesNome(monthKey(ultimo.d))}.` : ''}`);
  }
  return partes.join(' ');
}
