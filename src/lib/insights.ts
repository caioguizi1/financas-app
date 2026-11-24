/**
 * Insights locais: regras e contas sobre os seus dados — instantâneo, offline e privado.
 * Cada insight tem um "peso" para ordenar o que é mais útil agora.
 */
import { catN } from './categories';
import { addDays, addMonths, dm, mesCurto, monthKey, parse } from './dates';
import { eventosEntre, projecao, type Ponto } from './engine';
import { faturasAtuais } from './faturas';
import { brl } from './money';
import { normalizar } from './smart';
import { ativaEm } from './versions';
import type { Data, ISODate, Lancamento } from './types';
import { nomeLoja } from './lojas';

export type Tom = 'bom' | 'alerta' | 'info';
export interface Insight {
  id: string;
  ico: string;
  titulo: string;
  texto: string;
  tom: Tom;
  peso: number;
  acao?: { label: string; tipo: 'virarFixo'; lancId: string } | { label: string; tipo: 'parcelas' };
}

const dias = (a: ISODate, b: ISODate) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);

export interface ParcelaAberta { lanc: Lancamento; total: number; pagas: number; restante: number; ultima: ISODate; valorParcela: number }

/** Compras parceladas com parcelas ainda por vir. */
export function parcelasAbertas(D: Data, hoje: ISODate): ParcelaAberta[] {
  return D.lancamentos
    .filter((l) => l.tipo === 'saida' && (l.parcelas ?? 1) > 1)
    .map((l) => {
      const evs = eventosEntre({ ...D, recorrentes: [], lancamentos: [l] }, addDays(l.data, -1), addDays(l.data, 31 * ((l.parcelas ?? 1) + 2)));
      const futuras = evs.filter((e) => e.data > hoje);
      return {
        lanc: l, total: evs.length, pagas: evs.length - futuras.length,
        restante: -futuras.reduce((a, e) => a + e.valor, 0),
        ultima: evs[evs.length - 1]?.data ?? l.data,
        valorParcela: -(futuras[0]?.valor ?? evs[0]?.valor ?? 0),
      };
    })
    .filter((p) => p.restante > 0)
    .sort((a, b) => (a.ultima < b.ultima ? -1 : 1));
}

