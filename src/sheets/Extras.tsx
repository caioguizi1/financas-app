import { m } from 'motion/react';
import { useEffect, useState } from 'react';
import { decimoTerceiro, irPLR } from '../lib/folha';
import { today } from '../lib/dates';
import { EXTRAS, type ExtraModelo } from '../lib/extras';
import { brl, uid } from '../lib/money';
import type { Lancamento } from '../lib/types';
import { closeSheet, getData, openSheet, restore, mutate, toast } from '../store';
import { Button, itemVariants, listVariants, Segmented, Stepper } from '../ui/Controls';
import { SheetHeader } from '../ui/Sheet';
import { ValueRows } from '../ui/ValueRows';
import { rendaAtual, RendaSheet } from './Renda';

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
  const D = getData();
  const renda = rendaAtual().reduce((a, r) => a + r.valor, 0);
  const folha = D.folha;
  const e13 = modelo.k === '13';
  const ePLR = modelo.k === 'plr'; // valores digitados são BRUTOS; IR pela tabela exclusiva
  const [meses, setMeses] = useState(12);
  const dec = e13 && folha ? decimoTerceiro(folha.bruto, folha.dependentes, meses) : null;
  const [n, setN] = useState(modelo.divisivel ? 1 : modelo.parcelas.length);
  const inicial = () => modelo.parcelas.map((p, i) => ({
    label: p.label,
    valor: dec ? (i === 0 ? dec.parcela1 : dec.parcela2) : Math.round(renda * p.pct),
    data: p.data(hoje),
  }));
  const [linhas, setLinhas] = useState(inicial);
  // mudou os meses trabalhados: recalcula as parcelas do 13º
  useEffect(() => { if (dec) setLinhas(inicial()); }, [meses]);
  const [ativa, setAtiva] = useState(0);

  // PLR: IR acumulado no ano (parcelas anteriores já lançadas + as desta tela)
  const plrAno = (ano: string) => D.lancamentos.filter((l) => l.desc.startsWith('PLR') && l.data.startsWith(ano)).reduce((a, l) => a + (l.bruto ?? l.valor), 0);
  const base = linhas.slice(0, n).map((l) => (n === 1 && modelo.divisivel ? { ...l, label: 'Valor' } : l));
  const liquidos = base.map((l, i) => {
    if (!ePLR) return l.valor;
    const ano = l.data.slice(0, 4);
    const antes = plrAno(ano) + base.slice(0, i).filter((x) => x.data.startsWith(ano)).reduce((a, x) => a + x.valor, 0);
    return l.valor - irPLR(l.valor, antes);
  });
  const usadas = base.map((l, i) => (ePLR ? { ...l, label: `${l.label} (bruto)`, nota: l.valor ? `líquido ${brl(liquidos[i])}${liquidos[i] < l.valor ? ` · IR ${brl(l.valor - liquidos[i])}` : ' · isento'}` : undefined } : l));
  const total = liquidos.reduce((a, v) => a + v, 0);
  const ok = base.every((l) => l.valor > 0);

  const salvar = () => {
    if (!ok) return;
    const before = getData();
    const novos: Lancamento[] = base.map((l, i) => ({
      id: uid(), tipo: 'entrada', valor: liquidos[i], bruto: ePLR ? l.valor : undefined, cat: modelo.cat, ico: modelo.ico,
      desc: base.length > 1 ? `${modelo.nome} · ${l.label}` : modelo.nome, data: l.data, criado: Date.now(),
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
      {dec && (
        <div className="holerite" style={{ marginTop: 12 }}>
          <div className="hl"><span>13º bruto{meses < 12 ? ` (${meses}/12 avos)` : ''}</span><b className="num">{brl(dec.bruto)}</b></div>
          <div className="hl"><span>1ª parcela (metade, sem descontos)</span><span className="num">{brl(dec.parcela1)}</span></div>
          <div className="hl neg"><span>INSS sobre o 13º inteiro</span><span className="num">{brl(-dec.inss)}</span></div>
          <div className="hl neg"><span>IR do 13º{dec.ir.reducao > 0 && <small> (redução Lei 15.270: {brl(dec.ir.reducao)})</small>}</span><span className="num">{dec.ir.devido ? brl(-dec.ir.devido) : 'isento'}</span></div>
          <div className="hl tot"><span>13º líquido</span><b className="num">{brl(dec.liquido)}</b></div>
          <div className="row" style={{ marginTop: 10 }}>
            <span className="mut small">Meses trabalhados no ano</span><span className="sp" />
            <Stepper value={meses} min={1} max={12} onChange={setMeses} fmt={(v) => `${v}/12`} />
          </div>
          <div className="dim hint">Calculado sobre o bruto de {brl(folha!.bruto)}. Médias de horas extras e comissões não entram. Ajuste pelo holerite se precisar.</div>
        </div>
      )}
      {e13 && !folha && (
        <div className="dim hint">
          Estimativa sobre o líquido de {brl(renda)}. <button className="inline-link" onClick={() => openSheet(<RendaSheet />)}>Informe o bruto em Minha renda</button> pro cálculo com INSS e IR.
        </div>
      )}
      {!e13 && !ePLR && renda > 0 && modelo.parcelas.some((p) => p.pct > 0) && <div className="dim hint">Sugestão calculada sobre sua renda de {brl(renda)}. Toque na linha e ajuste pelo teclado.</div>}
      <div className="actions">
        <Button disabled={!ok} onClick={salvar}>{ok ? `Adicionar ${brl(total)}${ePLR ? ' líquido' : ''} à previsão` : 'Coloque os valores'}</Button>
      </div>
    </>
  );
}
