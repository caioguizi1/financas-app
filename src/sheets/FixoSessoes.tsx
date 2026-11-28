/**
 * v2.54 · Partes do fixo para quem paga por sessão (ex.: terapia): como paga (a cada sessão / junto no fim
 * do mês), reembolso no mês seguinte, pausas (férias) e o resumo dos próximos meses.
 * Regras de cálculo em src/lib/recorrencia.ts (pagamentosAgrupados, reembolsosDoFixo, pausado).
 */
import { useState } from 'react';
import { addDays, addMonths, dm, monthKey, MES, today } from '../lib/dates';
import { brl } from '../lib/money';
import { agrupado, ocorrencias, sessoesNoMes } from '../lib/recorrencia';
import type { Recorrente } from '../lib/types';
import { Chip, Segmented, Stepper } from '../ui/Controls';
import { Ico } from '../ui/Ico';

type R = Omit<Recorrente, 'id' | 'inicio' | 'dia'> & Partial<Pick<Recorrente, 'id' | 'inicio'>> & { dia: number | null };
type Set = (p: Partial<R>) => void;
const PCTS = [50, 80, 100];
const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

/** Como paga + reembolso: só para semanal (cada ocorrência é uma sessão). */
export function PagaEReembolso({ r, set, nomeDia }: { r: R; set: Set; nomeDia: string }) {
  const [outro, setOutro] = useState(!!r.reembolso && !PCTS.includes(r.reembolso.pct));
  const noCartao = !!r.cartaoId;
  return (
    <>
      {!noCartao && (
        <>
          <div className="lab">Como paga</div>
          <Segmented value={r.agrupar ? 'mes' : 'sessao'} onChange={(v) => set({ agrupar: v === 'mes' ? { dia: r.agrupar?.dia ?? 30 } : undefined })}
            options={[{ v: 'sessao', label: 'A cada sessão' }, { v: 'mes', label: 'Junto, no fim do mês' }]} />
          {r.agrupar && (<>
            <div className="fs-linha">
              <span>Pago no dia</span>
              <Stepper value={r.agrupar.dia} min={1} max={31} onChange={(dia) => set({ agrupar: { dia } })} fmt={(v) => String(v)} />
            </div>
            <div className="dim hint">Soma as {nomeDia}s do mês num pagamento só{r.agrupar.dia > 28 ? ' (em mês mais curto, no último dia)' : ''}.</div>
          </>)}
        </>
      )}
      <div className="lab">Reembolso</div>
      <div className="fs-card">
        <div className="fs-row">
          <span>Tenho reembolso</span>
          <button className={`fs-sw${r.reembolso ? ' on' : ''}`} role="switch" aria-checked={!!r.reembolso} aria-label="Tenho reembolso"
            onClick={() => set({ reembolso: r.reembolso ? undefined : { pct: 100, dia: 7 } })}><i /></button>
        </div>
        {r.reembolso && (
          <>
            <div className="fs-row">
              <span>Quanto volta</span>
              <div className="chips">
                {PCTS.map((p) => <Chip key={p} on={!outro && r.reembolso!.pct === p} onClick={() => { setOutro(false); set({ reembolso: { ...r.reembolso!, pct: p } }); }}>{p}%</Chip>)}
                <Chip on={outro} onClick={() => setOutro(true)}>Outro</Chip>
              </div>
            </div>
            {outro && (
              <div className="fs-row"><span>Percentual</span><Stepper value={r.reembolso.pct} min={1} max={100} onChange={(pct) => set({ reembolso: { ...r.reembolso!, pct } })} fmt={(v) => `${v}%`} /></div>
            )}
            <div className="fs-row">
              <span>Cai até o dia</span>
              <Stepper value={r.reembolso.dia} min={1} max={28} onChange={(dia) => set({ reembolso: { ...r.reembolso!, dia } })} fmt={(v) => String(v)} />
            </div>
            <div className="fs-nota"><Ico n="info" size={15} /><span>Cai no <b>mês seguinte</b> às sessões. Pode cair antes, mas o app só conta com ele no dia {r.reembolso.dia} — o lado seguro. Quando cair antes, ele pergunta ao conferir o saldo.</span></div>
          </>
        )}
      </div>
    </>
  );
}

