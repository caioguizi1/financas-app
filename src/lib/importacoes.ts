/** Histórico de faturas importadas: o que foi enviado pra cada cartão, conferência e desfazer. */
import { uid } from './money';
import type { Data, ISODate, Importacao, Lancamento } from './types';

/** Valor que a compra põe NESTA fatura (parcela, quando parcelada). */
const naFatura = (l: Lancamento) => (l.parcelas && l.parcelas > 1 ? Math.round(l.valor / l.parcelas) : l.valor) * (l.tipo === 'saida' ? 1 : -1);

export function registrar(d: Data, r: Omit<Importacao, 'id' | 'quando'>): Data {
  const nova: Importacao = { ...r, id: uid(), quando: Date.now() };
  // reimportar a mesma fatura do mesmo cartão substitui o registro anterior (os lançamentos já são deduplicados)
  const resto = (d.importacoes ?? []).filter((x) => !(x.tipo === nova.tipo && x.cartaoId === nova.cartaoId && x.venc && x.venc === nova.venc));
  const anterior = (d.importacoes ?? []).find((x) => !resto.includes(x));
  if (anterior) nova.ids = [...new Set([...anterior.ids, ...nova.ids])];
  return { ...d, importacoes: [...resto, nova] };
}

/** Desfaz uma importação: remove os lançamentos que ela criou e o registro. */
export function remover(d: Data, id: string): Data {
  const r = d.importacoes?.find((x) => x.id === id);
  if (!r) return d;
  const ids = new Set(r.ids);
  return { ...d, lancamentos: d.lancamentos.filter((l) => !ids.has(l.id)), importacoes: d.importacoes!.filter((x) => x.id !== id) };
}

/** Importações de um cartão, da fatura mais recente pra mais antiga. */
export function doCartao(d: Data, cartaoId: string): Importacao[] {
  return (d.importacoes ?? []).filter((x) => x.cartaoId === cartaoId).sort((a, b) => (b.venc ?? '').localeCompare(a.venc ?? '') || b.quando - a.quando);
}

/**
 * Reconstrói o histórico das importações feitas antes de ele existir: os lançamentos importados de uma vez
 * têm o mesmo instante de criação e a âncora `fatura`. O vencimento é o mais comum entre as compras à vista
 * (nas parceladas a âncora é a fatura da 1ª parcela).
 */
export function inferir(d: Data): Importacao[] {
  const lotes = new Map<string, Lancamento[]>();
  for (const l of d.lancamentos) {
    if (!l.cartaoId || !l.fatura || l.cat === 'fatura') continue;
    const k = `${l.cartaoId}|${l.criado}`;
    lotes.set(k, [...(lotes.get(k) ?? []), l]);
  }
  const out: Importacao[] = [];
  for (const [k, ls] of lotes) {
    if (ls.length < 3) continue;
    const conta = new Map<ISODate, number>();
    for (const l of ls) if (!l.parcelas || l.parcelas < 2) conta.set(l.fatura!, (conta.get(l.fatura!) ?? 0) + 1);
    const venc = [...conta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!venc) continue;
    const total = ls.reduce((a, l) => a + Math.max(0, naFatura(l)), 0);
    out.push({ id: uid(), tipo: 'fatura', cartaoId: k.split('|')[0], venc, total, ids: ls.map((l) => l.id), quando: ls[0].criado, inferida: true });
  }
  return out;
}

