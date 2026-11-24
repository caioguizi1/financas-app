import { AnimatePresence, m } from 'motion/react';
import { useState } from 'react';
import { diaLabel, dm, MESL, monthKey, today } from '../lib/dates';
import { resumoMes } from '../lib/engine';
import { ativaEm, serieDe } from '../lib/versions';
import { agruparFaturas, comprasNoCartao } from '../lib/faturas';
import type { Recorrente } from '../lib/types';
import { ExtraSheet } from '../sheets/Extras';
import { ImportarSheet } from '../sheets/Importar';
import { CarteiraSheet } from '../sheets/Carteira';
import { RendaSheet, resumoRenda } from '../sheets/Renda';
import { brl } from '../lib/money';
import type { Evento } from '../lib/types';
import { openSheet, resetData, useData, useUI } from '../store';
import { EditCartao } from '../sheets/EditCartao';
import { EditRec } from '../sheets/EditRec';
import { AjustarSaldo, EditNome } from '../sheets/Misc';
import { Button, Chip, itemVariants, Segmented } from '../ui/Controls';
import { catN } from '../lib/categories';
import { getTema, setTema, type Tema } from '../lib/tema';
import { IChevron } from '../ui/Icons';
import { Lista } from '../ui/Lista';
import { CompraCartaoItem, EvItem, RecItem } from '../ui/Items';
import { AnimatedBRL } from '../ui/Money';
import { spring } from '../ui/motion';
import { exportar, importar } from './backup';
import { Aviso } from '../ui/Aviso';
import { CatGlyph, useEstiloIco } from '../ui/CatIco';
import { setEstiloIco } from '../lib/estiloIco';
import { CartaoMini, Ico } from '../ui/Ico';

