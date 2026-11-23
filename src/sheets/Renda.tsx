import { useState } from 'react';
import { addMonths, mesCurto, monthKey, today } from '../lib/dates';
import { brl } from '../lib/money';
import { ativaEm, substituirRenda, type Vigencia } from '../lib/versions';
import { closeSheet, getData, withUndo } from '../store';
import { Button, Chip, DayGrid, Segmented } from '../ui/Controls';
import { SheetHeader } from '../ui/Sheet';
import { ValueRows } from '../ui/ValueRows';

export const rendaAtual = () => {
  const mk = monthKey(today());
  return getData().recorrentes.filter((r) => r.onb === 'renda' && ativaEm(r, mk)).sort((a, b) => a.dia - b.dia);
};
export function resumoRenda() {
  const r = rendaAtual();
  if (!r.length) return 'Não cadastrada';
  const tot = r.reduce((a, x) => a + x.valor, 0);
  return `${brl(tot)} · ${r.length === 1 ? `dia ${r[0].dia}` : `${r.length}x (dias ${r.map((x) => x.dia).join(' e ')})`}`;
}

/** "Minha renda": muda valor, 1x/2x e dias, valendo a partir do mês escolhido. */
export function RendaSheet() {
  const mk = monthKey(today());
  const atual = rendaAtual();
  const ad = atual.find((r) => r.desc === 'Adiantamento');
  const sal = atual.find((r) => r.desc !== 'Adiantamento');
  const [freq, setFreq] = useState<1 | 2>(ad ? 2 : 1);
  const [total, setTotal] = useState(atual.reduce((a, r) => a + r.valor, 0));
  const [adValor, setAdValor] = useState(ad?.valor ?? 0);
  const [adDia, setAdDia] = useState<number | null>(ad?.dia ?? null);
  const [dia, setDia] = useState<number | null>(sal?.dia ?? null);
  const [ativa, setAtiva] = useState(0);
  const [vig, setVig] = useState<Vigencia>(atual.length ? addMonths(mk, 1) : mk);

  const resto = total - (freq === 2 ? adValor : 0);
  const ok = total > 0 && !!dia && (freq === 1 || (!!adDia && adValor > 0 && adValor < total));
  const linhas = freq === 2
    ? [{ label: 'Total líquido no mês', valor: total }, { label: 'Adiantamento', valor: adValor }, { label: 'Restante', valor: Math.max(0, resto), fixo: true }]
    : [{ label: 'Total líquido no mês', valor: total }];

  const salvar = () => {
    if (!ok) return;
    const novas = freq === 2
      ? [{ desc: 'Adiantamento', valor: adValor, dia: adDia! }, { desc: 'Salário', valor: resto, dia: dia! }]
      : [{ desc: 'Salário', valor: total, dia: dia! }];
    closeSheet();
    withUndo(vig === 'sempre' ? 'Renda corrigida' : `Renda nova a partir de ${mesCurto(vig)}`, (d) => ({ ...d, recorrentes: substituirRenda(d.recorrentes, novas, vig, mk) }));
  };

  return (
    <>
      <SheetHeader title="Minha renda" />
      <Segmented value={freq} onChange={(f) => { setFreq(f); setAtiva(0); }} options={[{ v: 1, label: '1 vez por mês' }, { v: 2, label: '2 vezes por mês' }]} />
      <div style={{ marginTop: 12 }}>
        <ValueRows linhas={linhas} ativa={ativa} onAtiva={setAtiva} onValor={(i, v) => (i === 0 ? setTotal(v) : setAdValor(v))} />
      </div>
      {freq === 2 && total > 0 && (
        <div className="chips" style={{ marginTop: 10 }}>
          {[30, 40, 50].map((p) => { const x = Math.round((total * p) / 100); return <Chip key={p} on={x === adValor} onClick={() => { setAdValor(x); setAtiva(1); }}>Adiant. {p}%</Chip>; })}
        </div>
      )}
      {freq === 2 && <><div className="lab">Dia do adiantamento</div><DayGrid value={adDia} onChange={setAdDia} caption={(d) => `adiantamento todo dia ${d}`} /></>}
      <div className="lab">{freq === 2 ? 'Dia do restante' : 'Dia do salário'}</div>
      <DayGrid value={dia} onChange={setDia} caption={(d) => `${freq === 2 ? 'restante' : 'salário'} todo dia ${d}`} />

      <VigenciaPicker vig={vig} setVig={setVig} mk={mk} temHistorico={atual.length > 0} antes={atual.reduce((a, r) => a + r.valor, 0)} depois={total} />
      <div className="actions">
        <Button disabled={!ok} onClick={salvar}>Salvar renda</Button>
        {!ok && <div className="need">{!total ? 'Coloque o valor' : !dia || (freq === 2 && !adDia) ? 'Escolha os dias' : 'O adiantamento precisa ser menor que o total'}</div>}
      </div>
    </>
  );
}

/** Seletor "vale a partir de" com a explicação do que acontece. */
export function VigenciaPicker({ vig, setVig, mk, temHistorico, antes, depois }: {
  vig: Vigencia; setVig: (v: Vigencia) => void; mk: string; temHistorico: boolean; antes: number; depois: number;
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
    </>
  );
}
