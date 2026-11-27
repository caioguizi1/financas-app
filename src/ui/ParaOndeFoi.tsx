/**
 * Início · "Para onde foi": gastos do mês por categoria (rosca + lista), e a categoria aberta.
 * Cálculo em src/lib/gastosMes.ts (compra no cartão no mês da compra; fatura não entra).
 */
import { useMemo, useState } from 'react';
import { catN } from '../lib/categories';
import { addMonths, dm, MES, MESL, monthKey, today } from '../lib/dates';
import { gastosDoMes, historicoCat, resumoGastos, type CatMes } from '../lib/gastosMes';
import { brl } from '../lib/money';
import { fatiasRosca } from '../lib/rosca';
import { closeSheet, getData, openSheet, useData, useUI } from '../store';
import { Button } from './Controls';
import { CatTile, COR_CAT } from './CatIco';
import { Ico } from './Ico';
import { nomeExib } from './nome';
import { SheetHeader } from './Sheet';

const corDe = (cat: string) => COR_CAT[cat] ?? COR_CAT.outros;
const nomeMes = (mk: string, comAno = false) => MESL[Number(mk.slice(5, 7)) - 1] + (comAno ? ` ${mk.slice(0, 4)}` : '');
const MAX_LINHAS = 5;
const R = 70, C = 2 * Math.PI * R, GAP = 3;

/** Variação em relação ao mês passado: verde se gastou menos, âmbar se gastou mais. */
function Variacao({ agora, antes, mk }: { agora: number; antes: number; mk: string }) {
  if (!antes) return null;
  const p = Math.round(((agora - antes) / antes) * 100);
  if (p === 0) return <span className="pf-var">igual a {nomeMes(addMonths(mk, -1))}</span>;
  return (
    <span className={`pf-var ${p < 0 ? 'menos' : 'mais'}`}>
      {p > 0 ? '+' : '−'}{Math.abs(p)}% que {nomeMes(addMonths(mk, -1))}
    </span>
  );
}

/** Fatia agrupada ("+N categorias"): cor própria, diferente de "Outros". */
const RESTO = '__resto';
const corFatia = (k: string) => (k === RESTO ? 'var(--pf-resto)' : corDe(k));

/** A rosca mostra o mesmo que a lista: as categorias da lista e, se houver, uma fatia "+N categorias". */
function Rosca({ cats, resto, total }: { cats: CatMes[]; resto: CatMes[]; total: number }) {
  const restoPct = resto.reduce((a, c) => a + c.pct, 0);
  const itens = [...cats.map((c) => ({ chave: c.cat, pct: c.pct })), ...(resto.length ? [{ chave: RESTO, pct: restoPct }] : [])];
  const fatias = fatiasRosca(itens, C, GAP);
  const rotulo = [...cats.map((c) => `${catN(c.cat)} ${Math.round(c.pct * 100)}%`), ...(resto.length ? [`mais ${resto.length} categorias ${Math.round(restoPct * 100)}%`] : [])].join(', ');
  return (
    <div className="pf-rosca">
      <svg viewBox="0 0 170 170" role="img" aria-label={`Gastos por categoria: ${rotulo}`}>
        <circle cx="85" cy="85" r={R} className="pf-trilho" />
        {fatias.map((f) => (
          <circle key={f.chave} cx="85" cy="85" r={R} className="pf-fatia" data-fatia={f.chave} stroke={corFatia(f.chave)} strokeDasharray={`${f.len} ${C}`} strokeDashoffset={-f.off} />
        ))}
      </svg>
      <div className="pf-centro"><span>gastos</span><b className="num">{brl(total).replace(/,\d\d$/, '')}</b></div>
    </div>
  );
}

