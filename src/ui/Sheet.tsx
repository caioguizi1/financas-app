import { animate, AnimatePresence, m, useMotionValue, useTransform } from 'motion/react';
import { createContext, useContext, useEffect, useId, useRef, type ReactNode } from 'react';
import { closeSheet, pedirFechar, useUI } from '../store';
import { ITrash } from './Icons';
import { spring, springSheet } from './motion';

/** Janela que sobe de baixo, no padrão iOS. */
export function SheetHost() {
  const sheet = useUI((s) => s.sheet);
  return (
    <AnimatePresence presenceAffectsLayout={false}>
      {sheet && <SheetFrame key={sheet.key} k={sheet.key}>{sheet.node}</SheetFrame>}
    </AnimatePresence>
  );
}

const CLOSE_DIST = 110;
const CLOSE_VEL = 700;
// arremesso rápido só fecha depois de a janela descer de verdade: um toque com o dedo
// "rolando" 8 px num iPhone de 120 Hz dava 1000 px/s e fechava a janela sem querer
const FLICK_MIN = 48;
const START_DIST = 10;

const SheetKey = createContext(0);

/**
 * A janela tem coisa digitada e não salva? Enquanto `sujo` for verdadeiro, fechar pelo
 * gesto, pelo fundo ou pelo Cancelar pergunta antes ("Sair sem salvar?").
 */
export function useRascunho(sujo: boolean) {
  const k = useContext(SheetKey);
  const parte = useId();
  useEffect(() => { if (k) useUI.getState().setSujo(k, parte, sujo); }, [k, parte, sujo]);
  useEffect(() => () => { if (k) useUI.getState().setSujo(k, parte, false); }, [k, parte]);
}

/**
 * Fecha arrastando pra baixo de QUALQUER ponto da janela (quando o conteúdo
 * está no topo), pela alça, tocando fora ou no Cancelar. Nada é salvo ao fechar — por isso,
 * com coisa digitada (useRascunho), pergunta antes de descartar.
 */
function SheetFrame({ children, k }: { children: ReactNode; k: number }) {
  const confirmar = useUI((s) => s.confirmarSaida);
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
    let x0 = 0, y0 = 0, lastY = 0, lastT = 0, vel = 0, dragging = false, active = false;

    const start = (y: number, x = 0) => { x0 = x; y0 = lastY = y; lastT = performance.now(); vel = 0; dragging = false; active = true; };
    const move = (y: number, canDrag: boolean, ev: Event, x = x0) => {
      if (!active) return;
      if (!dragging) {
        // só vira arrasto com movimento claro pra baixo (não um toque tremido nem um gesto de lado)
        if (canDrag && y - y0 > START_DIST && y - y0 > Math.abs(x - x0)) { dragging = true; y0 = lastY = y; lastT = performance.now(); vel = 0; return; }
        return;
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
      const desceu = offset.get();
      const fecha = desceu > CLOSE_DIST || (vel > CLOSE_VEL && desceu > FLICK_MIN);
      const s = useUI.getState();
      if (fecha && !s.temRascunho()) return closeSheet();
      animate(offset, 0, spring); // volta pro lugar (e, com coisa digitada, pergunta antes de sair)
      if (fecha) s.pedirFechar();
    };

    // corpo: só arrasta quando já está rolado até o topo e o gesto é pra baixo
    let scroller: Element = body;
    const ts = (e: TouchEvent) => { scroller = (e.target as Element).closest('[data-scroll]') ?? body; start(e.touches[0].clientY, e.touches[0].clientX); };
    const tm = (e: TouchEvent) => move(e.touches[0].clientY, scroller.scrollTop <= 0 && body.scrollTop <= 0, e, e.touches[0].clientX);
    body.addEventListener('touchstart', ts, { passive: true });
    body.addEventListener('touchmove', tm, { passive: false });
    body.addEventListener('touchend', end);
    body.addEventListener('touchcancel', end);

    // alça: arrasta sempre (toque ou mouse)
    const pd = (e: PointerEvent) => { grab.setPointerCapture(e.pointerId); start(e.clientY, e.clientX); };
    const pm = (e: PointerEvent) => move(e.clientY, true, e, e.clientX);
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
  }, [offset, k]);

  return (
    <m.div className="sheet-layer" initial="hidden" animate="shown" exit="hidden">
      <m.div className="veil-wrap" variants={{ hidden: { opacity: 0, transition: { duration: 0.2 } }, shown: { opacity: 1 } }} transition={{ duration: 0.18 }}>
        <m.div className="veil" style={{ opacity: veil }} onClick={pedirFechar} />
      </m.div>
      <m.div className="sheet-pos" variants={{ hidden: { y: '100%', transition: { duration: 0.26, ease: [0.32, 0, 0.67, 0] } }, shown: { y: 0 } }} transition={springSheet}>
        <m.div className="sheet" role="dialog" aria-modal="true" style={{ y: offset }}>
          <div className="grab-zone" ref={grabRef}><div className="grab" /></div>
          <div className="sheet-body" ref={bodyRef}><SheetKey.Provider value={k}>{children}</SheetKey.Provider></div>
          <AnimatePresence>
            {confirmar && (
              <m.div key="sair" className="sair-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                <m.div className="sair" role="alertdialog" aria-labelledby="sair-t" initial={{ y: 24 }} animate={{ y: 0 }} exit={{ y: 24 }} transition={spring}>
                  <div id="sair-t" className="sair-t">Sair sem salvar?</div>
                  <div className="sair-s">O que você digitou nesta janela vai se perder.</div>
                  <button className="btn primary" onClick={() => useUI.setState({ confirmarSaida: false })}>Continuar editando</button>
                  <button className="btn danger" onClick={closeSheet}>Sair sem salvar</button>
                </m.div>
              </m.div>
            )}
          </AnimatePresence>
        </m.div>
      </m.div>
    </m.div>
  );
}

/** Cabeçalho padrão: Cancelar · título · lixeira (quando o item já existe). */
export function SheetHeader({ title, onDelete, voltar }: { title: string; onDelete?: () => void; voltar?: { label: string; onClick: () => void } }) {
  return (
    <div className="sheet-head">
      {voltar ? <button className="sh-btn" onClick={voltar.onClick}>‹ {voltar.label}</button> : <button className="sh-btn" onClick={pedirFechar}>Cancelar</button>}
      <h3>{title}</h3>
      {onDelete ? (
        <m.button whileTap={{ scale: 0.88 }} className="sh-btn del" onClick={onDelete} aria-label="Apagar"><ITrash /></m.button>
      ) : <span className="sh-btn ghost" aria-hidden />}
    </div>
  );
}
