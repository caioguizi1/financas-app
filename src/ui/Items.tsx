import { motion } from 'motion/react';
import { catE } from '../lib/categories';
import { diaLabel, MES } from '../lib/dates';
import { brl } from '../lib/money';
import type { Evento, Recorrente } from '../lib/types';
import { getData, openSheet } from '../store';
import { EditRec } from '../sheets/EditRec';
import { QuickAdd } from '../sheets/QuickAdd';
import { itemVariants } from './Controls';

export function RecItem({ r }: { r: Recorrente }) {
  const c = r.cartaoId ? getData().cartoes.find((x) => x.id === r.cartaoId) : undefined;
  const ate = r.fim ? ` · até ${MES[+r.fim.slice(5) - 1]}/${r.fim.slice(2, 4)}` : '';
  return (
    <motion.button layout="position" variants={itemVariants} className="item" onClick={() => openSheet(<EditRec rec={r} />)}>
      <div className="ico">{r.ico || catE(r.cat)}</div>
      <div className="m">
        <div className="t">{r.desc}</div>
        <div className="s">Todo dia {r.dia}{c ? ` · ${c.nome}` : ''}{ate}</div>
      </div>
      <div className={`v num ${r.tipo === 'entrada' ? 'pos' : ''}`}>{brl(r.tipo === 'entrada' ? r.valor : -r.valor)}</div>
    </motion.button>
  );
}

export function EvItem({ e, showDate = true }: { e: Evento; showDate?: boolean }) {
  const open = () => {
    const D = getData();
    if (e.lanc) {
      const l = D.lancamentos.find((x) => x.id === e.ref);
      if (l) openSheet(<QuickAdd lanc={l} />);
    } else {
      const r = D.recorrentes.find((x) => x.id === e.ref);
      if (r) openSheet(<EditRec rec={r} />);
    }
  };
  const sub = [showDate ? diaLabel(e.data) : '', e.cartao ? `💳 ${e.cartao}` : ''].filter(Boolean).join(' · ');
  return (
    <motion.button variants={itemVariants} className="item" onClick={open}>
      <div className="ico">{e.ico || catE(e.cat)}</div>
      <div className="m">
        <div className="t">{e.desc}{e.fixo && <span className="tag">FIXO</span>}</div>
        {sub && <div className="s">{sub}</div>}
      </div>
      <div className={`v num ${e.valor > 0 ? 'pos' : ''}`}>{brl(e.valor, true)}</div>
    </motion.button>
  );
}