/** Pausas (férias): as ocorrências dentro delas não contam. Vale para qualquer frequência. */
export function Pausas({ r, set, rotulo }: { r: R; set: Set; rotulo: string }) {
  const hoje = today();
  const [novo, setNovo] = useState<{ de: string; ate: string } | null>(null);
  const pausas = r.pausas ?? [];
  const quantas = (p: { de: string; ate: string }) => (r.freq === 'semanal' || r.freq === 'anual')
    ? ocorrencias({ ...(r as Recorrente), inicio: '2000-01', pausas: undefined }, p.de, p.ate).length : null;
  const salvarNova = () => {
    if (!novo || !novo.de || !novo.ate) return;
    const p = novo.de <= novo.ate ? novo : { de: novo.ate, ate: novo.de };
    set({ pausas: [...pausas, p].sort((a, b) => a.de.localeCompare(b.de)) });
    setNovo(null);
  };
  return (
    <>
      <div className="lab">Pausas</div>
      <div className="fs-card">
        {pausas.map((p, i) => {
          const n = quantas(p);
          const passou = p.ate < hoje;
          return (
            <div key={p.de + p.ate} className={`fs-pausa${passou ? ' passou' : ''}`}>
              <Ico n="cronograma" size={16} />
              <span><b>{dm(p.de)} a {dm(p.ate)}</b><small>{passou ? 'já passou · ' : ''}{n != null ? `${plural(n, rotulo, `${rotulo}s`)} sem ${r.tipo === 'saida' ? 'cobrança' : 'recebimento'}` : 'sem cobrança no período'}</small></span>
              <button className="fs-x" aria-label={`Tirar a pausa de ${dm(p.de)} a ${dm(p.ate)}`} onClick={() => set({ pausas: pausas.filter((_, j) => j !== i).length ? pausas.filter((_, j) => j !== i) : undefined })}><Ico n="fechar" size={15} /></button>
            </div>
          );
        })}
        {novo ? (
          <div className="fs-nova">
            <label><span>De</span><input type="date" className="field" value={novo.de} onChange={(e) => setNovo({ ...novo, de: e.target.value })} aria-label="Pausa de" /></label>
            <label><span>Até</span><input type="date" className="field" value={novo.ate} onChange={(e) => setNovo({ ...novo, ate: e.target.value })} aria-label="Pausa até" /></label>
            <div className="fs-nova-b"><button className="btn ghost" onClick={() => setNovo(null)}>Cancelar</button><button className="btn primary" disabled={!novo.de || !novo.ate} onClick={salvarNova}>Pausar</button></div>
          </div>
        ) : (
          <button className="fs-add" onClick={() => setNovo({ de: hoje, ate: addDays(hoje, 14) })}>＋ Pausar um período</button>
        )}
      </div>
    </>
  );
}

/** Resumo dos próximos meses (só semanal): sessões, quanto sai e quando, e o reembolso. */
export function ProximosMeses({ r }: { r: R }) {
  if (r.freq !== 'semanal' || r.semana == null || !r.valor) return null;
  const rr = { ...(r as Recorrente), id: r.id ?? 'novo', inicio: r.inicio ?? monthKey(today()), dia: r.dia ?? 1 };
  const mk0 = monthKey(today());
  const linhas = [0, 1, 2, 3].map((i) => {
    const mk = addMonths(mk0, i);
    const n = sessoesNoMes(rr, mk).length;
    const todas = sessoesNoMes({ ...rr, pausas: undefined }, mk).length;
    const y = +mk.slice(0, 4), m = +mk.slice(5) - 1;
    const pago = agrupado(rr) ? new Date(y, m, Math.min(rr.agrupar!.dia, new Date(y, m + 1, 0).getDate())) : null;
    const prox = addMonths(mk, 1);
    const volta = rr.reembolso ? (rr.reembolso.datas?.[mk] ?? `${prox}-${String(rr.reembolso.dia).padStart(2, '0')}`) : null;
    return { mk, n, pausadas: todas - n, total: n * rr.valor, pago, reemb: rr.reembolso ? Math.round((n * rr.valor * rr.reembolso.pct) / 100) : 0, volta };
  });
  const sinal = r.tipo === 'saida' ? '−' : '+';
  return (
    <>
      <div className="lab">Nos próximos meses</div>
      <div className="fs-card fs-tab" aria-label="Resumo dos próximos meses">
        {linhas.map((x) => (
          <div key={x.mk} className="fs-mes">
            <div className="fs-m"><b>{MES[+x.mk.slice(5) - 1]}</b><small>{plural(x.n, 'sessão', 'sessões')}{x.pausadas ? ` · ${x.pausadas} pausada${x.pausadas > 1 ? 's' : ''}` : ''}</small></div>
            <div className="fs-v">
              {x.n ? <span className={r.tipo === 'saida' ? 'out' : 'in'}>{sinal}{brl(x.total)} <small>{x.pago ? dm(`${x.mk}-${String(x.pago.getDate()).padStart(2, '0')}`) : 'ao longo do mês'}</small></span> : <span className="dim">nada</span>}
              {x.n > 0 && x.volta && <span className="in">+{brl(x.reemb)} <small>até {dm(x.volta)}</small></span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
