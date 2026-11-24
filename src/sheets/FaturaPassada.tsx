/**
 * Uma fatura que já venceu, inteira: todas as compras, parcelas, puladas (FIN) e créditos.
 * Abre pelo histórico de faturas do cartão (importadas ou lançadas à mão).
 */
import { useState } from 'react';
import { analisarFatura, parteDe, type Parte } from '../lib/analiseFatura';
import { catN } from '../lib/categories';
import { dm, mesCurto, monthKey, today } from '../lib/dates';
import { doCartao } from '../lib/importacoes';
import { brl } from '../lib/money';
import { openSheet, useData } from '../store';
import { CatGlyph } from '../ui/CatIco';
import { Chip } from '../ui/Controls';
import { CartaoMini } from '../ui/Ico';
import { nomeExib } from '../ui/nome';
import { SheetHeader } from '../ui/Sheet';
import { catsDe, FiltroBar } from '../ui/Filtros';
import { QuickAdd } from './QuickAdd';

const fmt = (iso: string) => `${dm(iso)}/${iso.slice(2, 4)}`;
type Filtro = 'todas' | Parte | 'credito';
const COR: Record<Parte, string> = { mes: 'var(--fp-1)', novas: 'var(--fp-2)', antigas: 'var(--fp-3)', puladas: 'var(--fp-4)', fixos: 'var(--fp-5)', naoLanc: 'var(--fp-6)' };

