import { animate, m, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import { brl, centsToStr } from '../lib/money';

/* ---------- valor grande que reage a cada dígito ---------- */
export function AmountDisplay({ value, compact, onClick, ativo }: { value: number; compact?: boolean; onClick?: () => void; ativo?: boolean }) {
  const toque = onClick ? { role: 'button', tabIndex: 0, onClick, 'aria-label': ativo ? 'Valor (editando)' : 'Alterar valor', 'data-amount': '' } : {};
  return (
    <div className={`amount ${value ? '' : 'zero'} ${compact ? 'compact' : ''} ${onClick ? 'tap' : ''} ${ativo ? 'ativo' : ''}`} {...toque}>
      {/* pulso a cada dígito em CSS (antes: um componente animado por valor, caro ao abrir a janela) */}
      <div key={value} className={`v num ${value ? 'pulse' : ''}`}>
        <small>R$</small>{centsToStr(value)}
      </div>
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

/**
 * Teclado de valor. Sempre continua do valor que está na tela (v2.52: antes, numa edição, o 1º número
 * digitado substituía o valor inteiro — R$ 78,29 + "5" virava R$ 0,05 e parecia que tinha zerado).
 * ⌫ apaga o último dígito; segurar o ⌫ limpa o valor.
 */
export function Keypad({ value, onChange, small }: { value: number; onChange: (v: number) => void; small?: boolean }) {
  const id = useId();
  const ref = useRef({ value, onChange });
  ref.current = { value, onChange };
  const segurar = useRef<{ t?: ReturnType<typeof setTimeout>; limpou: boolean }>({ limpou: false });

  const press = (k: string) => {
    const { onChange: set, value: v } = ref.current;
    if (k === '⌫') return set(Math.floor(v / 10));
    const n = Number(String(v) + k);
    if (n < 1e11) set(n);
  };
  const soltar = () => { clearTimeout(segurar.current.t); segurar.current.t = undefined; };

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
        <button key={k} className="key" aria-label={k === '⌫' ? 'Apagar' : k}
          onClick={() => { if (k === '⌫' && segurar.current.limpou) { segurar.current.limpou = false; return; } press(k); }}
          {...(k === '⌫' ? {
            // segurar o ⌫ limpa o valor (como no teclado do iPhone, sem perder nada sem querer)
            onPointerDown: () => { segurar.current.limpou = false; soltar(); segurar.current.t = setTimeout(() => { segurar.current.limpou = true; ref.current.onChange(0); navigator.vibrate?.(10); }, 550); },
            onPointerUp: soltar, onPointerLeave: soltar, onPointerCancel: soltar, onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
          } : {})}>
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
 * ou em "OK". Fica fechado até tocar no valor (também no lançamento novo).
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
    // fecha no 'click' (depois do toque), não no pointerdown: assim a tela não se mexe antes do toque
    // terminar e o dedo não acerta outro chip
    const fecha = (e: MouseEvent) => { const ev = e as unknown as PointerEvent; setTimeout(() => fora(ev), 0); };
    document.addEventListener('click', fecha, true);
    return () => document.removeEventListener('click', fecha, true);
  }, [aberto]);
  return { aberto, abrir: () => setAberto((a) => !a), fechar: () => setAberto(false) };
}

export function TecladoRecolhivel({ aberto, onOk, children }: { aberto: boolean; onOk: () => void; children: ReactNode }) {
  return (
    <AnimatePresence presenceAffectsLayout={false} initial={false}>
      {aberto && (
        <m.div key="tec" data-teclado className="tec" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}>
          <div className="tec-bar"><button className="tec-ok" onClick={onOk}>OK</button></div>
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
