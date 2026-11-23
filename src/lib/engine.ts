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

/** Todos os movimentos de caixa com data em [de, ate], ordenados. */
export function eventosEntre(D: Data, de: ISODate, ate: ISODate): Evento[] {
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
        const cash = c ? pagamentoCartao(c, occ) : occ;
        if (cash >= de && cash <= ate) {
          out.push({ data: cash, valor: r.tipo === 'entrada' ? r.valor : -r.valor, desc: r.desc, cat: r.cat, ico: r.ico, fixo: true, ref: r.id, cartao: c?.nome ?? null, criado: 0 });
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
      const compra = dateOf(pd.getFullYear(), pd.getMonth() + i, pd.getDate());
      const cash = c ? pagamentoCartao(c, compra) : compra;
      if (cash >= de && cash <= ate) {
        const v = base + (i === 0 ? resto : 0);
        out.push({
          data: cash, valor: l.tipo === 'entrada' ? v : -v,
          desc: (l.desc || catN(l.cat)) + (n > 1 ? ` ${i + 1}/${n}` : ''),
          cat: l.cat, ico: l.ico, ref: l.id, lanc: true, cartao: c?.nome ?? null, criado: l.criado || 0,
        });
      }
    }
  }
  return out.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : b.valor - a.valor));
}

/** O saldo informado já inclui tudo até a data dele; só conta o que vem depois. */
export function entraNaConta(D: Data, ev: Evento) {
  const b = D.saldo;
  if (ev.data > b.data) return true;
  return ev.data === b.data && !!ev.lanc && ev.criado > b.ts;
}

export interface Ponto { d: ISODate; v: number }
export interface Projecao { pts: Ponto[]; evs: Evento[]; saldoEm: (d: ISODate) => number | undefined }

/** Saldo dia a dia desde o último saldo informado até `dias` à frente de hoje. */
export function projecao(D: Data, dias: number, hoje: ISODate = today()): Projecao {
  const ini = D.saldo.data < hoje ? D.saldo.data : hoje;
  const fim = addDays(hoje, dias);
  const evs = eventosEntre(D, ini, fim).filter((e) => entraNaConta(D, e));
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
export function resumoMes(D: Data, y: number, m: number): ResumoMes {
  const de = dateOf(y, m, 1);
  const ate = dateOf(y, m, 31);
  const evs = eventosEntre(D, de, ate);
  let ent = 0;
  let sai = 0;
  for (const e of evs) (e.valor > 0 ? (ent += e.valor) : (sai -= e.valor));
  return { de, ate, ent, sai, evs };
}