export function FaturaPassadaSheet({ cartaoId, venc, voltar }: { cartaoId: string; venc: string; voltar?: () => void }) {
  const D = useData();
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [ordem, setOrdem] = useState('data');
  const [cat, setCat] = useState<string | null>(null);
  const c = D.cartoes.find((x) => x.id === cartaoId);
  if (!c) return null;
  const A = analisarFatura(D, c, venc, today());
  const f = A.f;
  const reg = doCartao(D, c.id).find((x) => x.venc === venc);
  const lanc = new Map(D.lancamentos.map((l) => [l.id, l]));
  // data da compra (a parcela mostra a data original da compra, como o banco)
  const linhas = f.itens.map((e) => ({ e, l: lanc.get(e.ref), p: parteDe(e) })).sort((x, y) => (x.l?.data ?? x.e.data).localeCompare(y.l?.data ?? y.e.data) || x.e.valor - y.e.valor);
  const doFiltro = linhas.filter((x) => filtro === 'todas' || x.p === filtro);
  const cats = catsDe(doFiltro.map((x) => x.e.cat));
  const catOk = cat && cats.some((c) => c.cat === cat) ? cat : null;
  const dataDe = (x: (typeof linhas)[number]) => x.l?.data ?? x.e.data;
  const vis = doFiltro.filter((x) => !catOk || x.e.cat === catOk).sort((a, b) =>
    ordem === 'data-' ? dataDe(b).localeCompare(dataDe(a)) || a.e.valor - b.e.valor
    : ordem === 'valor' ? Math.abs(b.e.valor) - Math.abs(a.e.valor)
    : ordem === 'valor-' ? Math.abs(a.e.valor) - Math.abs(b.e.valor)
    : dataDe(a).localeCompare(dataDe(b)) || a.e.valor - b.e.valor);
  const somaVis = -vis.reduce((s, x) => s + x.e.valor, 0);
  const hoje = today();

  return (
    <div className="sl">
      <SheetHeader title={`Fatura de ${mesCurto(monthKey(venc))}`} voltar={voltar ? { label: 'Faturas', onClick: voltar } : undefined} />
      <div className="sl-mid" data-scroll>
        <div className="fp-head">
          <CartaoMini c={c} />
          <div className="fp-meta">
            <div className="mut small">{c.nome} · {f.fecha <= hoje ? 'fechou' : 'fecha'} {fmt(f.fecha)} · {venc < hoje ? 'venceu' : 'vence'} {fmt(venc)}</div>
            <div className="fp-total num">{brl(f.total)}</div>
            {A.creditos > 0 && <div className="dim small">Compras {brl(A.compras)} · créditos −{brl(A.creditos)}</div>}
            {reg && <div className="dim small">{reg.conferida ? 'Importada e conferida com o banco' : 'Importada'}{reg.inferida ? '' : ` em ${dm(new Date(reg.quando).toISOString().slice(0, 10))}`}</div>}
          </div>
        </div>
        <Resumo A={A} filtro={filtro} setFiltro={setFiltro} />
        <div className="lab">Compras{filtro !== 'todas' ? ` · ${filtro === 'credito' ? 'Créditos' : A.partes.find((p) => p.id === filtro)?.label}` : ''}</div>
        <div className="chips scroll" style={{ margin: '0 0 10px' }}>
          <Chip on={filtro === 'todas'} onClick={() => setFiltro('todas')}>Todas · {linhas.length}</Chip>
          {A.partes.map((p) => <Chip key={p.id} on={filtro === p.id} onClick={() => setFiltro(p.id)}><span className="fp-dot" style={{ background: COR[p.id] }} />{p.label} · {p.n}</Chip>)}
          {A.nCred > 0 && <Chip on={filtro === 'credito'} onClick={() => setFiltro('credito')}>Créditos · {A.nCred}</Chip>}
        </div>
        <FiltroBar ordem={ordem} setOrdem={setOrdem} cat={catOk} setCat={setCat} cats={cats}
          opcoes={[{ id: 'data', label: 'Data (mais antiga)' }, { id: 'data-', label: 'Data (mais recente)' }, { id: 'valor', label: 'Maior valor' }, { id: 'valor-', label: 'Menor valor' }]} />
        <div className="fat-box">
          <div className="fat-itens">
            {vis.map(({ e, l }, k) => (
              <button key={k} className="fat-it" onClick={() => l && openSheet(<QuickAdd lanc={l} />)} disabled={!l}>
                <span><CatGlyph cat={e.cat} ico={e.ico} /></span>
                <span className="m">
                  <span className="m-n">{nomeExib(e.desc)}{e.fixo ? ' · fixo' : ''}</span>
                  <span className="fp-sub">{l ? fmt(l.data) : fmt(e.data)}{e.adiado && <span className="tag" title="Compra pulada (Pula Compra): paga nesta fatura">PULADA</span>}</span>
                </span>
                <span className={`num ${e.valor > 0 ? 'pos' : ''}`}>{brl(e.valor, e.valor > 0)}</span>
              </button>
            ))}
          </div>
          {(filtro !== 'todas' || catOk) && <div className="fat-tot"><span className="mut">{vis.length} {vis.length === 1 ? 'item' : 'itens'} filtrados</span><b className="num">{brl(somaVis)}</b></div>}
          {!vis.length && <div className="dim small" style={{ padding: '10px 0' }}>Nada com esse filtro.</div>}
          <div className="fat-tot"><span className="mut">Total da fatura</span><b className="num">{brl(f.total)}</b></div>
        </div>
      </div>
    </div>
  );
}