/* ================= Extrato ================= */
export function Extrato() {
  const D = useData();
  const n = new Date();
  const [[y, mo], setYM] = useState<[number, number]>([n.getFullYear(), n.getMonth()]);
  const [dir, setDir] = useState(1);
  const r = resumoMes(D, y, mo);
  const t = today();
  // filtro por categoria: mostra cada compra (inclusive as do cartão, no dia da fatura) e o total da categoria
  const [cat, setCat] = useState<string | null>(null);
  const cats = new Map<string, number>();
  for (const e of r.evs) if (e.valor < 0) cats.set(e.cat, (cats.get(e.cat) ?? 0) - e.valor);
  const listaCats = [...cats.entries()].sort((a, b) => b[1] - a[1]);
  const evsView = cat ? r.evs.filter((e) => e.cat === cat) : agruparFaturas(r.evs, D.cartoes);
  const ent = cat ? evsView.filter((e) => e.valor > 0).reduce((a, e) => a + e.valor, 0) : r.ent;
  const sai = cat ? -evsView.filter((e) => e.valor < 0).reduce((a, e) => a + e.valor, 0) : r.sai;
  const byDay = new Map<string, Evento[]>();
  evsView.forEach((e) => byDay.set(e.data, [...(byDay.get(e.data) ?? []), e]));
  // compras no cartão no dia da compra: só informativo (saem da conta no vencimento da fatura)
  const ini = `${y}-${String(mo + 1).padStart(2, '0')}-01`, fim = `${y}-${String(mo + 1).padStart(2, '0')}-31`;
  const cartao = comprasNoCartao(D, ini, fim).filter((x) => !cat || x.l.cat === cat);
  const cartaoDia = new Map<string, typeof cartao>();
  cartao.forEach((x) => cartaoDia.set(x.l.data, [...(cartaoDia.get(x.l.data) ?? []), x]));
  const days = [...new Set([...byDay.keys(), ...cartaoDia.keys()])].sort().reverse();
  const sob = ent - sai;
  const move = (d: 1 | -1) => { const x = new Date(y, mo + d, 1); setDir(d); setYM([x.getFullYear(), x.getMonth()]); };

  return (
    <>
      <h1 style={{ marginBottom: 16 }}>Extrato</h1>
      <div className="mnav">
        <m.button whileTap={{ scale: 0.85 }} onClick={() => move(-1)} aria-label="Mês anterior">‹</m.button>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <m.b key={`${y}-${mo}`} custom={dir} initial={{ x: dir * 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: dir * -30, opacity: 0 }} transition={spring}>{MESL[mo]} {y}</m.b>
        </AnimatePresence>
        <m.button whileTap={{ scale: 0.85 }} onClick={() => move(1)} aria-label="Próximo mês">›</m.button>
      </div>
      <div className="tot">
        <div><div className="k">Entrou</div><div className="v num pos"><AnimatedBRL value={ent} /></div></div>
        <div><div className="k">{cat ? `Em ${catN(cat)}` : 'Saiu'}</div><div className="v num"><AnimatedBRL value={-sai} /></div></div>
        {cat
          ? <div><div className="k">Do total</div><div className="v num">{r.sai ? Math.round((sai / r.sai) * 100) : 0}%</div></div>
          : <div><div className="k">Sobra</div><div className={`v num ${sob < 0 ? 'neg' : 'pos'}`}><AnimatedBRL value={sob} sign /></div></div>}
      </div>
      {listaCats.length > 1 && (
        <div className="catf">
          <Chip on={!cat} onClick={() => setCat(null)}>Todas</Chip>
          {listaCats.map(([k, v]) => <Chip key={k} on={cat === k} onClick={() => setCat(cat === k ? null : k)}><CatGlyph cat={k} />{catN(k)} · {brl(v)}</Chip>)}
          {cat && !cats.has(cat) && <Chip on onClick={() => setCat(null)}><CatGlyph cat={cat} />{catN(cat)}</Chip>}
        </div>
      )}
      <Lista key={`${y}-${mo}-${cat ?? ''}`}>
        {days.length ? days.map((d) => {
          const evd = byDay.get(d) ?? [];
          const tot = evd.reduce((a, e) => a + e.valor, 0);
          return (
            <m.div key={d} variants={itemVariants}>
              <div className="day"><span>{diaLabel(d)}{d > t ? ' · previsto' : ''}</span>{evd.length > 0 && <span className="num">{brl(tot, true)}</span>}</div>
              {evd.length > 0 && <div className="list"><AnimatePresence initial={false}>
                {evd.map((e) => <EvItem key={`${e.ref}-${e.desc}`} e={e} showDate={false} />)}
              </AnimatePresence></div>}
              {(cartaoDia.get(d) ?? []).length > 0 && (
                <>
                  <div className="nc-lab"><span>No cartão · sai na fatura</span><span className="num">{brl(-(cartaoDia.get(d) ?? []).reduce((s, x) => s + x.l.valor, 0))}</span></div>
                  <div className="list nc-list"><AnimatePresence initial={false}>
                    {(cartaoDia.get(d) ?? []).map((x) => <CompraCartaoItem key={`cc-${x.l.id}`} l={x.l} cartao={x.cartao} venc={x.venc} />)}
                  </AnimatePresence></div>
                </>
              )}
            </m.div>
          );
        }) : <div className="card empty" style={{ marginTop: 14 }}>{cat ? `Nada em ${catN(cat)} neste mês.` : 'Nenhuma movimentação neste mês.'}</div>}
      </Lista>
      <div className="footnote">Compras no cartão aparecem no dia da compra como "no cartão" (sem entrar nos totais) e saem da conta no dia em que a fatura vence.</div>
    </>
  );
}

