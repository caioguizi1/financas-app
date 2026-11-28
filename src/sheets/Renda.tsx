import { AnimatePresence } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { addMonths, mesCurto, monthKey, today } from '../lib/dates';
import { holerite, TABELAS_ANO, type Holerite } from '../lib/folha';
import { brl } from '../lib/money';
import { ativaEm, substituirRenda, type Vigencia } from '../lib/versions';
import { closeSheet, getData, withUndo } from '../store';
import { Button, Chip, DayGrid, Segmented, Stepper } from '../ui/Controls';
import { SheetHeader } from '../ui/Sheet';
import { Expande } from '../ui/Expande';
import { ValueRows, type Linha } from '../ui/ValueRows';

export const rendaAtual = () => {
  const mk = monthKey(today());
  return getData().recorrentes.filter((r) => r.onb === 'renda' && ativaEm(r, mk)).sort((a, b) => a.dia - b.dia);
};
export function resumoRenda() {
  const r = rendaAtual();
  if (!r.length) return 'Não cadastrada';
  const tot = r.reduce((a, x) => a + x.valor, 0);
  const f = getData().folha;
  return `${brl(tot)} líquido${f ? ` (bruto ${brl(f.bruto)})` : ''} · ${r.length === 1 ? `dia ${r[0].dia}` : `${r.length}x`}`;
}

type Modo = 'bruto' | 'liquido';

