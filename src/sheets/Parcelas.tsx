import { m } from 'motion/react';
import { useState } from 'react';
import { catsDe, FiltroBar } from '../ui/Filtros';

import { dm, today } from '../lib/dates';
import { parcelasAbertas, parcelasPorMes } from '../lib/insights';
import { corDoCartao } from '../lib/imagens';
import { mesCurto } from '../lib/dates';
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
  const todasAbertas = parcelasAbertas(D, today());
  const [ordem, setOrdem] = useState('fim');
  const [cat, setCat] = useState<string | null>(null);
  const cats = catsDe(todasAbertas.map((p) => p.lanc.cat));
  const catOk = cat && cats.some((c) => c.cat === cat) ? cat : null;
  const filtradas = todasAbertas.filter((p) => !catOk || p.lanc.cat === catOk);
  const abertas = [...filtradas].sort((a, b) =>
    ordem === 'fim-' ? b.ultima.localeCompare(a.ultima)
    : ordem === 'valor' ? b.restante - a.restante
    : ordem === 'valor-' ? a.restante - b.restante
    : ordem === 'parcela' ? b.valorParcela - a.valorParcela
    : ordem === 'compra' ? b.lanc.data.localeCompare(a.lanc.data)
    : ordem === 'compra-' ? a.lanc.data.localeCompare(b.lanc.data)
    : a.ultima.localeCompare(b.ultima));
  const tot = todasAbertas.reduce((a, x) => a + x.restante, 0);
  const totFiltro = abertas.reduce((a, x) => a + x.restante, 0);
  const meses = parcelasPorMes(D, today());
  const max = Math.max(1, ...meses.map((x) => x.total));
  const cor = (id: string, nome: string) => (id === 'outros' ? 'var(--fp-3)' : corDoCartao(D.cartoes.find((c) => c.id === id)?.nome ?? nome)[0]);
  const origens = [...new Map(meses.flatMap((x) => x.porOrigem).map((o) => [o.id, o.nome])).entries()];
  return (
    <>
      <SheetHeader title="Parcelas em aberto" />
      <div className="parc-tot"><span className="mut">Ainda vai sair{meses.length ? ` até ${mesCurto(meses[meses.length - 1].mes)}` : ''}</span><b className="num">{brl(tot)}</b></div>
      {meses.length > 0 && (
        <>
          <div className="lab">Mês a mês</div>
          <div className="fp-card pm">
            <div className="pm-leg">
              {origens.map(([id, nome]) => <span key={id}><i style={{ background: cor(id, nome) }} />{nome}</span>)}
              <span className="dim">· % do que entra no mês</span>
            </div>
            {meses.map((x) => {
              const pct = x.renda ? Math.round((x.total / x.renda) * 100) : null;
              return (
                <div key={x.mes} className="pm-row">
                  <div className="pm-top">
                    <b className="pm-m">{mesCurto(x.mes)}</b>
                    <span className="pm-bar" role="img" aria-label={x.porOrigem.map((o) => `${o.nome} ${brl(o.valor)}`).join(', ')}>
                      <span style={{ width: `${(x.total / max) * 100}%` }}>
                        {x.porOrigem.map((o) => <i key={o.id} style={{ flexGrow: o.valor, background: cor(o.id, o.nome) }} />)}
                      </span>
                    </span>
                    <b className="num pm-v">{brl(x.total)}</b>
                    <span className={`num pm-p ${pct != null && pct >= 50 ? 'alto' : ''}`}>{pct != null ? `${pct}%` : '—'}</span>
                  </div>
                  <div className="pm-det dim">
                    {[...x.porOrigem.map((o) => `${o.nome} ${brl(o.valor)}`), x.renda ? `entra ${brl(x.renda)}` : 'sem entrada prevista'].map((t) => t.replace(/ (?=R\$)|R\$ /g, (m) => m.replace(' ', '\u00a0'))).join(' · ')}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="lab">Por compra</div>
        </>
      )}
      <FiltroBar ordem={ordem} setOrdem={setOrdem} cat={catOk} setCat={setCat} cats={cats}
        opcoes={[{ id: 'fim', label: 'Termina antes' }, { id: 'fim-', label: 'Termina depois' }, { id: 'valor', label: 'Maior valor restante' }, { id: 'valor-', label: 'Menor valor restante' },
          { id: 'parcela', label: 'Maior parcela' }, { id: 'compra', label: 'Compra mais recente' }, { id: 'compra-', label: 'Compra mais antiga' }]} />
      {catOk && <div className="fat-tot" style={{ margin: '0 2px 8px' }}><span className="mut">{abertas.length} {abertas.length === 1 ? 'compra' : 'compras'} nesta categoria</span><b className="num">{brl(totFiltro)}</b></div>}
      <m.div key={`${ordem}|${catOk}`} className="list" variants={listVariants} initial="hidden" animate="shown">
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
      {!todasAbertas.length && <div className="card empty">Nenhuma compra parcelada em aberto.</div>}
    </>
  );
}
