import { m, type HTMLMotionProps } from 'motion/react';
import { createContext, useContext } from 'react';
import { listVariants } from './Controls';

/**
 * A tela foi montada À VISTA? Abas pré-montadas no tempo ocioso nascem escondidas: nelas a animação
 * de entrada não roda (ninguém veria) — e, escondida, ela podia ficar presa no início (linhas invisíveis).
 */
export const MontadaVisivel = createContext(true);

/** Lista com entrada em cascata só quando faz sentido; senão já aparece pronta. */
export function Lista(p: HTMLMotionProps<'div'>) {
  const visivel = useContext(MontadaVisivel);
  return <m.div variants={listVariants} initial={visivel ? 'hidden' : false} animate="shown" {...p} />;
}