/* ================= Fixos ================= */
export function Fixos() {
  const D = useData();
  const mk = monthKey(today());
  // uma linha por série: a versão de agora (ou a próxima, se ainda vai começar) + a mudança agendada
  const series = new Map<string, Recorrente[]>();
  D.recorrentes.forEach((r) => series.set(serieDe(r), [...(series.get(serieDe(r)) ?? []), r]));
  const linhas = [...series.values()].flatMap((vs) => {
    vs.sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
    const atual = vs.find((v) => ativaEm(v, mk)) ?? vs.find((v) => v.inicio > mk);
    if (!atual) return [];
    return [{ r: atual, prox: vs.find((v) => v.inicio > atual.inicio && v.inicio > mk) }];
  });
  const ent = linhas.filter((x) => x.r.tipo === 'entrada').sort((a, b) => a.r.dia - b.r.dia);
  const sai = linhas.filter((x) => x.r.tipo === 'saida').sort((a, b) => a.r.dia - b.r.dia);
  const soma = (xs: typeof linhas) => xs.reduce((a, x) => a + (ativaEm(x.r, mk) ? x.r.valor : 0), 0);
  const te = soma(ent);
  const ts = soma(sai);
  const t = today();
  const extras = D.lancamentos.filter((l) => l.tipo === 'entrada' && l.data >= t).sort((a, b) => (a.data < b.data ? -1 : 1));
  return (
    <>
      <h1>Fixos</h1><div className="mut" style={{ marginTop: 4 }}>Tudo que se repete todo mês, automático.</div>
      <div className="stats">
        <div className="stat"><div className="k">Entra por mês</div><div className="v num pos"><AnimatedBRL value={te} /></div></div>
        <div className="stat"><div className="k">Sai por mês</div><div className="v num"><AnimatedBRL value={-ts} /></div></div>
      </div>
      <Aviso nivel={te - ts < 0 ? 'atencao' : 'bom'}>Sobra fixa de <b>{brl(te - ts, true)}</b> por mês, antes dos gastos do dia a dia.</Aviso>
      <div className="mut small" style={{ margin: '14px 2px -6px' }}>Deslize um item pro lado pra editar ou apagar.</div>
      <h2>Entradas</h2>
      {ent.length > 0 && <Lista className="list"><AnimatePresence>{ent.map((x) => <RecItem key={x.r.id} r={x.r} prox={x.prox} />)}</AnimatePresence></Lista>}
      <div className="btn-row">
        <Button kind="ghost" onClick={() => openSheet(<RendaSheet />)}><CatGlyph cat="salario" ico="💼" />Minha renda</Button>
        <Button kind="ghost" onClick={() => openSheet(<EditRec tipo="entrada" />)}>＋ Outro fixo</Button>
      </div>
      <h2>Extras previstos</h2>
      <div className="mut small" style={{ margin: '-6px 2px 10px' }}>13º, PLR, férias, bônus… entram na projeção na data prevista.</div>
      {extras.length > 0 && (
        <Lista className="list">
          <AnimatePresence initial={false}>
            {extras.map((l) => <EvItem key={l.id} e={{ data: l.data, valor: l.valor, desc: l.desc, cat: l.cat, ico: l.ico, ref: l.id, lanc: true, cartao: null, criado: l.criado }} />)}
          </AnimatePresence>
        </Lista>
      )}
      <Button kind="ghost" style={{ marginTop: 10 }} onClick={() => openSheet(<ExtraSheet />)}>＋ 13º, PLR, férias, bônus…</Button>
      <h2>Saídas</h2>
      {sai.length > 0 && <Lista className="list"><AnimatePresence>{sai.map((x) => <RecItem key={x.r.id} r={x.r} prox={x.prox} />)}</AnimatePresence></Lista>}
      <Button kind="ghost" style={{ marginTop: 10 }} onClick={() => openSheet(<EditRec tipo="saida" />)}>＋ Gasto fixo</Button>
    </>
  );
}

