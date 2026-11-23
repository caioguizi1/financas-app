import { AnimatePresence, m } from 'motion/react';
import { useState } from 'react';
import { diaLabel, dm, MESL, monthKey, today } from '../lib/dates';
import { resumoMes } from '../lib/engine';
import { ativaEm, serieDe } from '../lib/versions';
import type { Recorrente } from '../lib/types';
import { ExtraSheet } from '../sheets/Extras';
import { RendaSheet, resumoRenda } from '../sheets/Renda';
import { brl } from '../lib/money';
import type { Evento } from '../lib/types';
import { openSheet, resetData, useData, useUI } from '../store';
import { EditCartao } from '../sheets/EditCartao';
import { EditRec } from '../sheets/EditRec';
import { AjustarSaldo, EditNome } from '../sheets/Misc';
import { Button, itemVariants, listVariants } from '../ui/Controls';
import { IChevron } from '../ui/Icons';
import { EvItem, RecItem } from '../ui/Items';
import { AnimatedBRL } from '../ui/Money';
import { spring } from '../ui/motion';
import { exportar, importar } from './backup';

/* ================= Extrato ================= */
export function Extrato() {
  const D = useData();
  const n = new Date();
  const [[y, mo], setYM] = useState<[number, number]>([n.getFullYear(), n.getMonth()]);
  const [dir, setDir] = useState(1);
  const r = resumoMes(D, y, mo);
  const t = today();
  const byDay = new Map<string, Evento[]>();
  r.evs.forEach((e) => byDay.set(e.data, [...(byDay.get(e.data) ?? []), e]));
  const days = [...byDay.keys()].sort().reverse();
  const sob = r.ent - r.sai;
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
        <div><div className="k">Entrou</div><div className="v num pos"><AnimatedBRL value={r.ent} /></div></div>
        <div><div className="k">Saiu</div><div className="v num"><AnimatedBRL value={-r.sai} /></div></div>
        <div><div className="k">Sobra</div><div className={`v num ${sob < 0 ? 'neg' : 'pos'}`}><AnimatedBRL value={sob} sign /></div></div>
      </div>
      <m.div key={`${y}-${mo}`} variants={listVariants} initial="hidden" animate="shown">
        {days.length ? days.map((d) => {
          const tot = byDay.get(d)!.reduce((a, e) => a + e.valor, 0);
          return (
            <m.div key={d} variants={itemVariants}>
              <div className="day"><span>{diaLabel(d)}{d > t ? ' · previsto' : ''}</span><span className="num">{brl(tot, true)}</span></div>
              <div className="list"><AnimatePresence initial={false}>{byDay.get(d)!.map((e) => <EvItem key={`${e.ref}-${e.desc}`} e={e} showDate={false} />)}</AnimatePresence></div>
            </m.div>
          );
        }) : <div className="card empty" style={{ marginTop: 14 }}>Nenhuma movimentação neste mês.</div>}
      </m.div>
      <div className="footnote">Compras no cartão aparecem no dia em que a fatura vence.</div>
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
      <div className={`alert ${te - ts < 0 ? '' : 'ok'}`}><span>{te - ts < 0 ? '⚠️' : '💡'}</span><div>Sobra fixa de <b>{brl(te - ts, true)}</b> por mês, antes dos gastos do dia a dia.</div></div>
      <div className="mut small" style={{ margin: '14px 2px -6px' }}>Deslize um item pro lado pra editar ou apagar.</div>
      <h2>Entradas</h2>
      {ent.length > 0 && <m.div className="list" variants={listVariants} initial="hidden" animate="shown"><AnimatePresence>{ent.map((x) => <RecItem key={x.r.id} r={x.r} prox={x.prox} />)}</AnimatePresence></m.div>}
      <div className="btn-row">
        <Button kind="ghost" onClick={() => openSheet(<RendaSheet />)}>💼 Minha renda</Button>
        <Button kind="ghost" onClick={() => openSheet(<EditRec tipo="entrada" />)}>＋ Outro fixo</Button>
      </div>
      <h2>Extras previstos</h2>
      <div className="mut small" style={{ margin: '-6px 2px 10px' }}>13º, PLR, férias, bônus… entram na projeção na data prevista.</div>
      {extras.length > 0 && (
        <m.div className="list" variants={listVariants} initial="hidden" animate="shown">
          <AnimatePresence initial={false}>
            {extras.map((l) => <EvItem key={l.id} e={{ data: l.data, valor: l.valor, desc: l.desc, cat: l.cat, ico: l.ico, ref: l.id, lanc: true, cartao: null, criado: l.criado }} />)}
          </AnimatePresence>
        </m.div>
      )}
      <Button kind="ghost" style={{ marginTop: 10 }} onClick={() => openSheet(<ExtraSheet />)}>＋ 13º, PLR, férias, bônus…</Button>
      <h2>Saídas</h2>
      {sai.length > 0 && <m.div className="list" variants={listVariants} initial="hidden" animate="shown"><AnimatePresence>{sai.map((x) => <RecItem key={x.r.id} r={x.r} prox={x.prox} />)}</AnimatePresence></m.div>}
      <Button kind="ghost" style={{ marginTop: 10 }} onClick={() => openSheet(<EditRec tipo="saida" />)}>＋ Gasto fixo</Button>
    </>
  );
}

