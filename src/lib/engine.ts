import { addDays, dateOf, monthKey, parse, today } from './dates';
import { catN } from './categories';
import type { Cartao, Data, Evento, ISODate } from './types';

/** Data em que uma compra no cartão sai da conta: o vencimento da fatura em que ela cai. */
export function pagamentoCartao(c: Cartao, compra: ISODate): ISODate {
  const d = parse(compra);
  const y = d.getFullYear();
  let m = d.getMonth();
  if (d.getDate() >= c.fechamento) m++; // depois do fechamento → próxima fatura
  if (c.vencimento <= c.fechamento) m++; // vencimento cai no mês seguinte ao fechamento
  return dateOf(y, m, c.vencimento);
}

/** Data em que a fatura sai da conta: o vencimento, ou a data em que o usuário pagou/agendou. */
export function pagamentoFatura(D: Data, c: Cartao, venc: ISODate) {
  const p = D.pagFaturas?.[`${c.id}|${venc}`];
  return { data: p?.data ?? venc, ts: p?.ts };
}

/**
 * Cache por versão dos dados: o estado é imutável (toda mudança cria um novo objeto), então o mesmo
 * cálculo pedido por várias telas (Início, sugestões, carteira…) é feito uma vez só por versão.
 */
function memo<T>(cache: WeakMap<Data, Map<string, T>>, D: Data, chave: string, calc: () => T): T {
  let m = cache.get(D);
  if (!m) cache.set(D, (m = new Map()));
  const hit = m.get(chave);
  if (hit !== undefined) return hit;
  const r = calc();
  if (m.size > 48) m.clear();
  m.set(chave, r);
  return r;
}
const cacheEventos = new WeakMap<Data, Map<string, Evento[]>>();
const cacheProjecao = new WeakMap<Data, Map<string, Projecao>>();

/** Todos os movimentos de caixa com data em [de, ate], ordenados. (Resultado compartilhado: não altere a lista.) */
export function eventosEntre(D: Data, de: ISODate, ate: ISODate): Evento[] {
  return memo(cacheEventos, D, `${de}|${ate}`, () => calcularEventos(D, de, ate));
}

function calcularEventos(D: Data, de: ISODate, ate: ISODate): Evento[] {
  const out: Evento[] = [];
  const cartao = (id?: string | null) => (id ? D.cartoes.find((c) => c.id === id) : undefined);
  const d0 = parse(de);
  const d1 = parse(ate);
  const end = d1.getFullYear() * 12 + d1.getMonth();

  for (const r of D.recorrentes) {
    // começa 2 meses antes: compras recorrentes no cartão pagam no mês seguinte
    let y = d0.getFullYear();
    let m = d0.getMonth() - 2;
    while (y * 12 + m <= end) {
      const occ = dateOf(y, m, r.dia);
      const mk = monthKey(occ);
      if (mk >= r.inicio && (!r.fim || mk <= r.fim)) {
        const c = cartao(r.cartaoId);
        const venc = c ? pagamentoCartao(c, occ) : undefined;
        const pg = c ? pagamentoFatura(D, c, venc!) : undefined;
        const cash = pg ? pg.data : occ;
        if (cash >= de && cash <= ate) {
          out.push({ venc, ...(pg?.ts ? { lanc: true, criado: pg.ts } : {}), data: cash, valor: r.tipo === 'entrada' ? r.valor : -r.valor, desc: r.desc, cat: r.cat, ico: r.ico, fixo: true, ref: r.id, cartao: c?.nome ?? null, cartaoId: c?.id, criado: pg?.ts ?? 0 });
        }
      }
      m++;
      if (m > 11) { m = 0; y++; }
    }
  }

  for (const l of D.lancamentos) {
    const c = cartao(l.cartaoId);
    // parcelado no cartão (cai em cada fatura) ou fora dele: boleto/carnê/Pix parcelado (mês a mês, mesmo dia)
    const n = Math.max(1, l.parcelas ?? 1);
    const base = Math.floor(l.valor / n);
    const resto = l.valor - base * n;
    const pd = parse(l.data);
    for (let i = 0; i < n; i++) {
      const adiar = c ? 0 : l.adiar ?? 0;
      const compra = dateOf(pd.getFullYear(), pd.getMonth() + i + adiar, pd.getDate());
      const fv = l.fatura ? parse(l.fatura) : null;
      const venc = c ? (fv ? dateOf(fv.getFullYear(), fv.getMonth() + i, c.vencimento) : pagamentoCartao(c, compra)) : undefined;
      const pg = c ? pagamentoFatura(D, c, venc!) : undefined;
      const cash = pg ? pg.data : compra;
      if (cash >= de && cash <= ate) {
        const v = base + (i === 0 ? resto : 0);
        out.push({
          data: cash, valor: l.tipo === 'entrada' ? v : -v,
          desc: (l.desc || catN(l.cat)) + (n > 1 ? ` ${i + 1}/${n}` : ''),
          cat: l.cat, ico: l.ico, ref: l.id, lanc: true, venc, cartao: c?.nome ?? null, cartaoId: c?.id, criado: Math.max(l.criado || 0, pg?.ts ?? 0),
        });
      }
    }
  }
  return out.sort(ordem);
}

export const chaveEvento = (e: Evento) => `${e.ref}|${e.data}`;

/** O saldo informado já inclui tudo até a data dele; só conta o que vem depois. */
export function entraNaConta(D: Data, ev: Evento) {
  const b = D.saldo;
  if (ev.data > b.data) return true;
  if (ev.data < b.data) return false;
  // no próprio dia: entra o que foi lançado depois de informar o saldo, ou o que o usuário disse que ainda não caiu
  return (!!ev.lanc && ev.criado > b.ts) || !!b.pendentes?.includes(chaveEvento(ev));
}

