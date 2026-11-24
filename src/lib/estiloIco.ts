/** Estilo das figuras de categoria: ícone (padrão, v2.21) ou emoji (opcional, em Ajustes). Fica só neste aparelho. */
export type EstiloIco = 'icone' | 'emoji';
const KEY = 'fluxo.icones';
const subs = new Set<() => void>();
let atual: EstiloIco = (() => { try { return localStorage.getItem(KEY) === 'emoji' ? 'emoji' : 'icone'; } catch { return 'icone'; } })();
export const getEstiloIco = () => atual;
export function setEstiloIco(e: EstiloIco) {
  atual = e;
  try { localStorage.setItem(KEY, e); } catch { /* sem storage */ }
  subs.forEach((f) => f());
}
export function assinarEstiloIco(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
