import { AnimatePresence, m } from 'motion/react';
import { useRef, type ReactNode } from 'react';
import { catN } from '../lib/categories';
import type { Sugestao } from '../lib/smart';
import { springSnappy } from './motion';
import { CatGlyph } from './CatIco';
import { Ico } from './Ico';

/** Campo de descrição com o ícone sugerido "pulando" à esquerda. */
export function SmartDesc({ value, onChange, ico, cat, placeholder, autoFocus }: {
  value: string; onChange: (v: string) => void; ico: string; cat: string; placeholder: string; autoFocus?: boolean;
}) {
  return (
    <div className="smart-desc">
      <div className="smart-ico">
        {/* "pulo" do ícone em CSS; na abertura não anima (só quando a categoria muda) */}
        <IcoPula k={ico + cat}><CatGlyph cat={cat} ico={ico} size={19} solo /></IcoPula>
      </div>
      <input className="field" placeholder={placeholder} value={value} autoFocus={autoFocus} enterKeyHint="done"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
    </div>
  );
}

/** Linha "✨ sugerido" abaixo do campo. */
export function SmartHint({ sug, aplicada, atual, onUsar }: { sug: Sugestao | null; aplicada: boolean; atual?: string; onUsar?: () => void }) {
  const show = !!sug && (aplicada || sug.cat !== atual);
  return (
    <AnimatePresence presenceAffectsLayout={false} initial={false}>
      {show && sug && (
        <m.div className="smart-hint" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={springSnappy}>
          <span className="spark"><Ico n="sugerido" size={14} /></span>
          {aplicada ? 'Categoria' : 'Sugestão'}: <b><CatGlyph cat={sug.cat} ico={sug.ico} size={14} />{catN(sug.cat)}</b>
          <span className="dim"> · {sug.fonte === 'aprendido' ? 'aprendido com você' : 'pelo dicionário'}</span>
          {!aplicada && onUsar && <button className="sug-usar" onClick={onUsar}>Usar</button>}
        </m.div>
      )}
    </AnimatePresence>
  );
}

function IcoPula({ k, children }: { k: string; children: ReactNode }) {
  const primeiro = useRef(k);
  return <span key={k} className={k !== primeiro.current ? 'pula' : ''}>{children}</span>;
}