export interface Ponto { d: ISODate; v: number }
export interface Projecao { pts: Ponto[]; evs: Evento[]; saldoEm: (d: ISODate) => number | undefined }

const ordem = (a: Evento, b: Evento) => (a.data < b.data ? -1 : a.data > b.data ? 1 : b.valor - a.valor);

/**
 * Faturas que ainda não fecharam (a aberta e as futuras): se o cartão tem "gasto típico",
 * completa com a diferença entre o típico e o que já foi lançado — pra projeção não ficar otimista.
 */
export function estimativas(D: Data, reais: Evento[], hoje: ISODate, fim: ISODate): Evento[] {
  const out: Evento[] = [];
  for (const c of D.cartoes) {
    if (!c.estimativa) continue;
    let venc = pagamentoCartao(c, hoje); // fatura aberta
    for (let k = 0; k < 24 && venc <= fim; k++) {
      const lancado = -reais.filter((e) => e.cartaoId === c.id && e.venc === venc).reduce((a, e) => a + e.valor, 0);
      const falta = c.estimativa - lancado;
      const pg = pagamentoFatura(D, c, venc);
      if (falta > 0 && pg.data >= hoje) {
        out.push({ data: pg.data, venc, valor: -falta, desc: `Estimativa · ${c.nome}`, cat: 'fatura', ico: '📊', ref: `est:${c.id}:${venc}`, cartao: c.nome, cartaoId: c.id, estimativa: true, criado: 0 });
      }
      const v = parse(venc);
      venc = dateOf(v.getFullYear(), v.getMonth() + 1, c.vencimento);
    }
  }
  return out;
}

/** Saldo dia a dia desde o último saldo informado até `dias` à frente de hoje. */
export function projecao(D: Data, dias: number, hoje: ISODate = today()): Projecao {
  return memo(cacheProjecao, D, `${dias}|${hoje}`, () => calcularProjecao(D, dias, hoje));
}

function calcularProjecao(D: Data, dias: number, hoje: ISODate): Projecao {
  const ini = D.saldo.data < hoje ? D.saldo.data : hoje;
  const fim = addDays(hoje, dias);
  const reais = eventosEntre(D, ini, fim);
  const evs = [...reais, ...estimativas(D, reais, hoje, fim)].sort(ordem).filter((e) => entraNaConta(D, e));
  const pts: Ponto[] = [];
  let saldo = D.saldo.valor;
  let i = 0;
  for (let d = ini; d <= fim; d = addDays(d, 1)) {
    while (i < evs.length && evs[i].data === d) saldo += evs[i++].valor;
    pts.push({ d, v: saldo });
  }
  const map = new Map(pts.map((p) => [p.d, p.v]));
  return { pts, evs, saldoEm: (d) => map.get(d) };
}

export interface ResumoMes { de: ISODate; ate: ISODate; ent: number; sai: number; evs: Evento[] }
export function resumoMes(D: Data, y: number, m: number, hoje?: ISODate): ResumoMes {
  const de = dateOf(y, m, 1);
  const ate = dateOf(y, m, 31);
  const reais = eventosEntre(D, de, ate);
  const evs = hoje ? [...reais, ...estimativas(D, eventosEntre(D, addDays(de, -62), ate), hoje, ate).filter((e) => e.data >= de)].sort(ordem) : reais;
  let ent = 0;
  let sai = 0;
  for (const e of evs) (e.valor > 0 ? (ent += e.valor) : (sai -= e.valor));
  return { de, ate, ent, sai, evs };
}

/** Movimentos de hoje que o usuário disse que ainda não caíram (contam como "ainda entra/sai", não como saldo atual). */
export function pendentesHoje(D: Data, evs: Evento[], hoje: ISODate) {
  if (D.saldo.data !== hoje || !D.saldo.pendentes?.length) return [];
  return evs.filter((e) => e.data === hoje && D.saldo.pendentes!.includes(chaveEvento(e)));
}

export interface MesFluxo { de: ISODate; ate: ISODate; atual: boolean; inicio: number; ent: number; sai: number; fim: number }
/**
 * Resumo de caixa por mês que FECHA a conta: começa com + entra − sai = termina com.
 * Mês atual: começa no saldo de hoje e conta só o que ainda vai acontecer (o passado já está no saldo).
 * Usa os mesmos eventos da projeção (inclui estimativas de cartão).
 */
export function fluxoMeses(D: Data, hoje: ISODate, n: number): MesFluxo[] {
  const h = parse(hoje);
  const fimHorizonte = dateOf(h.getFullYear(), h.getMonth() + n - 1, 31);
  const dias = Math.round((parse(fimHorizonte).getTime() - h.getTime()) / 86400000);
  const p = projecao(D, dias, hoje);
  return Array.from({ length: n }, (_, k) => {
    const de = dateOf(h.getFullYear(), h.getMonth() + k, 1);
    const ate = dateOf(h.getFullYear(), h.getMonth() + k, 31);
    const atual = k === 0;
    const desde = atual ? hoje : addDays(de, -1); // eventos estritamente depois deste dia
    const pend = atual ? pendentesHoje(D, p.evs, hoje) : [];
    const inicio = (p.saldoEm(desde) ?? D.saldo.valor) - pend.reduce((a, e) => a + e.valor, 0);
    let ent = 0, sai = 0;
    for (const e of [...pend, ...p.evs.filter((x) => x.data > desde && x.data <= ate)]) (e.valor > 0 ? (ent += e.valor) : (sai -= e.valor));
    return { de, ate, atual, inicio, ent, sai, fim: p.saldoEm(ate) ?? inicio + ent - sai };
  });
}
