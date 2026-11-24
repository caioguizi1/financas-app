import { m } from 'motion/react';

import { dm, today } from '../lib/dates';
import { parcelasAbertas } from '../lib/insights';
import { brl } from '../lib/money';
import { getData, openSheet } from '../store';
import { itemVariants, listVariants } from '../ui/Controls';
import { SheetHeader } from '../ui/Sheet';
import { QuickAdd } from './QuickAdd';
import { CatTile } from '../ui/CatIco';
import { nomeExib } from '../ui/nome';

/** Compras parceladas em aberto, com progresso. */
export function ParcelasSheet() {
  const D = getData();
  const abertas = parcelasAbertas(D, today());
  const tot = abertas.reduce((a, x) => a + x.restante, 0);
  return (
    <>
      <SheetHeader title="Parcelas em aberto" />
      <div className="parc-tot"><span className="mut">Ainda vai sair</span><b className="num">{brl(tot)}</b></div>
      <m.div className="list" variants={listVariants} initial="hidden" animate="shown">
        {abertas.map((p) => {
          const c = p.lanc.cartaoId ? D.cartoes.find((x) => x.id === p.lanc.cartaoId) : undefined;
          return (
            <m.button key={p.lanc.id} variants={itemVariants} className="item parc" onClick={() => openSheet(<QuickAdd lanc={p.lanc} />)}>
              <CatTile cat={p.lanc.cat} ico={p.lanc.ico} />
              <div className="m">
                <div className="t">{p.lanc.desc ? nomeExib(p.lanc.desc) : 'Compra parcelada'}</div>
                <div className="s">{p.pagas}/{p.total} pagas · {brl(p.valorParcela)}/mês{c ? ` · ${c.nome}` : ''} · até {dm(p.ultima)}/{p.ultima.slice(2, 4)}</div>
                <div className="parc-bar"><m.i initial={{ width: 0 }} animate={{ width: `${(p.pagas / p.total) * 100}%` }} transition={{ type: 'spring', stiffness: 140, damping: 22, delay: 0.15 }} /></div>
              </div>
              <div className="v num">{brl(-p.restante)}</div>
            </m.button>
          );
        })}
      </m.div>
      {!abertas.length && <div className="card empty">Nenhuma compra parcelada em aberto.</div>}
    </>
  );
}
