import type React from 'react';
import { AnimatePresence, m, type HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';
import { spring, springSnappy } from './motion';

type BtnKind = 'primary' | 'ghost' | 'link' | 'danger';
export function Button({ kind = 'primary', className = '', ...p }: HTMLMotionProps<'button'> & { kind?: BtnKind }) {
  return (
    <m.button
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
    <button className={`chip ${on ? 'on' : ''} ${added ? 'added' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

/** Controle segmentado com a "pílula" deslizando entre as opções. */
export function Segmented<T extends string | number>({ options, value, onChange }: {
  options: { v: T; label: React.ReactNode; tone?: 'in' | 'out' }[]; value: T; onChange: (v: T) => void;
}) {
  const i = Math.max(0, options.findIndex((o) => o.v === value));
  const tone = options[i]?.tone ?? '';
  return (
    <div className="seg" style={{ ['--n' as string]: options.length, ['--i' as string]: i }}>
      <span className={`seg-pill ${tone}`} aria-hidden />
      {options.map((o) => (
        <button key={String(o.v)} className={value === o.v ? `on ${o.tone ?? ''}` : ''} onClick={() => onChange(o.v)}>
          <span className="seg-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function DayGrid({ value, onChange, caption = (d) => `Todo dia ${d}` }: {
  value: number | null; onChange: (d: number) => void; caption?: ((d: number) => string) | null;
}) {
  return (
    <>
      <div className="daygrid" role="radiogroup">
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <button key={d} role="radio" aria-checked={d === value} className={d === value ? 'on' : ''} onClick={() => onChange(d)}>
            {d === value && <m.span className="day-pill" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springSnappy} />}
            <span className="day-n">{d}</span>
          </button>
        ))}
      </div>
      {caption && (
        <div className={`day-caption ${value ? 'ok' : ''}`}>
          <span className="dot" />
          <AnimatePresence presenceAffectsLayout={false} mode="wait" initial={false}>
            <m.span key={value ?? 0} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }}>
              {value ? <>Selecionado: <b>{caption(value)}</b></> : 'Toque em um dia'}
            </m.span>
          </AnimatePresence>
        </div>
      )}
    </>
  );
}

export function Stepper({ value, min, max, onChange, fmt }: { value: number; min: number; max: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - 1))} aria-label="Menos">−</button>
      <m.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={springSnappy}>{fmt(value)}</m.span>
      <button onClick={() => onChange(Math.min(max, value + 1))} aria-label="Mais">＋</button>
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
