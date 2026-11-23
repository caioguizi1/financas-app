import { animate, AnimatePresence, m, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { closeSheet, useUI } from '../store';
import { ITrash } from './Icons';
import { spring, springSheet } from './motion';

/** Janela que sobe de baixo, no padrão iOS. */
export function SheetHost() {
  const sheet = useUI((s) => s.sheet);
  return (
    <AnimatePresence>
      {sheet && <SheetFrame key={sheet.key}>{sheet.node}</SheetFrame>}
    </AnimatePresence>
  );
}

const CLOSE_DIST = 110;
const CLOSE_VEL = 700;

/**
 * Fecha arrastando pra baixo de QUALQUER ponto da janela (quando o conteúdo
 * está no topo), pela alça, tocando fora ou no Cancelar. Nada é salvo ao fechar.
 */
function SheetFrame({ children }: { children: ReactNode }) {
  const offset = useMotionValue(0);
  const veil = useTransform(offset, [0, 500], [1, 0.15]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const grabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.add('sheet-open');
    return () => document.documentElement.classList.remove('sheet-open');
  }, []);

  useEffect(() => {
    const body = bodyRef.current!;
    const grab = grabRef.current!;
    let y0 = 0, lastY = 0, lastT = 0, vel = 0, dragging = false, active = false;

    const start = (y: number) => { y0 = lastY = y; lastT = performance.now(); vel = 0; dragging = false; active = true; };
    const move = (y: number, canDrag: boolean, ev: Event) => {
      if (!active) return;
      if (!dragging) {
        if (canDrag && y - y0 > 6) { dragging = true; y0 = y; } else return;
      }
      if (ev.cancelable) ev.preventDefault();
      const now = performance.now();
      vel = ((y - lastY) / Math.max(1, now - lastT)) * 1000;
      lastY = y; lastT = now;
      const dy = y - y0;
      offset.set(dy > 0 ? dy : dy * 0.15);
    };
    const end = () => {
      active = false;
      if (!dragging) return;
      dragging = false;
      if (offset.get() > CLOSE_DIST || vel > CLOSE_VEL) closeSheet();
      else animate(offset, 0, spring);
    };

    // corpo: só arrasta quando já está rolado até o topo e o gesto é pra baixo
    let scroller: Element = body;
    const ts = (e: TouchEvent) => { scroller = (e.target as Element).closest('[data-scroll]') ?? body; start(e.touches[0].clientY); };
    const tm = (e: TouchEvent) => move(e.touches[0].clientY, scroller.scrollTop <= 0 && body.scrollTop <= 0, e);
    body.addEventListener('touchstart', ts, { passive: true });
    body.addEventListener('touchmove', tm, { passive: false });
    body.addEventListener('touchend', end);
    body.addEventListener('touchcancel', end);

    // alça: arrasta sempre (toque ou mouse)
    const pd = (e: PointerEvent) => { grab.setPointerCapture(e.pointerId); start(e.clientY); };
    const pm = (e: PointerEvent) => move(e.clientY, true, e);
    grab.addEventListener('pointerdown', pd);
    grab.addEventListener('pointermove', pm);
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
    return () => {
      body.removeEventListener('touchstart', ts); body.removeEventListener('touchmove', tm);
      body.removeEventListener('touchend', end); body.removeEventListener('touchcancel', end);
      grab.removeEventListener('pointerdown', pd); grab.removeEventListener('pointermove', pm);
      grab.removeEventListener('pointerup', end); grab.removeEventListener('pointercancel', end);
    };
  }, [offset]);

  return (
    <m.div className="sheet-layer" initial="hidden" animate="shown" exit="hidden">
      <m.div className="veil-wrap" variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }} transition={{ duration: 0.18 }}>
        <m.div className="veil" style={{ opacity: veil }} onClick={closeSheet} />
      </m.div>
      <m.div className="sheet-pos" variants={{ hidden: { y: '100%' }, shown: { y: 0 } }} transition={springSheet}>
        <m.div className="sheet" role="dialog" aria-modal="true" style={{ y: offset }}>
          <div className="grab-zone" ref={grabRef}><div className="grab" /></div>
          <div className="sheet-body" ref={bodyRef}>{children}</div>
        </m.div>
      </m.div>
    </m.div>
  );
}

/** Cabeçalho padrão: Cancelar · título · lixeira (quando o item já existe). */
export function SheetHeader({ title, onDelete }: { title: string; onDelete?: () => void }) {
  return (
    <div className="sheet-head">
      <button className="sh-btn" onClick={closeSheet}>Cancelar</button>
      <h3>{title}</h3>
      {onDelete ? (
        <m.button whileTap={{ scale: 0.88 }} className="sh-btn del" onClick={onDelete} aria-label="Apagar"><ITrash /></m.button>
      ) : <span className="sh-btn ghost" aria-hidden />}
    </div>
  );
}
