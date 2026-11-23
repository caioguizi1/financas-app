import { animate, m, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useId, useRef } from 'react';
import { brl, centsToStr } from '../lib/money';
import { springSnappy } from './motion';

/* ---------- valor grande que reage a cada dígito ---------- */
export function AmountDisplay({ value, compact }: { value: number; compact?: boolean }) {
  return (
    <div className={`amount ${value ? '' : 'zero'} ${compact ? 'compact' : ''}`}>
      <m.div
        key={value}
        className="v num"
        initial={{ scale: value ? 1.035 : 1 }}
        animate={{ scale: 1 }}
        transition={springSnappy}
      >
        <small>R$</small>{centsToStr(value)}
      </m.div>
    </div>
  );
}

/* ---------- número que "rola" até o valor novo ---------- */
export function AnimatedBRL({ value, sign, className }: { value: number; sign?: boolean; className?: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => brl(Math.round(v), sign));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; mv.set(value); return; }
    const c = animate(mv, value, { duration: 0.6, ease: [0.22, 1, 0.36, 1] });
    return c.stop;
  }, [value, mv]);
  return <m.span className={className}>{text}</m.span>;
}

/* ---------- teclado numérico (tela + teclado físico) ---------- */
// Só o teclado mais recente responde ao teclado físico (ex.: janela aberta sobre a tela).
const stack: string[] = [];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'];

export function Keypad({ value, onChange, small }: { value: number; onChange: (v: number) => void; small?: boolean }) {
  const id = useId();
  const ref = useRef({ value, onChange });
  ref.current = { value, onChange };

  const press = (k: string) => {
    const { value: v, onChange: set } = ref.current;
    if (k === '⌫') return set(Math.floor(v / 10));
    const n = Number(String(v) + k);
    if (n < 1e11) set(n);
  };

  useEffect(() => {
    stack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); press('⌫'); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(id), 1);
    };
  }, [id]);

  return (
    <div className={`keys ${small ? 'small' : ''}`}>
      {KEYS.map((k) => (
        <m.button key={k} className="key" whileTap={{ scale: 0.92 }} transition={springSnappy} onClick={() => press(k)} aria-label={k === '⌫' ? 'Apagar' : k}>
          {k}
        </m.button>
      ))}
    </div>
  );
}

export function MoneyField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <>
      <AmountDisplay value={value} />
      <Keypad value={value} onChange={onChange} />
    </>
  );
}

