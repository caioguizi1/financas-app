import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react';
import { useEffect } from 'react';
import { useUI } from '../store';
import { spring } from './motion';

/** Janela que sobe de baixo: mola, arrastar pra fechar, fundo desfocado. */
export function SheetHost() {
  const sheet = useUI((s) => s.sheet);
  const close = useUI((s) => s.closeSheet);
  const controls = useDragControls();

  useEffect(() => {
    document.documentElement.classList.toggle('sheet-open', !!sheet);
  }, [sheet]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 650) close();
  };

  return (
    <AnimatePresence>
      {sheet && (
        <motion.div key={sheet.key} className="sheet-layer" initial="hidden" animate="shown" exit="hidden">
          <motion.div
            className="veil"
            variants={{ hidden: { opacity: 0 }, shown: { opacity: 1 } }}
            transition={{ duration: 0.25 }}
            onClick={close}
          />
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            variants={{ hidden: { y: '100%' }, shown: { y: 0 } }}
            transition={spring}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.7 }}
            onDragEnd={onDragEnd}
          >
            <div className="grab-zone" onPointerDown={(e) => controls.start(e)}>
              <div className="grab" />
            </div>
            <div className="sheet-body">{sheet.node}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
