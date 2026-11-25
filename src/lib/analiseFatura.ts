/**
 * Análise de uma fatura (passada, fechada ou aberta): de que o valor é feito, comparação com a
 * anterior, o que continua nas próximas e onde o dinheiro foi. Só leitura: não altera dados.
 */
import { addDays, dateOf, parse } from './dates';
import { eventosEntre } from './engine';
import { fatura } from './faturas';
import type { Cartao, Data, Evento, ISODate } from './types';

export type Parte = 'mes' | 'novas' | 'antigas' | 'puladas' | 'fixos' | 'naoLanc';
export const PARTES: { id: Parte; label: string; dica: string }[] = [
  { id: 'mes', label: 'Compras do mês', dica: 'à vista, deste ciclo' },
  { id: 'novas', label: 'Novas parceladas', dica: '1ª parcela' },
  { id: 'antigas', label: 'Parcelas antigas', dica: 'de compras anteriores' },
  { id: 'puladas', label: 'Puladas', dica: 'Pula Compra (FIN)' },
  { id: 'fixos', label: 'Fixos', dica: 'assinaturas e contas' },
  { id: 'naoLanc', label: 'Compras não lançadas', dica: 'diferença pro banco' },
];

export const parteDe = (e: Evento): Parte | 'credito' => {
  if (e.valor > 0) return 'credito';
  if (e.cat === 'fatura') return 'naoLanc';
  if (e.adiado) return 'puladas';
  if (e.fixo) return 'fixos';
  if (e.parcela) return e.parcela.i === 1 ? 'novas' : 'antigas';
  return 'mes';
};

const mesAnt = (c: Cartao, venc: ISODate, k: number) => { const v = parse(venc); return dateOf(v.getFullYear(), v.getMonth() + k, c.vencimento); };

/** Guarda a análise até os dados mudarem (trocar filtro/ordem não recalcula tudo). */
const memo = new WeakMap<Data, Map<string, ReturnType<typeof calcular>>>();
export function analisarFatura(D: Data, c: Cartao, venc: ISODate, hoje?: ISODate) {
  let m = memo.get(D);
  if (!m) { m = new Map(); memo.set(D, m); }
  const k = `${c.id}|${venc}|${hoje ?? ''}`;
  let r = m.get(k);
  if (!r) { r = calcular(D, c, venc, hoje); m.set(k, r); }
  return r;
}

function calcular(D: Data, c: Cartao, venc: ISODate, hoje?: ISODate) {
  const f = fatura(D, c, venc, 'fechada');
  const partes = PARTES.map((p) => ({ ...p, valor: 0, n: 0 }));
  let creditos = 0, nCred = 0;
  for (const e of f.itens) {
    const p = parteDe(e);
    if (p === 'credito') { creditos += e.valor; nCred++; continue; }
    const x = partes.find((q) => q.id === p)!;
    x.valor -= e.valor; x.n++;
  }
  const compras = partes.reduce((s, p) => s + p.valor, 0);

  // fatura anterior (mesmo cartão), se tiver lançamento
  const vAnt = mesAnt(c, venc, -1);
  const fa = fatura(D, c, vAnt, 'fechada');
  // só compara com uma fatura completa: importada, ou com compras à vista lançadas (não só parcelas
  // deduzidas de compras futuras) — senão a comparação engana ("+444%")
  const importada = (D.importacoes ?? []).some((r) => r.cartaoId === c.id && r.venc === vAnt);
  const completa = importada || fa.itens.filter((e) => e.valor < 0 && !e.parcela && !e.fixo && e.cat !== 'fatura').length >= 3;
  // fatura ainda aberta (recebendo compras) não se compara: o total ainda vai crescer
  const fechou = !hoje || f.fecha <= hoje;
  const anterior = fa.itens.length && completa && fechou ? { venc: vAnt, total: fa.total } : null;

  // o que as parceladas desta fatura ainda cobram nas próximas
  const refs = new Set(f.itens.filter((e) => e.parcela && e.parcela.i < e.parcela.n).map((e) => e.ref));
  const prox = new Map<string, number>();
  if (refs.size) {
    for (const e of eventosEntre(D, addDays(venc, 1), addDays(venc, 400)))
      if (e.cartaoId === c.id && refs.has(e.ref) && e.venc && e.venc > venc) prox.set(e.venc, (prox.get(e.venc) ?? 0) - e.valor);
  }
  const futuro = [...prox].sort(([a], [b]) => a.localeCompare(b)).map(([v, valor]) => ({ venc: v, valor }));

  // categorias (só compras de verdade: sem créditos e sem a diferença do banco)
  const porCat = new Map<string, number>();
  for (const e of f.itens) if (e.valor < 0 && e.cat !== 'fatura') porCat.set(e.cat, (porCat.get(e.cat) ?? 0) - e.valor);
  const somaCat = [...porCat.values()].reduce((a, b) => a + b, 0);
  const categorias = [...porCat].sort((a, b) => b[1] - a[1]).map(([cat, valor]) => ({ cat, valor, pct: somaCat ? valor / somaCat : 0 }));

  const maior = f.itens.filter((e) => e.valor < 0 && e.cat !== 'fatura').sort((a, b) => a.valor - b.valor)[0] ?? null;
  return { f, total: f.total, compras, creditos, nCred, partes: partes.filter((p) => p.n), anterior, futuro, categorias, maior };
}
