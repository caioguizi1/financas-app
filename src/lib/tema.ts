/** Aparência: automático (segue o iPhone), claro ou escuro. Guardado à parte dos dados financeiros. */
export type Tema = 'auto' | 'claro' | 'escuro';
const KEY = 'fluxo.tema';
const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: light)') : null;

export function getTema(): Tema {
  try { const v = localStorage.getItem(KEY); return v === 'claro' || v === 'escuro' ? v : 'auto'; } catch { return 'auto'; }
}
export function aplicarTema(t: Tema = getTema()) {
  const claro = t === 'claro' || (t === 'auto' && !!mq?.matches);
  document.documentElement.dataset.theme = claro ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', claro ? '#F6F4FB' : '#07060C');
}
export function setTema(t: Tema) {
  try { localStorage.setItem(KEY, t); } catch { /* sem armazenamento */ }
  aplicarTema(t);
}
mq?.addEventListener('change', () => getTema() === 'auto' && aplicarTema());
