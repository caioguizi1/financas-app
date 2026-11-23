import { m } from 'motion/react';
import { useMemo } from 'react';
import { Lista } from './Lista';
import { monthKey, parse, today } from '../lib/dates';
import { gerarInsights, type Insight } from '../lib/insights';
import { uid } from '../lib/money';
import { closeSheet, getData, openSheet, useData, withUndo } from '../store';
import { SheetHeader } from './Sheet';
import { ParcelasSheet } from '../sheets/Parcelas';
import { Button, itemVariants } from './Controls';
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
          <m.div key={i.id} variants={itemVariants} className={`insight ${i.tom}`} whileTap={{ scale: 0.98 }} transition={springSnappy}
            onClick={(e) => {
              // texto cortado (3 linhas) e sem ação: o toque mostra a dica inteira
              const x = (e.currentTarget as HTMLElement).querySelector('.in-x');
              if (i.acao) agir(i);
              else if (x && x.scrollHeight > x.clientHeight + 1) openSheet(<DicaSheet i={i} />);
            }}>
            <div className="in-h"><span className="in-ico">{i.ico}</span><span className="in-t">{i.titulo}</span></div>
            <div className="in-x">{i.texto}</div>
            {i.acao && <button className="in-a">{i.acao.label} ›</button>}
          </m.div>
        ))}
      </Lista>
    </>
  );
}

/** Dica inteira (quando o texto não coube nas 3 linhas do cartão). */
function DicaSheet({ i }: { i: Insight }) {
  return (
    <>
      <SheetHeader title={`${i.ico} ${i.titulo}`} />
      <p className="mut" style={{ lineHeight: 1.5 }}>{i.texto}</p>
      {i.acao && <div className="actions"><Button onClick={() => { closeSheet(); agir(i); }}>{i.acao.label}</Button></div>}
    </>
  );
}
