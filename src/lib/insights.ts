/**
 * Insights locais: regras e contas sobre os seus dados — instantâneo, offline e privado.
 * Cada insight tem um "peso" para ordenar o que é mais útil agora.
 */
import { catN } from './categories';
import { addDays, addMonths, dm, mesCurto, monthKey, parse } from './dates';
import { eventosEntre, projecao, type Ponto } from './engine';
import { faturasAtuais } from './faturas';
import { brl } from './money';
import { porMes as mediaMes } from './recorrencia';
import { diasSemBackup, lembrarBackup } from './backupInfo';
import { chaveNaoMensal, provaveisMensalidades } from './mensalidade';
import { ativaEm } from './versions';
import type { Data, ISODate, Lancamento, Recorrente } from './types';
import { nomeVisivel } from './nomes';

export type Tom = 'bom' | 'alerta' | 'info';
export interface Insight {
  id: string;
  ico: string;
  titulo: string;
  texto: string;
  tom: Tom;
  peso: number;
  acao?: { label: string; tipo: 'virarFixo'; lancId: string } | { label: string; tipo: 'parcelas' } | { label: string; tipo: 'backup' };
  /** pergunta sim/não: a chave guardada em `dispensados` quando a resposta é "Não é" */
  nao?: string;
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

export interface ParcelasMes { mes: string; total: number; porOrigem: { id: string; nome: string; valor: number }[]; renda: number }

/**
 * Parcelas mês a mês (todos os cartões + boleto/Pix parcelado), no mês em que o dinheiro SAI da conta
 * (fatura: dia do vencimento/pagamento). `renda`: o que entra na conta nesse mês (salário, adiantamento,
 * extras como 13º) — pra ver quanto das entradas do mês já está comprometido com parcelas.
 */
export function parcelasPorMes(D: Data, hoje: ISODate): ParcelasMes[] {
  const meses = new Map<string, Map<string, { nome: string; valor: number }>>();
  let ultima = hoje;
  for (const l of D.lancamentos) {
    if (l.tipo !== 'saida' || (l.parcelas ?? 1) <= 1) continue;
    const evs = eventosEntre({ ...D, recorrentes: [], lancamentos: [l] }, addDays(l.data, -1), addDays(l.data, 31 * ((l.parcelas ?? 1) + 2)));
    for (const e of evs) {
      if (e.data <= hoje) continue;
      const mk = monthKey(e.data), id = e.cartaoId ?? 'outros';
      const m = meses.get(mk) ?? new Map(); meses.set(mk, m);
      const x = m.get(id) ?? { nome: e.cartao ?? 'Boleto/Pix', valor: 0 }; x.valor -= e.valor; m.set(id, x);
      if (e.data > ultima) ultima = e.data;
    }
  }
  if (!meses.size) return [];
  // entradas na conta por mês (sem créditos de cartão e sem estimativas)
  const renda = new Map<string, number>();
  for (const e of eventosEntre(D, addDays(hoje, 1), addDays(ultima, 31)))
    if (e.valor > 0 && !e.cartaoId && !e.estimativa) renda.set(monthKey(e.data), (renda.get(monthKey(e.data)) ?? 0) + e.valor);
  return [...meses].sort(([a], [b]) => a.localeCompare(b)).map(([mes, m]) => {
    // ordem fixa (a dos cartões; boleto/Pix por último): a cor de cada cartão fica sempre no mesmo lugar
    const ordem = (id: string) => { const i = D.cartoes.findIndex((c) => c.id === id); return i < 0 ? 99 : i; };
    const porOrigem = [...m].map(([id, x]) => ({ id, ...x })).sort((a, b) => ordem(a.id) - ordem(b.id));
    return { mes, total: porOrigem.reduce((s, x) => s + x.valor, 0), porOrigem, renda: renda.get(mes) ?? 0 };
  });
}

export function gerarInsights(D: Data, hoje: ISODate): Insight[] {
  const out: Insight[] = [];
  const mk = monthKey(hoje);
  const p = projecao(D, 60, hoje);

  // 1) quanto dá pra gastar por dia — v2.58: olhando os 90 dias (o mesmo horizonte do cartão "Pra não ficar
  // negativo"), não só até a próxima entrada. Antes, faturas e contas logo depois do salário ficavam de fora
  // e a dica podia dizer "R$ 412 por dia" com o saldo indo pro negativo dias depois.
  // Conta: o maior gasto igual todo dia que ainda deixa o saldo ≥ 0 em todos os dias à frente
  // (em cada dia d: saldo previsto em d ÷ dias até d; vale o menor).
  const p90 = projecao(D, 90, hoje);
  const fut = p90.pts.filter((x) => x.d > hoje);
  const neg = fut.find((x) => x.v < 0);
  if (neg) {
    out.push({ id: 'dia', ico: '🧯', tom: 'alerta', peso: 110, titulo: 'Contas acima do saldo',
      texto: `Em ${dm(neg.d)} as saídas previstas passam do que você tem. Segure os gastos variáveis — veja quanto falta no cartão vermelho do Início.` });
  } else if (fut.length) {
    let lim = fut[0], porDiaC = Infinity;
    for (const x of fut) { const r = x.v / dias(hoje, x.d); if (r < porDiaC) { porDiaC = r; lim = x; } }
    const porDia = Math.floor(porDiaC / 100) * 100;
    const causa = p90.evs.filter((e) => e.data === lim.d && e.valor < 0).sort((a, b) => a.valor - b.valor)[0];
    out.push({ id: 'dia', ico: '💸', tom: 'bom', peso: 100, titulo: `${brl(porDia)} por dia`,
      texto: `Sem o saldo ficar negativo nos próximos 3 meses. O dia mais apertado é ${dm(lim.d)}${causa ? ` (${nomeVisivel(D, causa.desc)})` : ''}.` });
  }

  // 2) dia apertado nos próximos 30 dias (sem ficar negativo)
  const renda = D.recorrentes.filter((r) => r.tipo === 'entrada' && ativaEm(r, mk)).reduce((a, r) => a + mediaMes(r), 0);
  const prox30 = p.pts.filter((x) => x.d > hoje && x.d <= addDays(hoje, 30));
  if (prox30.length) {
    const min = prox30.reduce((a, b) => (b.v < a.v ? b : a));
    const limite = Math.max(30000, Math.round(renda * 0.1));
    if (min.v >= 0 && min.v < limite) {
      const maior = p.evs.filter((e) => e.data === min.d && e.valor < 0).sort((a, b) => a.valor - b.valor)[0];
      out.push({ id: 'aperto', ico: '⚠️', tom: 'alerta', peso: 90, titulo: `Dia ${dm(min.d)} fica apertado`,
        texto: `Sobra só ${brl(min.v)}${maior ? ` depois de ${nomeVisivel(D, maior.desc)}` : ''}. Bom evitar compras grandes antes disso.` });
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

  // 4) provável mensalidade (mesmo nome, 1×/mês, valor e dia estáveis, 2 meses seguidos) → PERGUNTA
  for (const p of provaveisMensalidades(D, hoje).slice(0, 2)) {
    const nome = nomeVisivel(D, p.ultimo.desc);
    const meses = p.meses.slice(-2).map((m) => mesCurto(m).split('/')[0]).join(' e ');
    out.push({ id: `rec-${p.chave}`, ico: '🔁', tom: 'info', peso: 60, titulo: `${nome}: ${brl(p.valor)} todo dia ${p.dia}?`,
      texto: `Apareceu em ${meses}, uma vez por mês, com o mesmo valor e dia. É mensalidade? Virando fixo, entra sozinho na projeção.`,
      acao: { label: 'Sim, virar fixo', tipo: 'virarFixo', lancId: p.ultimo.id }, nao: chaveNaoMensal(p.chave) });
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
    const prox = parcelasPorMes(D, hoje)[0];
    const pct = prox && prox.renda ? Math.round((prox.total / prox.renda) * 100) : 0;
    out.push({ id: 'parc', ico: '🧾', tom: 'info', peso: 65, titulo: `${brl(tot)} em parcelas até ${mesCurto(monthKey(ate))}`,
      texto: `${abertas.length} ${abertas.length === 1 ? 'compra parcelada' : 'compras parceladas'}.${prox ? ` Em ${mesCurto(prox.mes)} saem ${brl(prox.total)}${pct ? `, ${pct}% do que você recebe no mês` : ''}.` : ''}`,
      acao: { label: 'Ver parcelas', tipo: 'parcelas' } });
  }

  // 7) assinaturas
  const ass = D.recorrentes.filter((r) => r.cat === 'assinaturas' && r.tipo === 'saida' && ativaEm(r, mk));
  if (ass.length) {
    const tot = ass.reduce((a, r) => a + mediaMes(r), 0);
    out.push({ id: 'ass', ico: '📺', tom: 'info', peso: 40, titulo: `Assinaturas: ${brl(tot)}/mês`,
      texto: `${ass.length} ${ass.length === 1 ? 'serviço' : 'serviços'} · ${brl(tot * 12)} por ano. Vale revisar o que você não usa.` });
  }

  // 8) backup (tudo fica só no aparelho)
  if (lembrarBackup(D, hoje)) {
    const n = diasSemBackup(D.backupEm, hoje);
    out.push({ id: 'backup', ico: '💾', tom: 'alerta', peso: 35, titulo: n === null ? 'Faça seu primeiro backup' : `Último backup há ${n} dias`,
      texto: 'Seus dados ficam só neste iPhone. Em Ajustes → Exportar backup, salve uma cópia no iCloud.', acao: { label: 'Fazer backup', tipo: 'backup' } });
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

/**
 * "Virar fixo" a partir de um gasto que se repete. Começa no mês SEGUINTE ao último lançamento quando
 * esse mês já foi lançado (senão o mês contava duas vezes: o fixo e a compra — corrigido na v2.40).
 */
export function fixoDoLancamento(l: Lancamento, hoje: ISODate, id: string): Recorrente {
  const mk = monthKey(hoje), ml = monthKey(l.data);
  return {
    id, criado: Date.now(), tipo: 'saida', desc: l.desc, cat: l.cat, ico: l.ico, valor: l.valor, dia: parse(l.data).getDate(),
    inicio: ml >= mk ? addMonths(ml, 1) : mk,
    ...(l.cartaoId ? { cartaoId: l.cartaoId, meio: 'credito' as const } : { cartaoId: null, meio: l.meio === 'boleto' ? 'boleto' as const : 'pix' as const }),
  };
}
