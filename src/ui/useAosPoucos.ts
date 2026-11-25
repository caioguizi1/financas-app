import { useEffect, useState } from 'react';

/**
 * Listas longas em janelas: as primeiras `inicio` linhas montam junto com a janela; o resto entra
 * em lotes nos momentos livres depois da animação de abrir — sem travar nem a abertura nem a rolagem.
 */
export function useAosPoucos(total: number, inicio = 20, lote = 25, espera = 380) {
  const [n, setN] = useState(inicio);
  useEffect(() => {
    if (n >= total) return;
    const livre = (f: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(f, { timeout: 200 }) : setTimeout(f, 16)) as number;
    const cancelar = (id: number) => ('cancelIdleCallback' in window ? cancelIdleCallback(id) : clearTimeout(id));
    let id = 0;
    const t = setTimeout(() => { id = livre(() => setN((x) => x + lote)); }, n === inicio ? espera : 0);
    return () => { clearTimeout(t); cancelar(id); };
  }, [n, total, inicio, lote, espera]);
  return n;
}
