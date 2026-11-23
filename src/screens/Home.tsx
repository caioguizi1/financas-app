import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { dateOf, diaLabel, dm, MESL, saudacao, today } from '../lib/dates';
import { projecao, resumoMes } from '../lib/engine';
import { brl } from '../lib/money';
import { openSheet, useData } from '../store';
import { AjustarSaldo } from '../sheets/Misc';
import { BalanceChart } from '../ui/Chart';
import { Button, itemVariants, listVariants } from '../ui/Controls';
import { EvItem } from '../ui/Items';
import { AnimatedBRL } from '../ui/Money';
import { springSnappy } from '../ui/motion';

export function Home() {
  const D = useData();
  const [scrubI, setScrubI] = useState<number | null>(null);
  const t = today();
  const now = new Date();

  const m = useMemo(() => {
    const p = projecao(D, 90, t);
    const fut = p.pts.filter((x) => x.d >= t);
    const hoje = p.saldoEm(t) ?? D.saldo.valor;
    const fimMes = p.saldoEm(dateOf(now.getFullYear(), now.getMonth(), 31)) ?? hoje;
    const prox30 = fut.slice(0, 31);
    const min = prox30.reduce((a, b) => (b.v < a.v ? b : a), prox30[0]);
    const months = Array.from({ length: 6 }, (_, k) => {
      const d = new Date(now.getFullYear(), now.getMonth() + k, 1);
      const r = resumoMes(D, d.getFullYear(), d.getMonth());
      return { ...r, fim: p.saldoEm(r.ate), nome: MESL[d.getMonth()] + (d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : '') };
    });
    const prox = p.evs.filter((e) => e.data >= t).slice(0, 8);
    return { p, fut, hoje, fimMes, min, months, prox };
  }, [D, t]);

  const sp = scrubI != null ? m.fut[scrubI] : null;
  const spEvs = sp ? m.p.evs.filter((e) => e.data === sp.d) : [];
  const shown = sp ? sp.v : m.hoje;
  const ultimo = m.fut[m.fut.length - 1].v;

  return (
    <>
      <div className="top"><div><div className="hello">{saudacao()},</div><h1>{D.perfil.nome || 'você'}</h1></div></div>

      <motion.div className="hero" initial={{ opacity: 0, y: 12, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 26 }}>
        <div className="lbl">{sp ? diaLabel(sp.d) : 'Saldo hoje'}</div>
        <div className={`big num ${shown < 0 ? 'neg' : ''}`}>{sp ? brl(sp.v) : <AnimatedBRL value={m.hoje} />}</div>
        <div className="sub">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={sp ? sp.d : 'hint'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}>
              {sp ? (spEvs.length ? spEvs.map((e) => `${e.desc} ${brl(e.valor, true)}`).join(' · ') : 'Sem movimentação neste dia') : 'Toque e arraste no gráfico pra ver qualquer dia'}
            </motion.span>
          </AnimatePresence>
        </div>
        <BalanceChart pts={m.fut} onScrub={setScrubI} />
      </motion.div>

      <motion.div className="stats" variants={listVariants} initial="hidden" animate="shown">
        <motion.div variants={itemVariants} className="stat"><div className="k">Fim de {MESL[now.getMonth()]}</div><div className={`v num ${m.fimMes < 0 ? 'neg' : ''}`}><AnimatedBRL value={m.fimMes} /></div></motion.div>
        <motion.div variants={itemVariants} className="stat"><div className="k">Daqui a 90 dias</div><div className={`v num ${ultimo < 0 ? 'neg' : ''}`}><AnimatedBRL value={ultimo} /></div></motion.div>
      </motion.div>

      {m.min.v < 0 ? (
        <div className="alert"><span>⚠️</span><div>Seu saldo fica <b>negativo em {diaLabel(m.min.d).toLowerCase()}</b> ({brl(m.min.v)}). Vale segurar gastos até lá.</div></div>
      ) : (
        <div className="alert ok"><span>✅</span><div>Sem saldo negativo nos próximos 30 dias. Menor saldo: <b>{brl(m.min.v)}</b> em {dm(m.min.d)}.</div></div>
      )}

      <h2>Próximos meses</h2>
      <motion.div className="months" variants={listVariants} initial="hidden" animate="shown">
        {m.months.map((r) => {
          const tot = Math.max(r.ent + r.sai, 1);
          const sob = r.ent - r.sai;
          return (
            <motion.div key={r.de} variants={itemVariants} whileTap={{ scale: 0.98 }} transition={springSnappy} className="month">
              <div className="t">{r.nome}</div>
              <div className="bar">
                <motion.i initial={{ width: 0 }} animate={{ width: `${(r.ent / tot) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.2 }} style={{ background: 'var(--in)' }} />
                <motion.i initial={{ width: 0 }} animate={{ width: `${(r.sai / tot) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.3 }} style={{ background: 'var(--out)' }} />
              </div>
              <div className="l"><span className="mut">Entra</span><span className="num">{brl(r.ent)}</span></div>
              <div className="l"><span className="mut">Sai</span><span className="num">{brl(-r.sai)}</span></div>
              <div className="l"><span className="mut">Sobra do mês</span><b className={`num ${sob < 0 ? 'neg' : 'pos'}`}>{brl(sob, true)}</b></div>
              <div className="l end"><span className="mut">Saldo no fim</span><b className={`num ${(r.fim ?? 0) < 0 ? 'neg' : ''}`}>{r.fim == null ? '—' : brl(r.fim)}</b></div>
            </motion.div>
          );
        })}
      </motion.div>

      <h2>Vem aí</h2>
      {m.prox.length ? (
        <motion.div className="list" variants={listVariants} initial="hidden" animate="shown">
          <AnimatePresence initial={false}>{m.prox.map((e) => <EvItem key={`${e.ref}-${e.data}-${e.desc}`} e={e} />)}</AnimatePresence>
        </motion.div>
      ) : (
        <div className="card empty">Nada programado. Cadastre seus fixos em <b>Fixos</b>.</div>
      )}
      <Button kind="ghost" style={{ marginTop: 14 }} onClick={() => openSheet(<AjustarSaldo />)}>Conferir com o saldo do banco</Button>
    </>
  );
}
