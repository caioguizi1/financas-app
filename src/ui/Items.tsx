
import { diaLabel, MES, mesCurto, monthKey, today } from '../lib/dates';
import { serieDe } from '../lib/versions';
import { brl } from '../lib/money';
import type { Evento, Recorrente } from '../lib/types';
import { getData, openSheet, withUndo } from '../store';
import { EditRec } from '../sheets/EditRec';
import { QuickAdd } from '../sheets/QuickAdd';
import { FaturasSheet } from '../sheets/Faturas';
import { SwipeRow } from './SwipeRow';
import { nomeExib } from './nome';
import { CatTile } from './CatIco';
import { CartaoMini } from './Ico';

/** Apaga o fixo inteiro (todas as versões do histórico). */
export const apagarRec = (r: Recorrente) => {
  const serie = serieDe(r);
  withUndo(`"${r.desc}" apagado`, (d) => ({ ...d, recorrentes: d.recorrentes.filter((x) => serieDe(x) !== serie) }));
};
export const apagarLanc = (id: string) =>
  withUndo('Lançamento apagado', (d) => ({ ...d, lancamentos: d.lancamentos.filter((x) => x.id !== id) }));

export function RecItem({ r, prox }: { r: Recorrente; prox?: Recorrente }) {
  const c = r.cartaoId ? getData().cartoes.find((x) => x.id === r.cartaoId) : undefined;
  const mk = monthKey(today());
  const ate = prox ? ` · ${brl(prox.tipo === 'entrada' ? prox.valor : -prox.valor)} a partir de ${mesCurto(prox.inicio)}` : r.fim ? ` · até ${MES[+r.fim.slice(5) - 1]}/${r.fim.slice(2, 4)}` : r.inicio > mk ? ` · começa em ${mesCurto(r.inicio)}` : '';
  const edit = () => openSheet(<EditRec rec={r} />);
  return (
    <SwipeRow id={`rec-${r.id}`} onTap={edit} onEdit={edit} onDelete={() => apagarRec(r)}>
      <div className="item">
        <CatTile cat={r.cat} ico={r.ico} />
        <div className="m">
          <div className="t">{nomeExib(r.desc)}</div>
          <div className="s">Todo dia {r.dia}{c ? ` · ${c.nome}` : r.meio === 'boleto' ? ' · boleto' : r.tipo === 'saida' ? ' · Pix/débito' : ''}{ate}</div>
        </div>
        <div className={`v num ${r.tipo === 'entrada' ? 'pos' : ''}`}>{brl(r.tipo === 'entrada' ? r.valor : -r.valor)}</div>
      </div>
    </SwipeRow>
  );
}

/** Fatura agrupada ("Fatura Itaú"): mostra a miniatura do próprio cartão. */
const cartaoDe = (e: Evento) => (e.cartaoId ? getData().cartoes.find((c) => c.id === e.cartaoId) : undefined);

export function EvItem({ e, showDate = true }: { e: Evento; showDate?: boolean }) {
  const edit = () => {
    const D = getData();
    if (e.itens && e.cartaoId) return openSheet(<FaturasSheet cartaoId={e.cartaoId} />);
    if (e.lanc) {
      const l = D.lancamentos.find((x) => x.id === e.ref);
      if (l) openSheet(<QuickAdd lanc={l} />);
    } else {
      const r = D.recorrentes.find((x) => x.id === e.ref);
      if (r) openSheet(<EditRec rec={r} />);
    }
  };
  const sub = [showDate ? diaLabel(e.data) : '', e.itens ? `${e.itens.length} ${e.itens.length === 1 ? 'item' : 'itens'}` : e.cartao ? `${e.cartao}` : ''].filter(Boolean).join(' · ');
  return (
    // Fixos só editam daqui (apagar um fixo some de todos os meses — isso fica na aba Fixos)
    <SwipeRow id={`ev-${e.ref}-${e.data}`} onTap={edit} onEdit={edit} onDelete={e.lanc && !e.itens ? () => apagarLanc(e.ref) : undefined}>
      <div className="item">
        {e.cat === 'fatura' && cartaoDe(e) ? <CatTile cat="fatura"><CartaoMini c={cartaoDe(e)!} /></CatTile> : <CatTile cat={e.cat} ico={e.ico} />}
        <div className="m">
          <div className="t">{nomeExib(e.desc)}{e.fixo && <span className="tag">FIXO</span>}{e.itens?.some((x) => x.estimativa) && !e.estimativa && <span className="tag">+ESTIMATIVA</span>}</div>
          {(sub || e.adiado) && <div className="s">{sub}{e.adiado && <span className="tag tag-l" title="Compra pulada (Pula Compra): paga nesta fatura">PULADA</span>}</div>}
        </div>
        <div className={`v num ${e.valor > 0 ? 'pos' : ''}`}>{brl(e.valor, true)}</div>
      </div>
    </SwipeRow>
  );
}
