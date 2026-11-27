/**
 * Início · "Pra não ficar negativo" (v2.47): cartão compacto no lugar do aviso vermelho; tocar abre o detalhe.
 * Cálculo em src/lib/quantoFalta.ts.
 */
import type { Ponto } from '../lib/engine';
import { brl } from '../lib/money';
import { folgaApertada, quantoFalta, type FolgaApertada, type QuantoFalta as QF } from '../lib/quantoFalta';
import { closeSheet, openSheet, useUI } from '../store';
import { Ico } from './Ico';
import { SheetHeader } from './Sheet';

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const dias = (n: number) => `${n} dia${n > 1 ? 's' : ''}`;

function Barra({ fut, q }: { fut: Ponto[]; q: QF }) {
  const n = fut.length - 1;
  const pos = (d: string) => (Math.max(0, fut.findIndex((p) => p.d === d)) / n) * 100;
  return (
    <span className="qf-bar" aria-hidden>
      {q.trechos.map((t, i) => {
        const a = pos(t.inicio.d), b = t.volta ? pos(t.volta.d) : 100;
        return <span key={i} className="qf-neg" style={{ left: `${a}%`, width: `${Math.max(1.5, b - a)}%` }} />;
      })}
      <span className="qf-pin" style={{ left: `${pos(q.pior.d)}%` }} />
    </span>
  );
}

/** Barrinha da folga: sem trecho vermelho, só o dia mais apertado marcado. */
function BarraFolga({ fut, f }: { fut: Ponto[]; f: FolgaApertada }) {
  const i = Math.max(0, fut.findIndex((p) => p.d === f.dia));
  return <span className="qf-bar folga" aria-hidden><span className="qf-pin" style={{ left: `${(i / (fut.length - 1)) * 100}%` }} /></span>;
}

/** Folga apertada: não fica negativo, mas o dia mais apertado fica perto de zero (âmbar). */
/** "hoje" quando o dia mais apertado é hoje */
const quando = (fut: Ponto[], d: string) => (d === fut[0]?.d ? 'hoje' : `em ${dm(d)}`);

function Folga({ fut, f }: { fut: Ponto[]; f: FolgaApertada }) {
  return (
    <button className="qf folga" onClick={() => openSheet(<FolgaSheet fut={fut} />)}
      aria-label={`Folga apertada: no dia mais apertado (${quando(fut, f.dia)}) sobram ${brl(f.folga)}. Ver detalhes`}>
      <span className="qf-ic"><Ico n="info" size={18} /></span>
      <span className="qf-txt">
        <span className="qf-t">Folga de <b>{brl(f.folga)}</b> {quando(fut, f.dia)}</span>
        <span className="qf-s">não fica negativo, mas chega perto</span>
        <BarraFolga fut={fut} f={f} />
      </span>
      <Ico n="avancar" size={18} className="qf-chev" />
    </button>
  );
}

