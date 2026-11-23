import { m, type HTMLMotionProps } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { springSnappy } from './motion';

/**
 * Traz um elemento recém-aberto pra dentro da tela, rolando o necessário (e só o necessário).
 * Funciona dentro das janelas (área rolável [data-scroll]) e nas telas principais (página),
 * descontando a barra de abas. Se o painel for maior que a tela, alinha o começo dele.
 */
export function revelar(el: HTMLElement | null, folga = 16, alturaFinal?: number) {
  if (!el || !el.isConnected) return;
  const box = el.closest<HTMLElement>('[data-scroll]');
  const b0 = el.getBoundingClientRect();
  // abrindo: usa a altura FINAL (rola junto com a animação, sem esperar ela terminar)
  const r = { top: b0.top, height: alturaFinal ?? b0.height, bottom: b0.top + (alturaFinal ?? b0.height) };
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

/** Mantém o fim do painel à vista enquanto ele cresce (chamado a cada quadro da animação). */
function acompanhar(el: HTMLElement, folga = 16) {
  const box = el.closest<HTMLElement>('[data-scroll]');
  const r = el.getBoundingClientRect();
  const topo = box ? box.getBoundingClientRect().top : 0;
  const base = box ? box.getBoundingClientRect().bottom : window.innerHeight - (document.querySelector('.tabbar')?.getBoundingClientRect().height ?? 0);
  const passou = r.bottom - (base - folga);
  if (passou <= 0) return;
  const limite = r.top - (topo + folga + 56); // não esconde o começo do painel (nem o botão logo acima)
  const d = Math.min(passou, Math.max(0, limite));
  if (d > 0.5) { if (box) box.scrollTop += d; else window.scrollBy(0, d); }
}

/** Painel que abre/fecha com altura animada; a tela acompanha enquanto ele abre. `chave`: revela de novo quando o conteúdo muda. */
export function Expande({ children, chave, ...p }: HTMLMotionProps<'div'> & { children: ReactNode; chave?: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const abrindo = useRef(true);
  const montado = useRef(false);
  useEffect(() => {
    if (!montado.current) { montado.current = true; return; }
    const id = requestAnimationFrame(() => revelar(ref.current));
    return () => cancelAnimationFrame(id);
  }, [chave]);
  return (
    <m.div
      ref={ref}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={springSnappy}
      {...p}
      style={{ overflow: 'hidden', ...p.style }}
      onUpdate={(v) => { if (abrindo.current && ref.current && v.height !== undefined) acompanhar(ref.current); p.onUpdate?.(v); }}
      onAnimationComplete={(def) => { if ((def as { opacity?: number }).opacity === 1) { abrindo.current = false; if (ref.current) acompanhar(ref.current); } p.onAnimationComplete?.(def); }}
    >
      {children}
    </m.div>
  );
}