export function ParaOndeFoi() {
  const D = useData();
  const hoje = today();
  const atual = monthKey(hoje);
  const [mk, setMk] = useState(atual);
  const [todas, setTodas] = useState(false);
  const g = useMemo(() => gastosDoMes(D, mk, hoje), [D, mk, hoje]);
  const comAno = mk.slice(0, 4) !== atual.slice(0, 4);
  const linhas = todas || g.cats.length <= MAX_LINHAS ? g.cats : g.cats.slice(0, MAX_LINHAS - 1);
  const resto = g.cats.slice(linhas.length);
  const maior = g.cats[0]?.total ?? 1;
  const resumo = resumoGastos(g, catN);

  return (
    <>
      <div className="hero pf">
        <div className="pf-mes">
          <button className="pf-seta" aria-label="Mês anterior" onClick={() => { setMk(addMonths(mk, -1)); setTodas(false); }}><Ico n="voltar" size={18} /></button>
          <span className="pf-nome">{nomeMes(mk, comAno)}{g.parcial ? <small> · até hoje</small> : null}</span>
          <button className="pf-seta" aria-label="Próximo mês" disabled={mk >= atual} onClick={() => { setMk(addMonths(mk, 1)); setTodas(false); }}><Ico n="avancar" size={18} /></button>
        </div>
        {g.cats.length ? (
          <div className="pf-topo">
            <Rosca cats={linhas} resto={resto} total={g.total} />
            <div className="pf-lado">
              <Variacao agora={g.total} antes={g.totalAntes} mk={mk} />
              {g.ateDia && g.totalAntes > 0 && <small className="pf-cmp">comparando até o dia {g.ateDia}</small>}
              {resumo && <span className="pf-resumo">{resumo}</span>}
            </div>
          </div>
        ) : (
          <div className="pf-vazio">Nenhum gasto em {nomeMes(mk)}{g.parcial ? ' ainda' : ''}.</div>
        )}
      </div>

      {g.cats.length > 0 && (
        <div className="pf-lista">
          {linhas.map((c) => {
            const subiu = c.antes > 0 && c.total - c.antes >= 5_000 && c.total / c.antes >= 1.15;
            return (
              <button key={c.cat} className="pf-linha" onClick={() => openSheet(<CategoriaMes cat={c.cat} mk={mk} />)}>
                <CatTile cat={c.cat} />
                <span className="pf-meio">
                  <span className="pf-t"><b>{catN(c.cat)}{subiu && <small className="pf-sobe"> ↑ {brl(c.total - c.antes).replace(/,\d\d$/, '')}</small>}</b><b className="num">{brl(c.total)}</b></span>
                  <span className="pf-barra"><i style={{ width: `${Math.max(3, (c.total / maior) * 100)}%`, background: corDe(c.cat) }} /></span>
                </span>
                <span className="pf-pct num">{Math.round(c.pct * 100)}%</span>
              </button>
            );
          })}
          {resto.length > 0 && (
            <button className="pf-linha" onClick={() => setTodas(true)}>
              <CatTile cat="outros" />
              <span className="pf-meio">
                <span className="pf-t"><b>+ {resto.length} categorias</b><b className="num">{brl(resto.reduce((a, c) => a + c.total, 0))}</b></span>
                <span className="pf-barra"><i style={{ width: `${Math.max(3, (resto.reduce((a, c) => a + c.total, 0) / maior) * 100)}%`, background: 'var(--pf-resto)' }} /></span>
              </span>
              <span className="pf-pct num">{Math.round(resto.reduce((a, c) => a + c.pct, 0) * 100)}%</span>
            </button>
          )}
        </div>
      )}
      <div className="pf-nota">Compras no cartão contam no mês em que você comprou; parcelas, cada uma no seu mês. O pagamento da fatura não entra, pra não contar duas vezes.</div>
    </>
  );
}

export function CategoriaMes({ cat, mk }: { cat: string; mk: string }) {
  const D = getData();
  const hoje = today();
  const g = gastosDoMes(D, mk, hoje);
  const c = g.cats.find((x) => x.cat === cat);
  const hist = historicoCat(D, cat, mk, hoje);
  const maxH = Math.max(1, ...hist.map((h) => h.total));
  const verNoExtrato = () => {
    closeSheet();
    useUI.getState().pedirExtrato({ cat, mk });
    useUI.getState().setTab('extrato');
  };
  if (!c) return <><SheetHeader title={`${catN(cat)} · ${nomeMes(mk)}`} /><p className="mut">Nada nesta categoria em {nomeMes(mk)}.</p></>;
  return (
    <div className="pf-cat">
      <SheetHeader title={`${catN(cat)} · ${nomeMes(mk)}`} />
      <div className="pf-cat-topo">
        <CatTile cat={cat} />
        <span>
          <b className="num">{brl(c.total)}</b>
          <small>{Math.round(c.pct * 100)}% dos gastos{c.antes > 0 && <> · <Variacao agora={c.total} antes={c.antes} mk={mk} /></>}</small>
        </span>
      </div>
      <div className="pf-hist" role="img" aria-label={`Últimos 4 meses: ${hist.map((h) => `${MES[Number(h.mk.slice(5, 7)) - 1]} ${brl(h.total)}`).join(', ')}`}>
        <span className="pf-hist-t">Últimos 4 meses</span>
        <div className="pf-hist-b">
          {hist.map((h) => (
            <span key={h.mk} className={`pf-col ${h.mk === mk ? 'on' : ''}`}>
              <small className="num">{h.total ? brl(h.total).replace(/^R\$\s?/, '').replace(/,\d\d$/, '') : '—'}</small>
              <i style={{ height: `${Math.max(4, (h.total / maxH) * 60)}px`, background: corDe(cat) }} />
              <em>{MES[Number(h.mk.slice(5, 7)) - 1]}</em>
            </span>
          ))}
        </div>
      </div>
      <div className="lab">{c.itens.length} {c.itens.length === 1 ? 'gasto' : 'gastos'}</div>
      <div className="pf-itens" data-scroll>
        {c.itens.map((x, i) => (
          <div key={`${x.ref}-${x.data}-${i}`} className="pf-it">
            <span className="pf-it-t"><b>{nomeExib(x.desc)}{x.parcela && <small> {x.parcela.i}/{x.parcela.n}</small>}</b><small>{dm(x.data)} · {x.onde}{x.fixo ? ' · fixo' : ''}</small></span>
            <b className="num">{brl(x.valor)}</b>
          </div>
        ))}
      </div>
      <div className="actions"><Button kind="ghost" onClick={verNoExtrato}>Ver no Extrato</Button></div>
    </div>
  );
}