export function gerarInsights(D: Data, hoje: ISODate): Insight[] {
  const out: Insight[] = [];
  const mk = monthKey(hoje);
  const p = projecao(D, 60, hoje);
  const saldoHoje = p.saldoEm(hoje) ?? D.saldo.valor;

  // 1) quanto dá pra gastar por dia até a próxima entrada
  const prox = p.evs.find((e) => e.valor > 0 && e.data > hoje);
  if (prox) {
    const n = Math.max(1, dias(hoje, prox.data));
    const janela = p.pts.filter((x) => x.d >= hoje && x.d < prox.data);
    const piso = janela.length ? Math.min(...janela.map((x) => x.v)) : saldoHoje;
    const porDia = Math.floor(piso / n / 100) * 100;
    if (piso > 0) {
      out.push({ id: 'dia', ico: '💸', tom: 'bom', peso: 100, titulo: `${brl(porDia)} por dia`,
        texto: `É o que dá pra gastar até ${dm(prox.data)} (${prox.desc}), já descontando as contas de antes.` });
    } else {
      out.push({ id: 'dia', ico: '🧯', tom: 'alerta', peso: 110, titulo: 'Contas acima do saldo',
        texto: `Até ${dm(prox.data)} (${prox.desc}) as saídas previstas passam do que você tem. Segure os gastos variáveis.` });
    }
  }

  // 2) dia apertado nos próximos 30 dias (sem ficar negativo)
  const renda = D.recorrentes.filter((r) => r.tipo === 'entrada' && ativaEm(r, mk)).reduce((a, r) => a + r.valor, 0);
  const prox30 = p.pts.filter((x) => x.d > hoje && x.d <= addDays(hoje, 30));
  if (prox30.length) {
    const min = prox30.reduce((a, b) => (b.v < a.v ? b : a));
    const limite = Math.max(30000, Math.round(renda * 0.1));
    if (min.v >= 0 && min.v < limite) {
      const maior = p.evs.filter((e) => e.data === min.d && e.valor < 0).sort((a, b) => a.valor - b.valor)[0];
      out.push({ id: 'aperto', ico: '⚠️', tom: 'alerta', peso: 90, titulo: `Dia ${dm(min.d)} fica apertado`,
        texto: `Sobra só ${brl(min.v)}${maior ? ` depois de ${nomeLoja(maior.desc, D.nomes)}` : ''}. Bom evitar compras grandes antes disso.` });
    }
  }

  // 3) categoria acima da média (compras do mês pela data da compra)
  const gastos = D.lancamentos.filter((l) => l.tipo === 'saida' && l.cat !== 'fatura');
  const porMes = new Map<string, Map<string, number>>();
  for (const l of gastos) {
    const m = monthKey(l.data);
    const c = porMes.get(m) ?? new Map();
    c.set(l.cat, (c.get(l.cat) ?? 0) + l.valor);
    porMes.set(m, c);
  }
  const anteriores = [1, 2, 3].map((i) => addMonths(mk, -i)).filter((m) => porMes.has(m));
  if (anteriores.length) {
    const atual = porMes.get(mk) ?? new Map<string, number>();
    const altos = [...atual.entries()].map(([cat, v]) => {
      const media = anteriores.reduce((a, m) => a + (porMes.get(m)!.get(cat) ?? 0), 0) / anteriores.length;
      return { cat, v, media };
    }).filter((x) => x.media > 0 && x.v > x.media * 1.25 && x.v - x.media >= 5000)
      .sort((a, b) => b.v - b.media - (a.v - a.media)).slice(0, 2);
    for (const x of altos) {
      const pct = Math.round((x.v / x.media - 1) * 100);
      out.push({ id: `cat-${x.cat}`, ico: '📈', tom: 'alerta', peso: 80, titulo: `${catN(x.cat)}: +${pct}% este mês`,
        texto: `${brl(x.v)} até agora, contra uma média de ${brl(Math.round(x.media))} nos últimos ${anteriores.length === 1 ? 'mês' : `${anteriores.length} meses`}.` });
    }
  }

  // 4) gasto que se repete todo mês → virar fixo
  const fixosNomes = new Set(D.recorrentes.filter((r) => !r.fim || r.fim >= mk).map((r) => normalizar(r.desc)));
  const janelaMeses = new Set([mk, addMonths(mk, -1), addMonths(mk, -2), addMonths(mk, -3)]);
  const grupos = new Map<string, Lancamento[]>();
  for (const l of gastos) {
    if (!l.desc || (l.parcelas ?? 1) > 1 || !janelaMeses.has(monthKey(l.data))) continue;
    const k = normalizar(l.desc);
    grupos.set(k, [...(grupos.get(k) ?? []), l]);
  }
  for (const [k, ls] of grupos) {
    const meses = new Set(ls.map((l) => monthKey(l.data)));
    if (meses.size < 3 || fixosNomes.has(k)) continue;
    const ult = ls.sort((a, b) => (a.data < b.data ? 1 : -1))[0];
    out.push({ id: `rec-${k}`, ico: '🔁', tom: 'info', peso: 60, titulo: `"${nomeLoja(ult.desc, D.nomes)}" todo mês`,
      texto: `Você lançou em ${meses.size} meses seguidos. Virando fixo, ele entra sozinho na projeção.`,
      acao: { label: 'Virar fixo', tipo: 'virarFixo', lancId: ult.id } });
    if (out.filter((i) => i.id.startsWith('rec-')).length >= 2) break;
  }

  // 5) faturas de cada cartão (a fechada a vencer, se houver, e a aberta)
  for (const c of D.cartoes) {
    for (const f of faturasAtuais(D, c, hoje)) {
      if (f.total <= 0) continue;
      out.push({ id: `fat-${c.id}-${f.status}`, ico: '💳', tom: f.status === 'fechada' ? 'alerta' : 'info', peso: f.status === 'fechada' ? 85 : 70,
        titulo: `Fatura ${c.nome}${f.status === 'fechada' ? ' fechada' : ''}: ${brl(f.total)}`,
        texto: f.status === 'fechada' ? `Já fechou — vence ${dm(f.vencimento)}.` : `Aberta, vence ${dm(f.vencimento)}. Compras até o dia ${c.fechamento - 1 || 'do fechamento'} entram nela.` });
    }
  }

  // 6) parcelas comprometidas
  const abertas = parcelasAbertas(D, hoje);
  if (abertas.length) {
    const tot = abertas.reduce((a, x) => a + x.restante, 0);
    const ate = abertas.reduce((a, x) => (x.ultima > a ? x.ultima : a), hoje);
    out.push({ id: 'parc', ico: '🧾', tom: 'info', peso: 65, titulo: `${brl(tot)} em parcelas`,
      texto: `${abertas.length} ${abertas.length === 1 ? 'compra parcelada' : 'compras parceladas'} até ${mesCurto(monthKey(ate))}.`,
      acao: { label: 'Ver parcelas', tipo: 'parcelas' } });
  }

  // 7) assinaturas
  const ass = D.recorrentes.filter((r) => r.cat === 'assinaturas' && r.tipo === 'saida' && ativaEm(r, mk));
  if (ass.length) {
    const tot = ass.reduce((a, r) => a + r.valor, 0);
    out.push({ id: 'ass', ico: '📺', tom: 'info', peso: 40, titulo: `Assinaturas: ${brl(tot)}/mês`,
      texto: `${ass.length} ${ass.length === 1 ? 'serviço' : 'serviços'} · ${brl(tot * 12)} por ano. Vale revisar o que você não usa.` });
  }

  return out.sort((a, b) => b.peso - a.peso);
}

export interface TrechoNegativo { inicio: Ponto; pior: Ponto; volta?: Ponto }
/** Primeiro trecho em que o saldo fica negativo: quando começa, o pior ponto e quando volta ao positivo. */
export function trechoNegativo(pts: Ponto[]): TrechoNegativo | null {
  const i = pts.findIndex((p) => p.v < 0);
  if (i < 0) return null;
  let pior = pts[i];
  let j = i;
  for (; j < pts.length && pts[j].v < 0; j++) if (pts[j].v < pior.v) pior = pts[j];
  return { inicio: pts[i], pior, volta: pts[j] };
}
