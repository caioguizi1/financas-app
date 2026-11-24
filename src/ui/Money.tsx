import { animate, m, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import { brl, centsToStr } from '../lib/money';
import { springSnappy } from './motion';

/* ---------- valor grande que reage a cada dígito ---------- */
export function AmountDisplay({ value, compact, onClick, ativo }: { value: number; compact?: boolean; onClick?: () => void; ativo?: boolean }) {
  const toque = onClick ? { role: 'button', tabIndex: 0, onClick, 'aria-label': ativo ? 'Valor (editando)' : 'Alterar valor', 'data-amount': '' } : {};
  return (
    <div className={`amount ${value ? '' : 'zero'} ${compact ? 'compact' : ''} ${onClick ? 'tap' : ''} ${ativo ? 'ativo' : ''}`} {...toque}>
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

/** `recomecar`: o primeiro dígito começa um valor novo (edição); ⌫ continua ajustando o atual. */
export function Keypad({ value, onChange, small, recomecar }: { value: number; onChange: (v: number) => void; small?: boolean; recomecar?: boolean }) {
  const id = useId();
  const ref = useRef({ value, onChange });
  ref.current = { value, onChange };
  const primeiro = useRef(!!recomecar);

  const press = (k: string) => {
    const { onChange: set } = ref.current;
    let v = ref.current.value;
    if (k === '⌫') { primeiro.current = false; return set(Math.floor(v / 10)); }
    if (primeiro.current) { primeiro.current = false; v = 0; }
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
        <button key={k} className="key" onClick={() => press(k)} aria-label={k === '⌫' ? 'Apagar' : k}>
          {k}
        </button>
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


/**
 * Teclado que só aparece quando você toca no valor (edição). Some ao tocar fora dele
 * ou em "OK". Num lançamento novo ele já abre, pra digitar direto.
 */
export function useTeclado(inicial: boolean) {
  const [aberto, setAberto] = useState(inicial);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('[data-teclado],[data-amount]')) return;
      setAberto(false);
    };
    document.addEventListener('pointerdown', fora, true);
    return () => document.removeEventListener('pointerdown', fora, true);
  }, [aberto]);
  return { aberto, abrir: () => setAberto((a) => !a), fechar: () => setAberto(false) };
}

export function TecladoRecolhivel({ aberto, onOk, children }: { aberto: boolean; onOk: () => void; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {aberto && (
        <m.div key="tec" data-teclado className="tec" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}>
          <div className="tec-bar"><button className="tec-ok" onClick={onOk}>OK</button></div>
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
