import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { diaLabel, dm, MESL, monthKey, today } from '../lib/dates';
import { resumoMes } from '../lib/engine';
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
  const [[y, m], setYM] = useState<[number, number]>([n.getFullYear(), n.getMonth()]);
  const [dir, setDir] = useState(1);
  const r = resumoMes(D, y, m);
  const t = today();
  const byDay = new Map<string, Evento[]>();
  r.evs.forEach((e) => byDay.set(e.data, [...(byDay.get(e.data) ?? []), e]));
  const days = [...byDay.keys()].sort().reverse();
  const sob = r.ent - r.sai;
  const move = (d: 1 | -1) => { const x = new Date(y, m + d, 1); setDir(d); setYM([x.getFullYear(), x.getMonth()]); };

  return (
    <>
      <h1 style={{ marginBottom: 16 }}>Extrato</h1>
      <div className="mnav">
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => move(-1)} aria-label="Mês anterior">‹</motion.button>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.b key={`${y}-${m}`} custom={dir} initial={{ x: dir * 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: dir * -30, opacity: 0 }} transition={spring}>{MESL[m]} {y}</motion.b>
        </AnimatePresence>
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => move(1)} aria-label="Próximo mês">›</motion.button>
      </div>
      <div className="tot">
        <div><div className="k">Entrou</div><div className="v num pos"><AnimatedBRL value={r.ent} /></div></div>
        <div><div className="k">Saiu</div><div className="v num"><AnimatedBRL value={-r.sai} /></div></div>
        <div><div className="k">Sobra</div><div className={`v num ${sob < 0 ? 'neg' : 'pos'}`}><AnimatedBRL value={sob} sign /></div></div>
      </div>
      <motion.div key={`${y}-${m}`} variants={listVariants} initial="hidden" animate="shown">
        {days.length ? days.map((d) => {
          const tot = byDay.get(d)!.reduce((a, e) => a + e.valor, 0);
          return (
            <motion.div key={d} variants={itemVariants}>
              <div className="day"><span>{diaLabel(d)}{d > t ? ' · previsto' : ''}</span><span className="num">{brl(tot, true)}</span></div>
              <div className="list">{byDay.get(d)!.map((e, i) => <EvItem key={`${e.ref}-${i}`} e={e} showDate={false} />)}</div>
            </motion.div>
          );
        }) : <div className="card empty" style={{ marginTop: 14 }}>Nenhuma movimentação neste mês.</div>}
      </motion.div>
      <div className="footnote">Compras no cartão aparecem no dia em que a fatura vence.</div>
    </>
  );
}

/* ================= Fixos ================= */
export function Fixos() {
  const D = useData();
  const mk = monthKey(today());
  const ativos = D.recorrentes.filter((r) => !r.fim || r.fim >= mk);
  const ent = ativos.filter((r) => r.tipo === 'entrada').sort((a, b) => a.dia - b.dia);
  const sai = ativos.filter((r) => r.tipo === 'saida').sort((a, b) => a.dia - b.dia);
  const te = ent.reduce((a, r) => a + r.valor, 0);
  const ts = sai.reduce((a, r) => a + r.valor, 0);
  return (
    <>
      <h1>Fixos</h1><div className="mut" style={{ marginTop: 4 }}>Tudo que se repete todo mês, automático.</div>
      <div className="stats">
        <div className="stat"><div className="k">Entra por mês</div><div className="v num pos"><AnimatedBRL value={te} /></div></div>
        <div className="stat"><div className="k">Sai por mês</div><div className="v num"><AnimatedBRL value={-ts} /></div></div>
      </div>
      <div className={`alert ${te - ts < 0 ? '' : 'ok'}`}><span>{te - ts < 0 ? '⚠️' : '💡'}</span><div>Sobra fixa de <b>{brl(te - ts, true)}</b> por mês, antes dos gastos do dia a dia.</div></div>
      <h2>Entradas</h2>
      {ent.length > 0 && <motion.div className="list" variants={listVariants} initial="hidden" animate="shown"><AnimatePresence>{ent.map((r) => <RecItem key={r.id} r={r} />)}</AnimatePresence></motion.div>}
      <Button kind="ghost" style={{ marginTop: 10 }} onClick={() => openSheet(<EditRec tipo="entrada" />)}>＋ Recebimento fixo</Button>
      <h2>Saídas</h2>
      {sai.length > 0 && <motion.div className="list" variants={listVariants} initial="hidden" animate="shown"><AnimatePresence>{sai.map((r) => <RecItem key={r.id} r={r} />)}</AnimatePresence></motion.div>}
      <Button kind="ghost" style={{ marginTop: 10 }} onClick={() => openSheet(<EditRec tipo="saida" />)}>＋ Gasto fixo</Button>
    </>
  );
}

/* ================= Ajustes ================= */
export function Ajustes() {
  const D = useData();
  const [confirm, setConfirm] = useState(false);
  const Row = ({ ico, t, s, onClick }: { ico: string; t: string; s?: string; onClick: () => void }) => (
    <motion.button variants={itemVariants} className="item" onClick={onClick}>
      <div className="ico">{ico}</div><div className="m"><div className="t">{t}</div>{s && <div className="s">{s}</div>}</div><span className="dim"><IChevron /></span>
    </motion.button>
  );
  return (
    <>
      <h1 style={{ marginBottom: 6 }}>Ajustes</h1>
      <h2>Você</h2>
      <motion.div className="list" variants={listVariants} initial="hidden" animate="shown">
        <Row ico="🙂" t="Nome" s={D.perfil.nome} onClick={() => openSheet(<EditNome />)} />
        <Row ico="🏦" t="Conferir saldo com o banco" s={`Último ajuste: ${dm(D.saldo.data)}`} onClick={() => openSheet(<AjustarSaldo />)} />
      </motion.div>
      <h2>Cartões</h2>
      {D.cartoes.length > 0 && (
        <motion.div className="list" variants={listVariants} initial="hidden" animate="shown">
          {D.cartoes.map((c) => <Row key={c.id} ico="💳" t={c.nome} s={`Fecha dia ${c.fechamento} · vence dia ${c.vencimento}`} onClick={() => openSheet(<EditCartao cartao={c} />)} />)}
        </motion.div>
      )}
      <Button kind="ghost" style={{ marginTop: 10 }} onClick={() => openSheet(<EditCartao />)}>＋ Adicionar cartão</Button>
      <h2>Seus dados</h2>
      <div className="mut small" style={{ margin: '-4px 2px 10px' }}>Tudo fica salvo só neste aparelho. Faça backup de vez em quando.</div>
      <motion.div className="list" variants={listVariants} initial="hidden" animate="shown">
        <Row ico="⬆️" t="Exportar backup" s="Salvar arquivo no Arquivos/iCloud" onClick={exportar} />
        <Row ico="⬇️" t="Restaurar backup" s="Substitui os dados atuais" onClick={importar} />
      </motion.div>
      <Button kind="danger" style={{ marginTop: 22 }} onClick={() => { if (!confirm) return setConfirm(true); resetData(); useUI.getState().setTab('home'); }}>
        {confirm ? 'Toque de novo pra apagar TUDO' : 'Apagar tudo e recomeçar'}
      </Button>
      <div className="footnote">Fluxo · v{__APP_VERSION__}</div>
    </>
  );
}
