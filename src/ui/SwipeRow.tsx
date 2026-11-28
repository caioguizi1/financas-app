import { animate, m, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { create } from 'zustand';
import { IEdit, ITrash } from './Icons';
import { spring } from './motion';

/** Só uma linha aberta por vez, como no iOS. */
const useOpenRow = create<{ id: string | null; set: (id: string | null) => void }>((set) => ({ id: null, set: (id) => set({ id }) }));
export const closeRows = () => useOpenRow.getState().set(null);

const BTN = 78;

/**
 * Linha de lista com "deslizar pra revelar": arraste pra esquerda → Editar / Apagar.
 * Arrastar até o fim apaga direto (com Desfazer). Toque abre a edição.
 */
export function SwipeRow({ id, onTap, onEdit, onDelete, children }: {
  id: string; onTap: () => void; onEdit?: () => void; onDelete?: () => void; children: ReactNode;
}) {
  const x = useMotionValue(0);
  const openId = useOpenRow((s) => s.id);
  const setOpen = useOpenRow((s) => s.set);
  const moved = useRef(false);
  const base = useRef(0);
  const ativo = useRef(false);
  const W = BTN * ((onEdit ? 1 : 0) + (onDelete ? 1 : 0));
  const delW = useTransform(x, (v) => (onDelete ? Math.max(BTN, -v - (onEdit ? BTN : 0)) : 0));

  useEffect(() => { if (openId !== id && x.get() !== 0) animate(x, 0, spring); }, [openId, id, x]);

  const fullDelete = () => {
    setOpen(null);
    animate(x, -window.innerWidth, { duration: 0.18 });
    setTimeout(() => onDelete!(), 140); // a linha some (exit) logo depois de deslizar
  };

  const onDragEnd = (_: unknown, i: PanInfo) => {
    const o = x.get();
    if (onDelete && (o < -W - 90 || (i.velocity.x < -1500 && o < -W))) fullDelete();
    else if (W && (o < -W / 2 || i.velocity.x < -450)) { animate(x, -W, spring); setOpen(id); }
    else { animate(x, 0, spring); if (useOpenRow.getState().id === id) setOpen(null); }
    setTimeout(() => (moved.current = false), 60);
  };

  return (
    <m.div className="swipe" initial={false} exit={{ height: 0, opacity: 0, transition: { duration: 0.22 } }}>
      {W > 0 && (
        <div className="swipe-actions" aria-hidden={openId !== id}>
          {onEdit && <button className="sa edit" onClick={() => { setOpen(null); onEdit(); }}><IEdit /><span>Editar</span></button>}
          {onDelete && <m.button className="sa del" style={{ width: delW }} onClick={fullDelete}><ITrash /><span>Apagar</span></m.button>}
        </div>
      )}
      <m.div
        className="swipe-front"
        role="button"
        tabIndex={0}
        style={{ x, touchAction: 'pan-y' }}
        // gesto de "pan" em vez de drag: mesmo efeito, sem o sistema de medição de layout do motion
        // (com dezenas de linhas montadas, ele media a página inteira a cada atualização e travava as janelas)
        onPanStart={(_, i) => {
          ativo.current = !!W && Math.abs(i.offset.x) > Math.abs(i.offset.y);
          if (!ativo.current) return;
          moved.current = true; base.current = x.get();
          if (openId && openId !== id) setOpen(null);
        }}
        onPan={(_, i) => {
          if (!ativo.current) return;
          let v = base.current + i.offset.x;
          if (v > 0) v *= 0.04; // resistência à direita
          const min = -W * 3;
          if (v < min) v = min + (v - min) * 0.12;
          x.set(v);
        }}
        onPanEnd={(e, i) => { if (!ativo.current) return; ativo.current = false; onDragEnd(e, i); }}
        onClick={() => {
          if (moved.current) return;
          if (useOpenRow.getState().id === id) { setOpen(null); return; }
          if (openId) { setOpen(null); return; }
          onTap();
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(); } }}
      >
        {children}
      </m.div>
    </m.div>
  );
}
