
import { diaLabel, dm, MES, mesCurto, monthKey, today } from '../lib/dates';
import { freqDe, porMes, quando } from '../lib/recorrencia';
import { serieDe } from '../lib/versions';
import { brl } from '../lib/money';
import type { Cartao, Evento, ISODate, Lancamento, Recorrente } from '../lib/types';
import { catN } from '../lib/categories';
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
  // a próxima pausa (ou a que está valendo agora)
  const pausaProx = r.pausas?.find((p) => p.ate >= today());
  return (
    <SwipeRow id={`rec-${r.id}`} onTap={edit} onEdit={edit} onDelete={() => apagarRec(r)}>
      <div className="item">
        <CatTile cat={r.cat} ico={r.ico} />
        <div className="m">
          <div className="t">{nomeExib(r.desc)}</div>
          <div className="s">{quando(r)}{r.agrupar && !c ? ` · paga junto dia ${r.agrupar.dia}` : ''}{freqDe(r) !== 'mensal' ? ` · ≈ ${brl(porMes(r))}/mês` : ''}{c ? ` · ${c.nome}` : r.meio === 'boleto' ? ' · boleto' : r.tipo === 'saida' ? ' · Pix/débito' : ''}{r.reembolso && freqDe(r) === 'semanal' ? ` · reembolso ${r.reembolso.pct}%` : ''}{pausaProx ? ` · pausa ${dm(pausaProx.de)}–${dm(pausaProx.ate)}` : ''}{ate}</div>
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
      // reembolso de um fixo (v2.54): abre o próprio fixo
      const r = D.recorrentes.find((x) => x.id === (e.reembolso?.rec ?? e.ref));
      if (r) openSheet(<EditRec rec={r} />);
    }
  };
  const sessoes = e.sessoes ? `${e.sessoes} ${e.sessoes === 1 ? 'sessão' : 'sessões'}${e.reembolso ? ` de ${MES[+e.reembolso.mk.slice(5) - 1]}` : ''}` : '';
  const sub = [showDate ? diaLabel(e.data) : '', sessoes, e.itens ? `${e.itens.length} ${e.itens.length === 1 ? 'item' : 'itens'}` : e.cartao ? `${e.cartao}` : ''].filter(Boolean).join(' · ');
  return (
    // Fixos só editam daqui (apagar um fixo some de todos os meses — isso fica na aba Fixos)
    <SwipeRow id={`ev-${e.ref}-${e.data}`} onTap={edit} onEdit={edit} onDelete={e.lanc && !e.itens ? () => apagarLanc(e.ref) : undefined}>
      <div className="item">
        {e.cat === 'fatura' && cartaoDe(e) ? <CatTile cat="fatura"><CartaoMini c={cartaoDe(e)!} /></CatTile> : <CatTile cat={e.cat} ico={e.ico} />}
        <div className="m">
          <div className="t">{nomeExib(e.desc) || catN(e.cat)}{e.fixo && <span className="tag">FIXO</span>}{e.itens?.some((x) => x.estimativa) && !e.estimativa && <span className="tag">+ESTIMATIVA</span>}</div>
          {(sub || e.adiado) && <div className="s">{sub}{e.adiado && <span className="tag tag-l" title="Compra pulada (Pula Compra): paga nesta fatura">PULADA</span>}</div>}
        </div>
        <div className={`v num ${e.valor > 0 ? 'pos' : ''}`}>{brl(e.valor, true)}</div>
      </div>
    </SwipeRow>
  );
}

/**
 * Compra no cartão no dia da compra (extrato): só informativa — o dinheiro sai no vencimento da fatura.
 * Mesmo jeito dos outros itens: tocar ou deslizar edita, deslizar apaga.
 */
export function CompraCartaoItem({ l, cartao, venc }: { l: Lancamento; cartao: Cartao; venc: ISODate | null }) {
  const edit = () => openSheet(<QuickAdd lanc={l} />);
  const n = l.parcelas ?? 1;
  const sub = [cartao.nome, venc ? `fatura ${dm(venc)}` : '', n > 1 ? `${n}x de ${brl(Math.floor(l.valor / n))}` : ''].filter(Boolean).join(' · ').replace(/R\$ /g, 'R$\u00a0');
  return (
    <SwipeRow id={`cc-${l.id}`} onTap={edit} onEdit={edit} onDelete={() => apagarLanc(l.id)}>
      <div className="item no-cartao">
        <CatTile cat={l.cat} ico={l.ico} />
        <div className="m">
          <div className="t">{nomeExib(l.desc) || catN(l.cat)}</div>
          <div className="s">{sub}</div>
        </div>
        <div className="v nc-v"><b className="num">{brl(-l.valor)}</b></div>
      </div>
    </SwipeRow>
  );
}