function FolgaSheet({ fut }: { fut: Ponto[] }) {
  const f = folgaApertada(fut);
  if (!f) return <><SheetHeader title="Folga apertada" /><p className="mut">A folga não está mais apertada.</p></>;
  const ver = () => {
    closeSheet();
    const ui = useUI.getState();
    ui.setVisao('futuro');
    ui.setMarcas({ pontos: [{ d: f.dia, rot: `Mais apertado · ${brl(f.folga)} ${quando(fut, f.dia)}`, tipo: 'aperto' }], faixas: [] });
    requestAnimationFrame(() => document.querySelector('main.on .chart')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  return (
    <>
      <SheetHeader title="Folga apertada" />
      <div className="qfs folga">
        <div className="qfs-v">Folga de <b>{brl(f.folga)}</b></div>
        <div className="qf-s">no dia mais apertado: <b>{f.dia === fut[0]?.d ? 'hoje' : dm(f.dia)}</b></div>
        <BarraFolga fut={fut} f={f} />
        <div className="qf-leg"><span>hoje</span><span>90 dias</span></div>
        <p className="qf-p">O saldo não fica negativo nos próximos 90 dias. Mas um gasto a mais acima de <b>{brl(f.folga)}</b> {f.dia === fut[0]?.d ? 'hoje' : `até ${dm(f.dia)}`} deixa o saldo negativo.</p>
      </div>
      <div className="sl-foot"><button className="btn primary" onClick={ver}><Ico n="futuro" size={18} />Ver no gráfico</button></div>
    </>
  );
}

/**
 * Cartão compacto do Início: vermelho quando falta dinheiro ("Faltam R$ X até DD/MM"), âmbar quando a folga
 * está apertada, e nada quando está tranquilo.
 */
export function QuantoFalta({ fut, voltaPor }: { fut: Ponto[]; voltaPor?: string }) {
  const q = quantoFalta(fut);
  if (!q) { const f = folgaApertada(fut); return f ? <Folga fut={fut} f={f} /> : null; }
  return (
    <button className="qf" onClick={() => openSheet(<QuantoFaltaSheet fut={fut} voltaPor={voltaPor} />)}
      aria-label={`Pra não ficar negativo: faltam ${brl(q.falta)} até ${dm(q.ate)}. ${q.repete ? 'Se repete todo mês.' : `${dias(q.dias)} no negativo.`} Ver detalhes`}>
      <span className="qf-ic"><Ico n="alerta" size={18} /></span>
      <span className="qf-txt">
        <span className="qf-t">Faltam <b>{brl(q.falta)}</b> até {dm(q.ate)}</span>
        <span className="qf-s">pra não ficar negativo · {q.repete ? 'se repete todo mês' : `${dias(q.dias)} no negativo`}</span>
        <Barra fut={fut} q={q} />
      </span>
      <Ico n="avancar" size={18} className="qf-chev" />
    </button>
  );
}

export function QuantoFaltaSheet({ fut, voltaPor }: { fut: Ponto[]; voltaPor?: string }) {
  const q = quantoFalta(fut);
  if (!q) return <><SheetHeader title="Pra não ficar negativo" /><p className="mut">Nos próximos 90 dias o saldo não fica negativo.</p></>;
  const t0 = q.trechos[0];
  const verNoGrafico = () => {
    const pontos = q.pior.d === q.ate
      ? [{ d: q.ate, rot: `1º dia negativo e pior · ${brl(q.pior.v)} em ${dm(q.ate)}`, tipo: 'pior' as const }]
      : [{ d: q.ate, rot: `1º dia negativo · ${dm(q.ate)}`, tipo: 'inicio' as const }, { d: q.pior.d, rot: `Pior · ${brl(q.pior.v)} em ${dm(q.pior.d)}`, tipo: 'pior' as const }];
    const faixas = q.trechos.map((t) => ({ de: t.inicio.d, ate: t.volta?.d ?? fut[fut.length - 1].d }));
    closeSheet();
    const ui = useUI.getState();
    ui.setVisao('futuro');
    ui.setMarcas({ pontos, faixas });
    requestAnimationFrame(() => document.querySelector('main.on .chart')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  return (
    <>
      <SheetHeader title="Pra não ficar negativo" />
      <div className="qfs">
        <div className="qfs-v">Faltam <b>{brl(q.falta)}</b></div>
        <div className="qf-s">até <b>{dm(q.ate)}</b>, o 1º dia no negativo</div>
        <Barra fut={fut} q={q} />
        <div className="qf-leg"><span>hoje</span><span>90 dias</span></div>
        <dl className="qfs-l">
          <div><dt>Dias no negativo</dt><dd>{dias(q.dias)}</dd></div>
          <div><dt>Pior momento</dt><dd className="neg">{brl(q.pior.v)} <small>{dm(q.pior.d)}</small></dd></div>
          {t0.volta && <div><dt>{q.trechos.length > 1 ? 'Sai do negativo' : 'Volta ao positivo'}</dt><dd>{dm(t0.volta.d)}{voltaPor ? <small> · {voltaPor}</small> : null}</dd></div>}
          {!t0.volta && <div><dt>Volta ao positivo</dt><dd><small>não nos próximos 90 dias</small></dd></div>}
          {q.trechos.length > 1 && <div><dt>Vezes no negativo</dt><dd>{q.trechos.length} vezes</dd></div>}
        </dl>
        <p className="qf-p">Entrando {brl(q.falta)} até {dm(q.ate)}, ou cortando esse valor em gastos até lá, o saldo não fica negativo nos próximos 90 dias.</p>
        {q.repete && q.trechos[1] && <p className="qf-rep">Isso se repete: fica negativo de novo em {dm(q.trechos[1].inicio.d)}. Seu saldo cai em média <b>{brl(q.quedaMes)} por mês</b> — uma entrada única só adia.</p>}
      </div>
      <div className="sl-foot"><button className="btn primary" onClick={verNoGrafico}><Ico n="futuro" size={18} />Ver no gráfico</button></div>
    </>
  );
}
