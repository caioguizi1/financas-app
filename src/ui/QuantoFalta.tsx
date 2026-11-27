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

export function FolgaSheet({ fut }: { fut: Ponto[] }) {
  const f = folgaApertada(fut);
  if (!f) return <><SheetHeader title="Folga apertada" /><p className="mut">A folga não está mais apertada.</p></>;
  const ver = () => {
    closeSheet();
    const ui = useUI.getState();
    ui.setVisao('futuro');
    ui.setMarcas({ modo: 'folga', titulo: 'Dia mais apertado', pontos: [{ d: f.dia, rot: `Mais apertado · ${brl(f.folga)} ${quando(fut, f.dia)}`, tipo: 'aperto' }], faixas: [] });
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
  const varias = q.etapas.length > 1;
  const vezes = q.trechos.length > 1 ? `${q.trechos.length} vezes no negativo` : `${dias(q.dias)} no negativo`;
  const resto = q.repete ? 'se repete todo mês' : vezes;
  return (
    <button className="qf" onClick={() => openSheet(<QuantoFaltaSheet fut={fut} voltaPor={voltaPor} />)}
      aria-label={`Pra não ficar negativo: faltam ${brl(q.falta)} até ${dm(q.ate)}${varias ? `, sendo ${brl(q.etapas[0].valor)} já até ${dm(q.etapas[0].ate)}` : ''}. ${resto}. Ver detalhes`}>
      <span className="qf-ic"><Ico n="alerta" size={18} /></span>
      <span className="qf-txt">
        <span className="qf-t">Faltam <b>{brl(q.falta)}</b> até {dm(q.ate)}</span>
        {/* uma linha só: com etapas, o urgente (quanto já até a 1ª vez) + quantas vezes ou "se repete" */}
        <span className="qf-s">{varias ? <><b>{brl(q.etapas[0].valor)}</b> já até {dm(q.etapas[0].ate)} · {q.repete ? 'se repete' : `${q.trechos.length} vezes`}</> : <>pra não ficar negativo · {resto}</>}</span>
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
  const varias = q.etapas.length > 1;
  // a vez mais funda é a que leva o total
  const iPior = q.trechos.reduce((k, t, j) => (t.pior.v < q.trechos[k].pior.v ? j : k), 0);
  const periodo = (t: (typeof q.trechos)[number]) => {
    const fim = t.volta ? fut[fut.findIndex((p) => p.d === t.volta!.d) - 1]?.d : fut[fut.length - 1].d;
    return fim && fim !== t.inicio.d ? `${dm(t.inicio.d)} a ${dm(fim)}` : dm(t.inicio.d);
  };
  const verNoGrafico = () => {
    // uma bolinha por vez no negativo, no pior dia dela; a mais funda destacada
    const pontos = q.trechos.map((t, j) => ({
      d: t.pior.d, n: q.trechos.length > 1 ? j + 1 : undefined, tipo: (j === iPior ? 'pior' : 'trecho') as 'pior' | 'trecho',
      // v2.51: a mais funda diz por que está destacada — é ela que define o total do cartão
      rot: q.trechos.length > 1 ? `${periodo(t)} · ${brl(t.pior.v)}` : `pior ${brl(t.pior.v)} em ${dm(t.pior.d)}`,
      nota: q.trechos.length > 1 && j === iPior ? 'a mais funda · define o total' : undefined,
    }));
    const faixas = q.trechos.map((t) => ({ de: t.inicio.d, ate: t.volta?.d ?? fut[fut.length - 1].d }));
    closeSheet();
    const ui = useUI.getState();
    ui.setVisao('futuro');
    ui.setMarcas({ modo: 'negativo', titulo: q.trechos.length > 1 ? `${q.trechos.length} vezes no negativo` : 'Dias no negativo', pontos, faixas });
    requestAnimationFrame(() => document.querySelector('main.on .chart')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  return (
    <>
      <SheetHeader title="Pra não ficar negativo" />
      <div className="qfs">
        <div className="qfs-v">Faltam <b>{brl(q.falta)}</b></div>
        <div className="qf-s">{varias ? <>no total, até <b>{dm(q.ate)}</b> — em etapas, veja abaixo</> : <>até <b>{dm(q.ate)}</b>, o 1º dia no negativo</>}</div>
        <Barra fut={fut} q={q} />
        <div className="qf-leg"><span>hoje</span><span>90 dias</span></div>
        {varias && (
          <div className="qfs-etapas">
            <div className="qfs-h">Quando precisa entrar</div>
            {q.etapas.map((e, k) => (
              <div key={e.ate} className="qfs-e"><span>Até <b>{dm(e.ate)}</b> <small>· começo da {e.trecho + 1}ª vez</small></span><b>{k ? 'mais ' : ''}{brl(e.valor)}</b></div>
            ))}
            <div className="qfs-e tot"><span>Total</span><b>{brl(q.falta)}</b></div>
          </div>
        )}
        <dl className="qfs-l">
          <div><dt>Dias no negativo</dt><dd>{dias(q.dias)}</dd></div>
          {q.trechos.length > 1 && <div><dt>Vezes no negativo</dt><dd>{q.trechos.length} vezes</dd></div>}
          <div><dt>Pior momento</dt><dd className="neg">{brl(q.pior.v)} <small>{dm(q.pior.d)}</small></dd></div>
          {q.trechos.length === 1 && (t0.volta
            ? <div><dt>Volta ao positivo</dt><dd>{dm(t0.volta.d)}{voltaPor ? <small> · {voltaPor}</small> : null}</dd></div>
            : <div><dt>Volta ao positivo</dt><dd><small>não nos próximos 90 dias</small></dd></div>)}
        </dl>
        <p className="qf-p">{varias ? 'Entrando esses valores até essas datas' : `Entrando ${brl(q.falta)} até ${dm(q.ate)}`}, ou cortando isso em gastos até lá, o saldo não fica negativo nos próximos 90 dias.</p>
        {q.repete && q.trechos[1] && <p className="qf-rep">Isso se repete: fica negativo de novo em {dm(q.trechos[1].inicio.d)}. Seu saldo cai em média <b>{brl(q.quedaMes)} por mês</b> — uma entrada única só adia.</p>}
        <details className="qfs-como">
          <summary>De onde vêm esses números</summary>
          <p>Da mesma projeção do gráfico: o saldo que você informou, mais o que entra e sai em cada dia dos próximos 90 — fixos, lançamentos e parcelas futuras, faturas dos cartões e a estimativa do gasto típico dos cartões que ainda não foi lançado.</p>
          <p>Em cada vez que o saldo fica negativo, o valor é o quanto ele fica abaixo de zero no pior dia daquela vez, e o prazo é o dia em que ela começa (dali até o pior dia o saldo só piora). O que entra para cobrir uma vez continua na conta e cobre as seguintes — por isso cada etapa pede só a diferença.</p>
        </details>
      </div>
      <div className="sl-foot"><button className="btn primary" onClick={verNoGrafico}><Ico n="futuro" size={18} />Ver no gráfico</button></div>
    </>
  );
}
