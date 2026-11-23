import { m } from 'motion/react';
import { useMemo } from 'react';
import { Lista } from './Lista';
import { monthKey, parse, today } from '../lib/dates';
import { gerarInsights, type Insight } from '../lib/insights';
import { uid } from '../lib/money';
import { getData, openSheet, useData, withUndo } from '../store';
import { ParcelasSheet } from '../sheets/Parcelas';
import { itemVariants } from './Controls';
import { springSnappy } from './motion';

function agir(i: Insight) {
  if (!i.acao) return;
  if (i.acao.tipo === 'parcelas') return openSheet(<ParcelasSheet />);
  const id = i.acao.lancId;
  const l = getData().lancamentos.find((x) => x.id === id);
  if (!l) return;
  withUndo(`"${l.desc}" virou fixo`, (d) => ({
    ...d,
    recorrentes: [...d.recorrentes, { id: uid(), tipo: 'saida', desc: l.desc, cat: l.cat, ico: l.ico, valor: l.valor, dia: parse(l.data).getDate(), inicio: monthKey(today()), cartaoId: l.cartaoId ?? null }],
  }));
}

/** Carrossel de insights no Início. */
export function InsightsStrip() {
  const D = useData();
  const t = today();
  const lista = useMemo(() => gerarInsights(D, t), [D, t]);
  if (!lista.length) return null;
  return (
    <>
      <h2>Pra você</h2>
      <Lista className="insights">
        {lista.map((i) => (
          <m.div key={i.id} variants={itemVariants} className={`insight ${i.tom}`} whileTap={i.acao ? { scale: 0.98 } : undefined} transition={springSnappy} onClick={() => agir(i)}>
            <div className="in-ico">{i.ico}</div>
            <div className="in-t">{i.titulo}</div>
            <div className="in-x">{i.texto}</div>
            {i.acao && <button className="in-a">{i.acao.label} ›</button>}
          </m.div>
        ))}
      </Lista>
    </>
  );
}