/* ================= Ajustes ================= */
export function Ajustes() {
  const D = useData();
  const [confirm, setConfirm] = useState(false);
  const Row = ({ ico, t, s, onClick }: { ico: string; t: string; s?: string; onClick: () => void }) => (
    <m.button variants={itemVariants} className="item" onClick={onClick}>
      <div className="ico">{ico}</div><div className="m"><div className="t">{t}</div>{s && <div className="s">{s}</div>}</div><span className="dim"><IChevron /></span>
    </m.button>
  );
  return (
    <>
      <h1 style={{ marginBottom: 6 }}>Ajustes</h1>
      <h2>Você</h2>
      <m.div className="list" variants={listVariants} initial="hidden" animate="shown">
        <Row ico="🙂" t="Nome" s={D.perfil.nome} onClick={() => openSheet(<EditNome />)} />
        <Row ico="🏦" t="Conferir saldo com o banco" s={`Último ajuste: ${dm(D.saldo.data)}`} onClick={() => openSheet(<AjustarSaldo />)} />
        <Row ico="💼" t="Minha renda" s={resumoRenda()} onClick={() => openSheet(<RendaSheet />)} />
        <Row ico="🎁" t="Recebimentos extras" s="13º, PLR, férias, bônus, IR" onClick={() => openSheet(<ExtraSheet />)} />
      </m.div>
      <h2>Cartões</h2>
      {D.cartoes.length > 0 && (
        <m.div className="list" variants={listVariants} initial="hidden" animate="shown">
          {D.cartoes.map((c) => <Row key={c.id} ico="💳" t={c.nome} s={`Fecha dia ${c.fechamento} · vence dia ${c.vencimento}`} onClick={() => openSheet(<EditCartao cartao={c} />)} />)}
        </m.div>
      )}
      <Button kind="ghost" style={{ marginTop: 10 }} onClick={() => openSheet(<EditCartao />)}>＋ Adicionar cartão</Button>
      <h2>Seus dados</h2>
      <div className="mut small" style={{ margin: '-4px 2px 10px' }}>Tudo fica salvo só neste aparelho. Faça backup de vez em quando.</div>
      <m.div className="list" variants={listVariants} initial="hidden" animate="shown">
        <Row ico="⬆️" t="Exportar backup" s="Salvar arquivo no Arquivos/iCloud" onClick={exportar} />
        <Row ico="⬇️" t="Restaurar backup" s="Substitui os dados atuais" onClick={importar} />
      </m.div>
      <Button kind="danger" style={{ marginTop: 22 }} onClick={() => { if (!confirm) return setConfirm(true); resetData(); useUI.getState().setTab('home'); }}>
        {confirm ? 'Toque de novo pra apagar TUDO' : 'Apagar tudo e recomeçar'}
      </Button>
      <div className="footnote">Fluxo · v{__APP_VERSION__}</div>
    </>
  );
}
