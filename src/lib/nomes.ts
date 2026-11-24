import { nomeLoja } from './lojas';
import type { Data } from './types';

/** Textos que vieram do banco (importação), por versão dos dados. */
const cache = new WeakMap<Data, Set<string>>();
function importados(D: Data) {
  let s = cache.get(D);
  if (!s) { s = new Set(D.lancamentos.filter((l) => l.importado).map((l) => l.desc)); cache.set(D, s); }
  return s;
}
const semParcela = (d: string) => d.replace(/\s+\d{1,2}\/\d{1,2}$/, '').trim();

/**
 * Nome pra exibir. O que você digitou aparece exatamente como digitou ("ITBI - Apartamento").
 * Só o texto que veio do banco ("MLP*NETSHOES-N") é limpo, e uma correção sua sempre vale.
 * O texto salvo não muda.
 */
export function nomeVisivel(D: Data, desc: string) {
  if (desc.startsWith('Ajuste fatura ')) return 'Compras não lançadas'; // diferença pro valor que você informou do banco
  const imp = importados(D);
  return nomeLoja(desc, D.nomes, imp.has(desc) || imp.has(semParcela(desc)));
}