/* ================= Ajustes ================= */
export function Ajustes() {
  const D = useData();
  const [confirm, setConfirm] = useState(false);
  const [tema, setT] = useState<Tema>(getTema);
  const estiloIco = useEstiloIco();
  const Row = ({ ico, t, s, onClick }: { ico: React.ReactNode; t: string; s?: string; onClick: () => void }) => (
    <m.button variants={itemVariants} className="item" onClick={onClick}>
      <div className="ico">{ico}</div><div className="m"><div className="t">{t}</div>{s && <div className="s">{s}</div>}</div><span className="dim"><IChevron /></span>
    </m.button>
  );
  return (
    <>
      <h1 style={{ marginBottom: 6 }}>Ajustes</h1>
      <h2>Você</h2>
      <Lista className="list">
        <Row ico={<Ico n="nome" size={20} />} t="Nome" s={D.perfil.nome} onClick={() => openSheet(<EditNome />)} />
        {D.cartoes.length > 0 && <Row ico={<Ico n="carteira" size={20} />} t="Carteira e faturas" s={D.cartoes.map((c) => c.nome).join(', ')} onClick={() => openSheet(<CarteiraSheet />)} />}
        <Row ico={<Ico n="importar" size={20} />} t="Importar fatura ou extrato" s="Opcional · CSV, OFX ou PDF" onClick={() => openSheet(<ImportarSheet />)} />
        <Row ico={<Ico n="saldo" size={20} />} t="Conferir saldo com o banco" s={`Último ajuste: ${dm(D.saldo.data)}`} onClick={() => openSheet(<AjustarSaldo />)} />
        <Row ico={<CatGlyph cat="salario" ico="💼" size={20} />} t="Minha renda" s={resumoRenda()} onClick={() => openSheet(<RendaSheet />)} />
        <Row ico={<CatGlyph cat="extra" ico="🎁" size={20} />} t="Recebimentos extras" s="13º, PLR, férias, bônus, IR" onClick={() => openSheet(<ExtraSheet />)} />
      </Lista>
      <h2>Cartões</h2>
      {D.cartoes.length > 0 && (
        <Lista className="list">
          {D.cartoes.map((c) => <Row key={c.id} ico={<CartaoMini c={c} />} t={c.nome} s={`Fecha dia ${c.fechamento} · vence dia ${c.vencimento}`} onClick={() => openSheet(<EditCartao cartao={c} />)} />)}
        </Lista>
      )}
      <Button kind="ghost" style={{ marginTop: 10 }} onClick={() => openSheet(<EditCartao />)}>＋ Adicionar cartão</Button>
      <h2>Aparência</h2>
      <Segmented value={tema} onChange={(t) => { setT(t); setTema(t); }} options={[{ v: 'auto', label: <><Ico n="auto" size={16} />Auto</> }, { v: 'claro', label: <><Ico n="sol" size={16} />Claro</> }, { v: 'escuro', label: <><Ico n="lua" size={16} />Escuro</> }]} />
      <div className="dim hint" style={{ margin: '8px 2px 0' }}>Auto segue o modo do iPhone.</div>
      <div className="lab" style={{ margin: '16px 2px 8px' }}>Figuras das categorias</div>
      <Segmented value={estiloIco} onChange={setEstiloIco} options={[{ v: 'icone', label: <><CatGlyph cat="comida" ico="🍔" forcar="icone" />Ícones</> }, { v: 'emoji', label: <><CatGlyph cat="comida" ico="🍔" forcar="emoji" />Emoji</> }]} />
      <h2>Seus dados</h2>
      <div className="mut small" style={{ margin: '-4px 2px 10px' }}>Tudo fica salvo só neste aparelho. Faça backup de vez em quando.</div>
      <Lista className="list">
        <Row ico={<Ico n="exportar" size={20} />} t="Exportar backup" s="Salvar arquivo no Arquivos/iCloud" onClick={exportar} />
        <Row ico={<Ico n="restaurar" size={20} />} t="Restaurar backup" s="Substitui os dados atuais" onClick={importar} />
      </Lista>
      <Button kind="danger" style={{ marginTop: 22 }} onClick={() => { if (!confirm) return setConfirm(true); resetData(); useUI.getState().setTab('home'); }}>
        {confirm ? 'Toque de novo pra apagar TUDO' : 'Apagar tudo e recomeçar'}
      </Button>
      <div className="footnote">Fluxo · v{__APP_VERSION__}</div>
    </>
  );
}
