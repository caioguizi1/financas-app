import { createContext, useContext, useState, type ReactNode } from 'react';

/**
 * A tela foi montada À VISTA? Abas pré-montadas no tempo ocioso nascem escondidas: nelas a animação
 * de entrada não roda (ninguém veria).
 */
export const MontadaVisivel = createContext(true);

/**
 * Lista com entrada em cascata — em CSS puro (v2.56). Antes era motion (variants): no iPhone a animação às
 * vezes travava no começo e os itens ficavam presos transparentes e 8 px fora do lugar (caixas vazias,
 * linhas desalinhadas). Animação CSS com `backwards` não deixa estilo nenhum no item: terminando ou não,
 * ele fica no estado normal. A classe `anima` só entra se a lista nasceu com a tela à vista.
 */
export function Lista({ className, children }: { className?: string; children?: ReactNode }) {
  const visivel = useContext(MontadaVisivel);
  const [anima] = useState(visivel);
  return <div className={[className, anima ? 'anima' : ''].filter(Boolean).join(' ') || undefined}>{children}</div>;
}
