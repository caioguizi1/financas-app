import { m } from 'motion/react';
import { useId, useRef } from 'react';
import { MES, parse } from '../lib/dates';
import type { Ponto } from '../lib/engine';

const W = 340, H = 140, PT = 14, PB = 10;

/** Saldo projetado em degraus; arrastar mostra o dia. Abaixo de zero fica vermelho. */
/** `ghost`: projeção com uma compra simulada (linha tracejada por cima; mesmas datas de `pts`). */
/** marca um dia no gráfico — some ao tocar no gráfico. `n`: número da vez no negativo (1, 2, 3…);
 *  "pior" = a vez mais funda (destacada), "trecho" = as outras, "aperto" = dia mais apertado (âmbar). */
export interface MarcaGrafico { d: string; rot: string; tipo: 'trecho' | 'pior' | 'aperto'; n?: number }
/** trecho a sombrear no gráfico (ex.: cada vez que o saldo fica negativo) */
export interface FaixaGrafico { de: string; ate: string }

export function BalanceChart({ pts, onScrub, ghost, marcas, faixas, onToque }: { pts: Ponto[]; onScrub: (i: number | null) => void; ghost?: Ponto[]; marcas?: MarcaGrafico[]; faixas?: FaixaGrafico[]; onToque?: () => void }) {
  const id = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const crossRef = useRef<SVGLineElement>(null);
  const n = pts.length;
  const vals = pts.map((p) => p.v);
  const gmap = ghost ? new Map(ghost.map((p) => [p.d, p.v])) : null;
  const gvals = gmap ? pts.map((p) => gmap.get(p.d) ?? p.v) : [];
  const vmin = Math.min(0, ...vals, ...gvals);
  const vmax = Math.max(...vals, ...gvals, 1);
  const sy = (v: number) => PT + (H - PT - PB) * (1 - (v - vmin) / (vmax - vmin || 1));
  const sx = (i: number) => (i / Math.max(1, n - 1)) * W;

  let line = '';
  pts.forEach((p, i) => { const X = sx(i).toFixed(1), Y = sy(p.v).toFixed(1); line += i ? ` H${X} V${Y}` : `M${X} ${Y}`; });
  const area = `${line} V${H} H0 Z`;
  let gline = '';
  gvals.forEach((v, i) => { const X = sx(i).toFixed(1), Y = sy(v).toFixed(1); gline += i ? ` H${X} V${Y}` : `M${X} ${Y}`; });
  const zeroY = sy(0);
  const neg = vals.some((v) => v < 0);
  const ticks = pts.map((p, i) => (p.d.endsWith('-01') ? i : -1)).filter((i) => i > 0);

  const scrub = (clientX: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - r.left, 0), r.width);
    const i = Math.round((x / r.width) * (n - 1));
    crossRef.current?.setAttribute('x1', String(sx(i)));
    crossRef.current?.setAttribute('x2', String(sx(i)));
    crossRef.current?.style.setProperty('opacity', '1');
    onScrub(i);
  };
  const end = () => { crossRef.current?.style.setProperty('opacity', '0'); onScrub(null); };

  return (
    <div
      className="chart"
      onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); onToque?.(); scrub(e.clientX); }}
      onPointerMove={(e) => (e.buttons || e.pointerType === 'mouse') && scrub(e.clientX)}
      onPointerUp={end} onPointerLeave={end} onPointerCancel={end}
    >
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Saldo projetado nos próximos 90 dias">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6E5BFF" stopOpacity=".5" /><stop offset=".7" stopColor="#6E5BFF" stopOpacity=".06" /><stop offset="1" stopColor="#6E5BFF" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`a${id}`}><rect x="0" y="0" width={W} height={zeroY} /></clipPath>
          <clipPath id={`b${id}`}><rect x="0" y={zeroY} width={W} height={H} /></clipPath>
          {/* revela a linha da esquerda pra direita. Não usar pathLength: com vector-effect=non-scaling-stroke
              o Safari ignora o pathLength e desenha o tracejado "1px 1px" literal (linha pontilhada/oca, cortada no fim). */}
          <clipPath id={`r${id}`}><m.rect x="0" y="0" height={H} initial={{ width: 0 }} animate={{ width: W }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} /></clipPath>
        </defs>
        {faixas?.map((f) => {
          const a = pts.findIndex((p) => p.d === f.de), b0 = pts.findIndex((p) => p.d === f.ate), b = b0 < 0 ? n - 1 : b0;
          return a < 0 ? null : <m.rect key={f.de} className="ch-faixa" x={sx(a)} y={0} width={Math.max(1.5, sx(b) - sx(a))} height={H} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} />;
        })}
        {ticks.map((i) => <line key={i} x1={sx(i)} x2={sx(i)} y1={PT} y2={H} stroke="rgba(255,255,255,.07)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />)}
        {neg && <line x1="0" x2={W} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,.25)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        <m.path d={area} fill={`url(#g${id})`} clipPath={`url(#a${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.35 }} />
        <g clipPath={`url(#r${id})`}>
          <path d={line} fill="none" stroke="#9A8CFF" strokeOpacity={0.25} strokeWidth={7} vectorEffect="non-scaling-stroke" strokeLinejoin="round" clipPath={`url(#a${id})`} />
          <path d={line} fill="none" stroke="#B9AFFF" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" clipPath={`url(#a${id})`} />
          <path d={line} fill="none" stroke="#E0577F" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" clipPath={`url(#b${id})`} />
        </g>
        {gline && <path className="ghost" d={gline} fill="none" stroke="#F2B35B" strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
        <line ref={crossRef} x1="0" x2="0" y1={PT - 6} y2={H} stroke="rgba(255,255,255,.55)" vectorEffect="non-scaling-stroke" style={{ opacity: 0 }} />
      </svg>
      {marcas && marcas.length > 0 && (
        <div className="ch-marcas">
          {marcas.map((mk) => {
            const i = pts.findIndex((p) => p.d === mk.d);
            if (i < 0) return null;
            // o valor do dia vale do começo dele até o dia seguinte (gráfico em degraus): marca no meio do degrau
            const x = (sx(i) + sx(Math.min(n - 1, i + 1))) / 2;
            // x/y do motion: um transform no CSS seria sobrescrito pela animação (a marca ficava meio tamanho fora do lugar)
            return (
              <m.span key={mk.d + mk.tipo} className={`ch-marca ${mk.tipo}${mk.n ? ' num' : ''}`} style={{ left: `${(x / W) * 100}%`, top: `${(sy(pts[i].v) / H) * 100}%`, x: '-50%', y: '-50%' }}
                initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 24 }}>{mk.n ?? null}</m.span>
            );
          })}
        </div>
      )}
      <div className="xl">
        <span style={{ left: 6 }}>hoje</span>
        {ticks.filter((i) => i > n * 0.16 && i < n * 0.86).map((i) => (
          <span key={i} style={{ left: `${((i / (n - 1)) * 100).toFixed(2)}%` }}>{MES[parse(pts[i].d).getMonth()]}</span>
        ))}
        <span style={{ left: 'calc(100% - 6px)' }}>90 dias</span>
      </div>
      {marcas && marcas.length > 0 && (
        <m.div className="ch-leg" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} aria-live="polite">
          {marcas.map((mk) => <span key={mk.d + mk.tipo}><i className={`ch-ico ${mk.tipo}${mk.n ? ' num' : ''}`} aria-hidden>{mk.n ?? null}</i>{mk.rot}</span>)}
        </m.div>
      )}
    </div>
  );
}
