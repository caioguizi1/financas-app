import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { spring, springSnappy } from './motion';

type BtnKind = 'primary' | 'ghost' | 'link' | 'danger';
export function Button({ kind = 'primary', className = '', ...p }: HTMLMotionProps<'button'> & { kind?: BtnKind }) {
  return (
    <motion.button
      whileTap={p.disabled ? undefined : { scale: 0.975 }}
      transition={springSnappy}
      className={`btn ${kind} ${className}`}
      data-primary={kind === 'primary' ? '' : undefined}
      {...p}
    />
  );
}

export function Chip({ on, added, onClick, children }: { on?: boolean; added?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <motion.button whileTap={{ scale: 0.94 }} transition={springSnappy} className={`chip ${on ? 'on' : ''} ${added ? 'added' : ''}`} onClick={onClick}>
      {children}
    </motion.button>
  );
}

/** Controle segmentado com a "pílula" deslizando entre as opções. */
export function Segmented<T extends string | number>({ options, value, onChange }: {
  options: { v: T; label: string; tone?: 'in' | 'out' }[]; value: T; onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.v)} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>
          {value === o.v && <motion.span layoutId={`seg-${id}`} className={`seg-pill ${o.tone ?? ''}`} transition={spring} />}
          <span className="seg-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function DayGrid({ value, onChange, caption = (d) => `Todo dia ${d}` }: {
  value: number | null; onChange: (d: number) => void; caption?: ((d: number) => string) | null;
}) {
  const id = useId();
  return (
    <>
      <div className="daygrid" role="radiogroup">
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <motion.button key={d} role="radio" aria-checked={d === value} whileTap={{ scale: 0.88 }} transition={springSnappy} className={d === value ? 'on' : ''} onClick={() => onChange(d)}>
            {d === value && <motion.span layoutId={`day-${id}`} className="day-pill" transition={spring} />}
            <span className="day-n">{d}</span>
          </motion.button>
        ))}
      </div>
      {caption && (
        <div className={`day-caption ${value ? 'ok' : ''}`}>
          <span className="dot" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={value ?? 0} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }}>
              {value ? <>Selecionado: <b>{caption(value)}</b></> : 'Toque em um dia'}
            </motion.span>
          </AnimatePresence>
        </div>
      )}
    </>
  );
}

export function Stepper({ value, min, max, onChange, fmt }: { value: number; min: number; max: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <div className="stepper">
      <motion.button whileTap={{ scale: 0.85 }} onClick={() => onChange(Math.max(min, value - 1))} aria-label="Menos">−</motion.button>
      <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={springSnappy}>{fmt(value)}</motion.span>
      <motion.button whileTap={{ scale: 0.85 }} onClick={() => onChange(Math.min(max, value + 1))} aria-label="Mais">＋</motion.button>
    </div>
  );
}

/** Lista com entrada em cascata. */
export const listVariants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.035, delayChildren: 0.04 } },
};
export const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0, transition: spring },
};
