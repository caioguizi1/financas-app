import { useRef, useState } from 'react';
import { enquadrar, PROP, type Caixa, type FonteRecorte } from '../lib/imagens';

/**
 * Ajuste fino do recorte: arrastar posiciona, o controle aproxima.
 * Começa no enquadramento automático. A moldura tem o formato exato do cartão.
 */
export function Recorte({ fonte, caixa, onChange }: { fonte: FonteRecorte; caixa: Caixa; onChange: (c: Caixa) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ x: number; y: number; c: Caixa } | null>(null);
  const [vw, setVw] = useState(0);
  const escala = vw ? vw / caixa.w : 0;
  const maxW = Math.min(fonte.w, fonte.h * PROP);
  const minW = maxW * 0.2;

  const limitar = (c: Caixa) => ({ ...c, x: Math.max(0, Math.min(fonte.w - c.w, c.x)), y: Math.max(0, Math.min(fonte.h - c.h, c.y)) });
  const zoom = (w: number) => {
    const nw = Math.max(minW, Math.min(maxW, w));
    const cx = caixa.x + caixa.w / 2, cy = caixa.y + caixa.h / 2;
    onChange(limitar({ x: cx - nw / 2, y: cy - nw / PROP / 2, w: nw, h: nw / PROP }));
  };

  return (
    <div className="rec">
      <div
        className="rec-vp"
        ref={(el) => { ref.current = el; if (el && el.clientWidth !== vw) setVw(el.clientWidth); }}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); arrasto.current = { x: e.clientX, y: e.clientY, c: caixa }; }}
        onPointerMove={(e) => {
          const a = arrasto.current; if (!a || !escala) return;
          onChange(limitar({ ...a.c, x: a.c.x - (e.clientX - a.x) / escala, y: a.c.y - (e.clientY - a.y) / escala }));
        }}
        onPointerUp={() => (arrasto.current = null)}
        onPointerCancel={() => (arrasto.current = null)}
      >
        {escala > 0 && (
          <img src={fonte.url} alt="" draggable={false}
            style={{ width: fonte.w * escala, height: fonte.h * escala, transform: `translate(${-caixa.x * escala}px, ${-caixa.y * escala}px)` }} />
        )}
      </div>
      <div className="rec-ctl">
        <span>－</span>
        <input type="range" min={0} max={1000} value={Math.round(((maxW - caixa.w) / (maxW - minW || 1)) * 1000)} onChange={(e) => zoom(maxW - ((maxW - minW) * +e.target.value) / 1000)} aria-label="Aproximar" />
        <span>＋</span>
      </div>
      <div className="dim hint" style={{ textAlign: 'center' }}>Arraste pra posicionar · deslize pra aproximar</div>
      <button className="rec-auto" onClick={() => onChange(enquadrar(fonte.caixa, fonte.w, fonte.h))}>↺ Voltar ao automático</button>
    </div>
  );
}
