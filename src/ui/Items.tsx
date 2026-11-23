import { catE } from '../lib/categories';
import { diaLabel, MES } from '../lib/dates';
import { brl } from '../lib/money';
import type { Evento, Recorrente } from '../lib/types';
import { getData, openSheet, withUndo } from '../store';
import { EditRec } from '../sheets/EditRec';
import { QuickAdd } from '../sheets/QuickAdd';
import { SwipeRow } from './SwipeRow';

export const apagarRec = (id: string, desc: string) =>
  withUndo(`"${desc}" apagado`, (d) => ({ ...d, recorrentes: d.recorrentes.filter((x) => x.id !== id) }));
export const apagarLanc = (id: string) =>
  withUndo('Lançamento apagado', (d) => ({ ...d, lancamentos: d.lancamentos.filter((x) => x.id !== id) }));

export function RecItem({ r }: { r: Recorrente }) {
  const c = r.cartaoId ? getData().cartoes.find((x) => x.id === r.cartaoId) : undefined;
  const ate = r.fim ? ` · até ${MES[+r.fim.slice(5) - 1]}/${r.fim.slice(2, 4)}` : '';
  const edit = () => openSheet(<EditRec rec={r} />);
  return (
    <SwipeRow id={`rec-${r.id}`} onTap={edit} onEdit={edit} onDelete={() => apagarRec(r.id, r.desc)}>
      <div className="item">
        <div className="ico">{r.ico || catE(r.cat)}</div>
        <div className="m">
          <div className="t">{r.desc}</div>
          <div className="s">Todo dia {r.dia}{c ? ` · ${c.nome}` : ''}{ate}</div>
        </div>
        <div className={`v num ${r.tipo === 'entrada' ? 'pos' : ''}`}>{brl(r.tipo === 'entrada' ? r.valor : -r.valor)}</div>
      </div>
    </SwipeRow>
  );
}

export function EvItem({ e, showDate = true }: { e: Evento; showDate?: boolean }) {
  const edit = () => {
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
    // Fixos só editam daqui (apagar um fixo some de todos os meses — isso fica na aba Fixos)
    <SwipeRow id={`ev-${e.ref}-${e.data}`} onTap={edit} onEdit={edit} onDelete={e.lanc ? () => apagarLanc(e.ref) : undefined}>
      <div className="item">
        <div className="ico">{e.ico || catE(e.cat)}</div>
        <div className="m">
          <div className="t">{e.desc}{e.fixo && <span className="tag">FIXO</span>}</div>
          {sub && <div className="s">{sub}</div>}
        </div>
        <div className={`v num ${e.valor > 0 ? 'pos' : ''}`}>{brl(e.valor, true)}</div>
      </div>
    </SwipeRow>
  );
}