/** Resumo no topo: composição (barra), comparação, o que continua e categorias. */
function Resumo({ A, filtro, setFiltro }: { A: ReturnType<typeof analisarFatura>; filtro: Filtro; setFiltro: (f: Filtro) => void }) {
  const base = A.compras || 1;
  const var_ = A.anterior ? A.total - A.anterior.total : 0;
  const maxF = Math.max(1, ...A.futuro.map((x) => x.valor));
  const totF = A.futuro.reduce((s, x) => s + x.valor, 0);
  return (
    <div className="fp-res">
      <div className="lab" style={{ marginTop: 16 }}>De que é feita</div>
      <div className="fp-card">
        <div className="fp-bar" role="img" aria-label={A.partes.map((p) => `${p.label} ${brl(p.valor)}`).join(', ')}>
          {A.partes.map((p) => <span key={p.id} style={{ flexGrow: p.valor, background: COR[p.id] }} className={p.id === 'naoLanc' ? 'hatch' : ''} />)}
        </div>
        {A.partes.map((p) => (
          <button key={p.id} className={`fp-leg ${filtro === p.id ? 'on' : ''}`} onClick={() => setFiltro(filtro === p.id ? 'todas' : p.id)}>
            <span className={`fp-dot ${p.id === 'naoLanc' ? 'hatch' : ''}`} style={{ background: COR[p.id] }} />
            <span className="fp-leg-t"><b>{p.label}</b><span className="dim">{p.n} {p.n === 1 ? 'item' : 'itens'} · {p.dica}</span></span>
            <span className="fp-leg-v"><b className="num">{brl(p.valor)}</b><span className="dim num">{Math.round((p.valor / base) * 100)}%</span></span>
          </button>
        ))}
        {A.creditos > 0 && (
          <button className={`fp-leg ${filtro === 'credito' ? 'on' : ''}`} onClick={() => setFiltro(filtro === 'credito' ? 'todas' : 'credito')}>
            <span className="fp-dot cred" />
            <span className="fp-leg-t"><b>Créditos</b><span className="dim">{A.nCred} {A.nCred === 1 ? 'item' : 'itens'} · estornos e Pula Compra</span></span>
            <span className="fp-leg-v"><b className="num pos">+{brl(A.creditos)}</b></span>
          </button>
        )}
      </div>

      {(A.anterior || A.maior) && (
        <div className="fp-fatos">
          {A.anterior && (
            <div className="fp-fato">
              <span className="dim small">vs. fatura de {mesCurto(monthKey(A.anterior.venc))}</span>
              <b className={`num ${var_ > 0 ? 'neg' : var_ < 0 ? 'pos' : ''}`}>{var_ === 0 ? 'igual' : `${var_ > 0 ? '+' : '−'}${brl(Math.abs(var_))}`}</b>
              <span className="dim small">era {brl(A.anterior.total)}{A.anterior.total ? ` · ${var_ >= 0 ? '+' : '−'}${Math.round(Math.abs(var_ / A.anterior.total) * 100)}%` : ''}</span>
            </div>
          )}
          {A.maior && (
            <div className="fp-fato">
              <span className="dim small">maior compra</span>
              <b className="num">{brl(-A.maior.valor)}</b>
              <span className="dim small fp-ell">{nomeExib(A.maior.desc)}</span>
            </div>
          )}
        </div>
      )}

      {A.futuro.length > 0 && (
        <>
          <div className="lab">Continua nas próximas faturas</div>
          <div className="fp-card">
            <div className="dim small" style={{ marginBottom: 8 }}>Das parceladas desta fatura, ainda faltam <b className="num">{brl(totF).replace('R$ ', 'R$\u00a0')}</b>, até {mesCurto(monthKey(A.futuro[A.futuro.length - 1].venc))}.</div>
            {A.futuro.slice(0, 6).map((x) => (
              <div key={x.venc} className="fp-row">
                <span className="fp-row-l">{mesCurto(monthKey(x.venc))}</span>
                <span className="fp-row-b"><span style={{ width: `${(x.valor / maxF) * 100}%` }} /></span>
                <span className="num fp-row-v">{brl(x.valor)}</span>
              </div>
            ))}
            {A.futuro.length > 6 && <div className="dim small" style={{ marginTop: 6 }}>e mais {A.futuro.length - 6} {A.futuro.length - 6 === 1 ? 'mês' : 'meses'}</div>}
          </div>
        </>
      )}

      {A.categorias.length > 0 && (
        <>
          <div className="lab">Onde foi o dinheiro</div>
          <div className="fp-card">
            {A.categorias.slice(0, 5).map((x) => (
              <div key={x.cat} className="fp-row">
                <span className="fp-row-l"><CatGlyph cat={x.cat} />{catN(x.cat)}</span>
                <span className="fp-row-b cat"><span style={{ width: `${x.pct * 100}%` }} /></span>
                <span className="num fp-row-v">{brl(x.valor)}<span className="dim"> · {Math.round(x.pct * 100)}%</span></span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
