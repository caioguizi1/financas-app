import { m } from 'motion/react';
import { useState } from 'react';
import { today } from '../lib/dates';
import { EXTRAS, type ExtraModelo } from '../lib/extras';
import { brl, uid } from '../lib/money';
import type { Lancamento } from '../lib/types';
import { closeSheet, getData, restore, mutate, toast } from '../store';
import { Button, itemVariants, listVariants, Segmented } from '../ui/Controls';
import { SheetHeader } from '../ui/Sheet';
import { ValueRows } from '../ui/ValueRows';
import { rendaAtual } from './Renda';

/** Recebimentos extras previstos: 13º, PLR, férias, bônus, IR... */
export function ExtraSheet({ k }: { k?: string }) {
  const [modelo, setModelo] = useState<ExtraModelo | undefined>(() => EXTRAS.find((e) => e.k === k));
  if (!modelo) {
    return (
      <>
        <SheetHeader title="Recebimento extra" />
        <p className="mut small" style={{ marginBottom: 12 }}>Coloque na previsão o dinheiro que vai entrar fora do salário. O app já soma na projeção.</p>
        <m.div className="extra-grid" variants={listVariants} initial="hidden" animate="shown">
          {EXTRAS.map((e) => (
            <m.button key={e.k} variants={itemVariants} whileTap={{ scale: 0.95 }} className="extra-card" onClick={() => setModelo(e)}>
              <span className="ex-ico">{e.ico}</span><span>{e.nome}</span>
            </m.button>
          ))}
        </m.div>
      </>
    );
  }
  return <ExtraForm modelo={modelo} voltar={k ? undefined : () => setModelo(undefined)} />;
}

function ExtraForm({ modelo, voltar }: { modelo: ExtraModelo; voltar?: () => void }) {
  const hoje = today();
  const renda = rendaAtual().reduce((a, r) => a + r.valor, 0);
  const [n, setN] = useState(modelo.divisivel ? 1 : modelo.parcelas.length);
  const [linhas, setLinhas] = useState(() => modelo.parcelas.map((p) => ({ label: p.label, valor: Math.round(renda * p.pct), data: p.data(hoje) })));
  const [ativa, setAtiva] = useState(0);
  const usadas = linhas.slice(0, n).map((l) => (n === 1 && modelo.divisivel ? { ...l, label: 'Valor' } : l));
  const total = usadas.reduce((a, l) => a + l.valor, 0);
  const ok = usadas.every((l) => l.valor > 0);

  const salvar = () => {
    if (!ok) return;
    const before = getData();
    const novos: Lancamento[] = usadas.map((l) => ({
      id: uid(), tipo: 'entrada', valor: l.valor, cat: modelo.cat, ico: modelo.ico,
      desc: usadas.length > 1 ? `${modelo.nome} · ${l.label}` : modelo.nome, data: l.data, criado: Date.now(),
    }));
    mutate((d) => ({ ...d, lancamentos: [...d.lancamentos, ...novos] }));
    closeSheet();
    toast(`${modelo.ico} ${modelo.nome}: ${brl(total)} na previsão`, () => restore(before));
  };

  return (
    <>
      <SheetHeader title={`${modelo.ico} ${modelo.nome}`} />
      {voltar && <button className="link-back" onClick={voltar}>‹ Outros tipos</button>}
      <div className="extra-nota">{modelo.nota}</div>
      {modelo.divisivel && (
        <div style={{ marginBottom: 12 }}>
          <Segmented value={n} onChange={(v) => { setN(v); setAtiva(0); }} options={[{ v: 1, label: 'Parcela única' }, { v: 2, label: '2 parcelas' }]} />
        </div>
      )}
      <ValueRows
        linhas={usadas}
        ativa={ativa}
        onAtiva={setAtiva}
        onValor={(i, v) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, valor: v } : l)))}
        onData={(i, d) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, data: d } : l)))}
      />
      {renda > 0 && modelo.parcelas.some((p) => p.pct > 0) && <div className="dim hint">Sugestão calculada sobre sua renda de {brl(renda)}. Toque na linha e ajuste pelo teclado.</div>}
      <div className="actions">
        <Button disabled={!ok} onClick={salvar}>{ok ? `Adicionar ${brl(total)} à previsão` : 'Coloque os valores'}</Button>
      </div>
    </>
  );
}
