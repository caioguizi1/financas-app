import { AnimatePresence, m } from 'motion/react';
import { dm } from '../lib/dates';
import { centsToStr } from '../lib/money';
import { Keypad } from './Money';
import { springSnappy } from './motion';

export interface Linha { label: string; valor: number; data?: string; fixo?: boolean }

/**
 * Vários valores com UM teclado: toque na linha pra escolher qual está editando.
 * Linhas com data mostram um seletor de data.
 */
export function ValueRows({ linhas, ativa, onAtiva, onValor, onData }: {
  linhas: Linha[]; ativa: number; onAtiva: (i: number) => void; onValor: (i: number, v: number) => void; onData?: (i: number, d: string) => void;
}) {
  return (
    <>
      <div className="vrows">
        {linhas.map((l, i) => (
          <m.div key={l.label} layout className={`vrow ${i === ativa ? 'on' : ''} ${l.fixo ? 'ro' : ''}`} onClick={() => !l.fixo && onAtiva(i)} transition={springSnappy}>
            {i === ativa && !l.fixo && <m.span layoutId="vrow-pill" className="vrow-pill" transition={springSnappy} />}
            <div className="vr-l">
              <div className="vr-t">{l.label}</div>
              {l.data && onData && (
                <label className="vr-d" onClick={(e) => e.stopPropagation()}>
                  📅 {dm(l.data)}/{l.data.slice(2, 4)}
                  <input type="date" value={l.data} onChange={(e) => e.target.value && onData(i, e.target.value)} className="date-overlay" />
                </label>
              )}
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              <m.div key={l.valor} className={`vr-v num ${l.valor ? '' : 'zero'}`} initial={{ y: -6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} transition={springSnappy}>
                <small>R$</small>{centsToStr(l.valor)}
              </m.div>
            </AnimatePresence>
          </m.div>
        ))}
      </div>
      <Keypad small value={linhas[ativa]?.valor ?? 0} onChange={(v) => onValor(ativa, v)} />
    </>
  );
}
