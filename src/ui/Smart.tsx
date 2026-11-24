import { AnimatePresence, m } from 'motion/react';
import { catE, catN } from '../lib/categories';
import type { Sugestao } from '../lib/smart';
import { springSnappy } from './motion';
import { Ico } from './Ico';

/** Campo de descrição com o ícone sugerido "pulando" à esquerda. */
export function SmartDesc({ value, onChange, ico, placeholder, autoFocus }: {
  value: string; onChange: (v: string) => void; ico: string; placeholder: string; autoFocus?: boolean;
}) {
  return (
    <div className="smart-desc">
      <div className="smart-ico">
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span key={ico} initial={{ scale: 0.3, rotate: -25, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 18 }}>
            {ico}
          </m.span>
        </AnimatePresence>
      </div>
      <input className="field" placeholder={placeholder} value={value} autoFocus={autoFocus} enterKeyHint="done"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
    </div>
  );
}

/** Linha "✨ sugerido" abaixo do campo. */
export function SmartHint({ sug, aplicada, atual }: { sug: Sugestao | null; aplicada: boolean; atual?: string }) {
  const show = !!sug && (aplicada || sug.cat !== atual);
  return (
    <AnimatePresence initial={false}>
      {show && sug && (
        <m.div className="smart-hint" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={springSnappy}>
          <span className="spark"><Ico n="sugerido" size={14} /></span>
          {aplicada ? 'Categoria' : 'Sugestão'}: <b>{sug.ico || catE(sug.cat)} {catN(sug.cat)}</b>
          <span className="dim"> · {sug.fonte === 'aprendido' ? 'aprendido com você' : 'pelo dicionário'}</span>
        </m.div>
      )}
    </AnimatePresence>
  );
}