/** "Minha renda": bruto→líquido com INSS/IR 2026, 1x/2x, dias e vigência. */
export function RendaSheet() {
  const mk = monthKey(today());
  const D = getData();
  const atual = rendaAtual();
  const ad = atual.find((r) => r.desc === 'Adiantamento');
  const sal = atual.find((r) => r.desc !== 'Adiantamento');
  const liqAtual = atual.reduce((a, r) => a + r.valor, 0);

  const [modo, setModo] = useState<Modo>(D.folha || !atual.length ? 'bruto' : 'liquido');
  const [bruto, setBruto] = useState(D.folha?.bruto ?? 0);
  const [deps, setDeps] = useState(D.folha?.dependentes ?? 0);
  const [outros, setOutros] = useState(D.folha?.outros ?? 0);
  const [liqManual, setLiqManual] = useState(liqAtual);
  const [freq, setFreq] = useState<1 | 2>(ad ? 2 : 1);
  const [adValor, setAdValor] = useState(ad?.valor ?? 0);
  const [adDia, setAdDia] = useState<number | null>(ad?.dia ?? null);
  const [dia, setDia] = useState<number | null>(sal?.dia ?? null);
  const [ativa, setAtiva] = useState(0);
  const [vig, setVig] = useState<Vigencia>(atual.length ? addMonths(mk, 1) : mk);

  const h: Holerite | null = modo === 'bruto' ? holerite(bruto, deps, outros) : null;
  const liq = h ? h.liquido : liqManual;
  const base = h ? bruto : liq; // adiantamento costuma ser % do bruto
  const resto = liq - (freq === 2 ? adValor : 0);
  const ok = liq > 0 && !!dia && (freq === 1 || (!!adDia && adValor > 0 && adValor < liq));

  const linhas: Linha[] = [
    ...(modo === 'bruto'
      ? [{ id: 'bruto', label: 'Salário bruto', valor: bruto, nota: 'O valor do contrato, antes dos descontos' }, { id: 'outros', label: 'Outros descontos', valor: outros, nota: 'Vale-transporte, plano de saúde, VR…' }]
      : [{ id: 'liq', label: 'Total líquido no mês', valor: liqManual }]),
    ...(freq === 2 ? [{ id: 'ad', label: 'Adiantamento', valor: adValor }] : []),
  ];
  const setValor = (i: number, v: number) => {
    const id = linhas[i].id;
    if (id === 'bruto') setBruto(v); else if (id === 'outros') setOutros(v); else if (id === 'liq') setLiqManual(v); else setAdValor(v);
  };

  const salvar = () => {
    if (!ok) return;
    const novas = freq === 2
      ? [{ desc: 'Adiantamento', valor: adValor, dia: adDia! }, { desc: 'Salário', valor: resto, dia: dia! }]
      : [{ desc: 'Salário', valor: liq, dia: dia! }];
    closeSheet();
    withUndo(vig === 'sempre' ? 'Renda corrigida' : `Renda nova a partir de ${mesCurto(vig)}`, (d) => ({
      ...d,
      folha: modo === 'bruto' ? { bruto, dependentes: deps, outros } : d.folha,
      recorrentes: substituirRenda(d.recorrentes, novas, vig, mk),
    }));
  };

  return (
    <div className="sl">
      <SheetHeader title="Minha renda" />
      <div className="sl-mid" data-scroll>
      <Segmented value={modo} onChange={(v) => { setModo(v); setAtiva(0); }} options={[{ v: 'bruto', label: 'Sei o bruto' }, { v: 'liquido', label: 'Sei o líquido' }]} />

      <div style={{ marginTop: 12 }}>
        <ValueRows linhas={linhas} ativa={Math.min(ativa, linhas.length - 1)} onAtiva={setAtiva} onValor={setValor} />
      </div>

      <AnimatePresence presenceAffectsLayout={false} initial={false}>
        {h && bruto > 0 && (
          <Expande className="holerite">
            <div className="hl"><span>Salário bruto</span><b className="num">{brl(h.bruto)}</b></div>
            <div className="hl neg"><span>INSS</span><span className="num">{brl(-h.inss)}</span></div>
            <div className="hl neg">
              <span>Imposto de Renda{h.ir.reducao > 0 && <small> (redução Lei 15.270: {brl(h.ir.reducao)})</small>}</span>
              <span className="num">{h.ir.devido ? brl(-h.ir.devido) : 'isento'}</span>
            </div>
            {outros > 0 && <div className="hl neg"><span>Outros descontos</span><span className="num">{brl(-outros)}</span></div>}
            <div className="hl tot"><span>Líquido estimado</span><b className="num">{brl(h.liquido)}</b></div>
            <div className="row" style={{ marginTop: 10 }}>
              <span className="mut small">Dependentes no IR</span><span className="sp" />
              <Stepper value={deps} min={0} max={10} onChange={setDeps} fmt={(v) => String(v)} />
            </div>
            <div className="dim hint">Tabelas INSS e IRRF {TABELAS_ANO}. Estimativa: horas extras, faltas e benefícios mudam o holerite real.</div>
          </Expande>
        )}
      </AnimatePresence>

      <div className="lab">Como cai na conta</div>
      <Segmented value={freq} onChange={(f) => { setFreq(f); setAtiva(0); }} options={[{ v: 1, label: '1 vez por mês' }, { v: 2, label: '2 vezes por mês' }]} />
      {freq === 2 && base > 0 && (
        <>
          <div className="chips" style={{ marginTop: 10 }}>
            {[30, 40, 50].map((p) => { const x = Math.round((base * p) / 100); return <Chip key={p} on={x === adValor} onClick={() => { setAdValor(x); setAtiva(linhas.findIndex((l) => l.id === 'ad')); }}>Adiant. {p}%{modo === 'bruto' ? ' do bruto' : ''}</Chip>; })}
          </div>
          {adValor > 0 && <div className="dim hint">Adiantamento {brl(adValor)} · restante {brl(Math.max(0, resto))} (os descontos saem do restante)</div>}
        </>
      )}
      {freq === 2 && <><div className="lab">Dia do adiantamento</div><DayGrid value={adDia} onChange={setAdDia} caption={(d) => `adiantamento todo dia ${d}`} /></>}
      <div className="lab">{freq === 2 ? 'Dia do restante' : 'Dia do salário'}</div>
      <DayGrid value={dia} onChange={setDia} caption={(d) => `${freq === 2 ? 'restante' : 'salário'} todo dia ${d}`} />

      <VigenciaPicker vig={vig} setVig={setVig} mk={mk} temHistorico={atual.length > 0} antes={liqAtual} depois={liq} />
      </div>
      <div className="sl-foot">
        <div className="actions sl-actions">
        <Button disabled={!ok} onClick={salvar}>Salvar renda</Button>
        {!ok && <div className="need">{!liq ? 'Coloque o valor' : !dia || (freq === 2 && !adDia) ? 'Escolha os dias' : 'O adiantamento precisa ser menor que o líquido'}</div>}
      </div>
      </div>
    </div>
  );
}

/** Seletor "vale a partir de" com a explicação do que acontece. */
export function VigenciaPicker({ vig, setVig, mk, temHistorico, antes, depois, extra }: {
  vig: Vigencia; setVig: (v: Vigencia) => void; mk: string; temHistorico: boolean; antes: number; depois: number; extra?: ReactNode;
}) {
  if (!temHistorico) return null;
  const prox = addMonths(mk, 1);
  const txt = vig === 'sempre'
    ? `Corrige o valor em todos os meses, inclusive os passados. Use só se foi digitado errado.`
    : antes === depois
      ? `Até ${mesCurto(addMonths(vig, -1))} fica como está; de ${mesCurto(vig)} em diante vale a nova configuração. O histórico fica guardado.`
      : `Até ${mesCurto(addMonths(vig, -1))} continua ${brl(antes)}; de ${mesCurto(vig)} em diante, ${brl(depois)}. O histórico fica guardado.`;
  return (
    <>
      <div className="lab">Vale a partir de</div>
      <Segmented value={vig} onChange={setVig} options={[{ v: mk, label: `Este mês` }, { v: prox, label: mesCurto(prox) }, { v: 'sempre', label: 'Corrigir tudo' }]} />
      <div className="vig-txt">{txt}</div>
      {extra}
    </>
  );
}
