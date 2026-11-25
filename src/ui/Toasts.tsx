import { AnimatePresence, m } from 'motion/react';
import { useUI } from '../store';
import { spring } from './motion';

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  return (
    <div className="toast-host" aria-live="polite">
      <AnimatePresence presenceAffectsLayout={false}>
        {toasts.map((t) => (
          <m.div
            key={t.id}
            className="toast"
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.18 } }}
            transition={spring}
          >
            <span>{t.msg}</span>
            {t.undo && (
              <button onClick={() => { t.undo!(); dismiss(t.id); }}>Desfazer</button>
            )}
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
