/**
 * Início · "Pra não ficar negativo" (v2.47): cartão compacto no lugar do aviso vermelho; tocar abre o detalhe.
 * Cálculo em src/lib/quantoFalta.ts.
 */
import type { Ponto } from '../lib/engine';
import { brl } from '../lib/money';
import { quantoFalta, type QuantoFalta as QF } from '../lib/quantoFalta';
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

/** Cartão compacto: valor, prazo e a barrinha dos 90 dias. Nada a mostrar quando não fica negativo. */
export function QuantoFalta({ fut, voltaPor }: { fut: Ponto[]; voltaPor?: string }) {
  const q = quantoFalta(fut);
  if (!q) return null;
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
    const marcas = q.pior.d === q.ate
      ? [{ d: q.ate, rot: `1º dia negativo · pior ${brl(q.pior.v)}` }]
      : [{ d: q.ate, rot: '1º dia negativo', baixo: true }, { d: q.pior.d, rot: `pior · ${brl(q.pior.v)}` }];
    closeSheet();
    const ui = useUI.getState();
    ui.setVisao('futuro');
    ui.setMarcas(marcas);
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
