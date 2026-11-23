import { m, type HTMLMotionProps } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { spring } from './motion';

/**
 * Traz um elemento recém-aberto pra dentro da tela, rolando o necessário (e só o necessário).
 * Funciona dentro das janelas (área rolável [data-scroll]) e nas telas principais (página),
 * descontando a barra de abas. Se o painel for maior que a tela, alinha o começo dele.
 */
export function revelar(el: HTMLElement | null, folga = 16) {
  if (!el || !el.isConnected) return;
  const box = el.closest<HTMLElement>('[data-scroll]');
  const r = el.getBoundingClientRect();
  const topo = box ? box.getBoundingClientRect().top : 0;
  const base = box ? box.getBoundingClientRect().bottom : window.innerHeight - (document.querySelector('.tabbar')?.getBoundingClientRect().height ?? 0);
  const visivel = base - topo - folga * 2;
  let delta = 0;
  if (r.height > visivel) delta = r.top - topo - folga - 56; // maior que a tela: mostra o começo (e um pouco do que veio antes)
  else if (r.bottom > base - folga) delta = r.bottom - (base - folga);
  else if (r.top < topo + folga) delta = r.top - (topo + folga);
  if (Math.abs(delta) < 2) return;
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  (box ?? window).scrollBy({ top: delta, behavior: reduz ? 'auto' : 'smooth' });
}

/** Painel que abre/fecha com altura animada e aparece inteiro na tela ao abrir. `chave`: revela de novo quando o conteúdo muda. */
export function Expande({ children, chave, ...p }: HTMLMotionProps<'div'> & { children: ReactNode; chave?: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const aberto = useRef(false);
  useEffect(() => {
    if (!aberto.current) return; // a 1ª revelação acontece no fim da animação de abrir
    const id = requestAnimationFrame(() => requestAnimationFrame(() => revelar(ref.current)));
    return () => cancelAnimationFrame(id);
  }, [chave]);
  return (
    <m.div
      ref={ref}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={spring}
      {...p}
      style={{ overflow: 'hidden', ...p.style }}
      onAnimationComplete={(def) => {
        if ((def as { opacity?: number }).opacity === 1) { aberto.current = true; revelar(ref.current); }
        p.onAnimationComplete?.(def);
      }}
    >
      {children}
    </m.div>
  );
}
