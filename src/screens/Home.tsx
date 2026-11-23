import { AnimatePresence, m } from 'motion/react';
import { useMemo, useState } from 'react';
import { dateOf, diaLabel, dm, MESL, parse, saudacao, today } from '../lib/dates';
import { fluxoMeses, projecao } from '../lib/engine';
import { brl } from '../lib/money';
import { openSheet, useData } from '../store';
import { AjustarSaldo } from '../sheets/Misc';
import { ExtraSheet } from '../sheets/Extras';
import { rendaAtual } from '../sheets/Renda';
import { ano13 } from '../lib/extras';
import { mutate } from '../store';
import { InsightsStrip } from '../ui/Insights';
import { CardFace, CarteiraSheet } from '../sheets/Carteira';
import { faturasAtuais } from '../lib/faturas';
import { trechoNegativo } from '../lib/insights';
import { agruparFaturas } from '../lib/faturas';
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

  const vm = useMemo(() => {
    const p = projecao(D, 90, t);
    const fut = p.pts.filter((x) => x.d >= t);
    const hoje = p.saldoEm(t) ?? D.saldo.valor;
    const fimMes = p.saldoEm(dateOf(now.getFullYear(), now.getMonth(), 31)) ?? hoje;
    const prox30 = fut.slice(0, 31);
    const min = prox30.reduce((a, b) => (b.v < a.v ? b : a), prox30[0]);
    const months = fluxoMeses(D, t, 6).map((r) => {
      const d = parse(r.de);
      return { ...r, nome: MESL[d.getMonth()] + (d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : '') };
    });
    const tn = trechoNegativo(fut);
    const voltaPor = tn?.volta ? p.evs.filter((e) => e.data === tn.volta!.d && e.valor > 0).sort((a, b) => b.valor - a.valor)[0]?.desc : undefined;
    const neg = tn ? { ...tn, voltaPor } : null;
    const prox = agruparFaturas(p.evs.filter((e) => e.data >= t), D.cartoes).slice(0, 8);
    return { p, fut, hoje, fimMes, min, months, prox, neg };
  }, [D, t]);

  // nov/dez: lembrar do 13º se ainda não está na previsão
  const a13 = ano13(t);
  const chave13 = `13-${a13}`;
  const mostra13 = (now.getMonth() >= 10 || a13 > now.getFullYear()) && t <= `${a13}-12-20` && rendaAtual().length > 0
    && !D.lancamentos.some((l) => l.desc.startsWith('13º') && l.data.startsWith(String(a13))) && !(D.dispensados ?? []).includes(chave13);
  const sp = scrubI != null ? vm.fut[scrubI] : null;
  const spEvs = sp ? agruparFaturas(vm.p.evs.filter((e) => e.data === sp.d), D.cartoes) : [];
  const shown = sp ? sp.v : vm.hoje;
  const ultimo = vm.fut[vm.fut.length - 1].v;

  return (
    <>
      <div className="top"><div><div className="hello">{saudacao()},</div><h1>{D.perfil.nome || 'você'}</h1></div></div>

      <m.div className="hero" initial={{ opacity: 0, y: 12, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 26 }}>
        <div className="lbl">{sp ? diaLabel(sp.d) : 'Saldo hoje'}</div>
        <div className={`big num ${shown < 0 ? 'neg' : ''}`}>{sp ? brl(sp.v) : <AnimatedBRL value={vm.hoje} />}</div>
        <div className="sub">
          <AnimatePresence mode="wait" initial={false}>
            <m.span key={sp ? sp.d : 'hint'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}>
              {sp ? (spEvs.length ? spEvs.map((e) => `${e.desc} ${brl(e.valor, true)}`).join(' · ') : 'Sem movimentação neste dia') : 'Toque e arraste no gráfico pra ver qualquer dia'}
            </m.span>
          </AnimatePresence>
        </div>
        <BalanceChart pts={vm.fut} onScrub={setScrubI} />
      </m.div>

      <m.div className="stats" variants={listVariants} initial="hidden" animate="shown">
        <m.div variants={itemVariants} className="stat"><div className="k">Fim de {MESL[now.getMonth()]}</div><div className={`v num ${vm.fimMes < 0 ? 'neg' : ''}`}><AnimatedBRL value={vm.fimMes} /></div></m.div>
        <m.div variants={itemVariants} className="stat"><div className="k">Daqui a 90 dias</div><div className={`v num ${ultimo < 0 ? 'neg' : ''}`}><AnimatedBRL value={ultimo} /></div></m.div>
      </m.div>

      {vm.neg && (
        <div className="alert"><span>⚠️</span><div>
          Seu saldo fica <b>negativo a partir de {diaLabel(vm.neg.inicio.d).toLowerCase()}</b> ({brl(vm.neg.inicio.v)})
          {vm.neg.pior.d !== vm.neg.inicio.d && <> e chega a <b>{brl(vm.neg.pior.v)}</b> em {dm(vm.neg.pior.d)}</>}
          {vm.neg.volta ? <>. Volta ao positivo em {dm(vm.neg.volta.d)}{vm.neg.voltaPor ? ` (${vm.neg.voltaPor})` : ''}.</> : <> e não volta ao positivo nos próximos 90 dias.</>}
          {' '}Vale segurar gastos até lá.
        </div></div>
      )}

      <AnimatePresence initial={false}>
        {mostra13 && (
          <m.div className="nudge" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
            <div className="nudge-ico">🎄</div>
            <div className="m">
              <div className="t">O 13º está chegando</div>
              <div className="s">1ª parcela até 30/nov, 2ª até 20/dez. Quer colocar na previsão?</div>
              <div className="nudge-btns">
                <button className="nb on" onClick={() => openSheet(<ExtraSheet k="13" />)}>Adicionar</button>
                <button className="nb" onClick={() => mutate((d) => ({ ...d, dispensados: [...(d.dispensados ?? []), chave13] }))}>Agora não</button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <InsightsStrip />

      {D.cartoes.length > 0 && (
        <>
          <h2>Cartões</h2>
          <div className="wmini">
            {D.cartoes.map((c) => {
              const f = faturasAtuais(D, c, t)[0];
              return (
                <button key={c.id} className="wmini-b" onClick={() => openSheet(<CarteiraSheet cartaoId={c.id} />)}>
                  <CardFace c={c} mini valor={f.total} />
                  <span className="wmini-s">{f.status === 'fechada' ? `vence ${dm(f.vencimento)}` : `aberta · fecha ${dm(f.fecha)}`}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <h2>Próximos meses</h2>
      <m.div className="months" variants={listVariants} initial="hidden" animate="shown">
        {vm.months.map((r) => {
          const tot = Math.max(r.ent + r.sai, 1);
          const res = r.ent - r.sai;
          return (
            <m.div key={r.de} variants={itemVariants} whileTap={{ scale: 0.98 }} transition={springSnappy} className="month">
              <div className="mt">
                <span className="t">{r.nome}</span>
                <span className={`res ${res < 0 ? 'neg' : 'pos'}`}>{res < 0 ? '▼' : '▲'} {brl(res, true)}</span>
              </div>
              <div className="bar">
                <m.i initial={{ width: 0 }} animate={{ width: `${(r.ent / tot) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.2 }} style={{ background: 'var(--in)' }} />
                <m.i initial={{ width: 0 }} animate={{ width: `${(r.sai / tot) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.3 }} style={{ background: 'var(--bdx-grad)' }} />
              </div>
              <div className="l"><span className="mut">{r.atual ? 'Saldo hoje' : 'Começa com'}</span><span className="num">{brl(r.inicio)}</span></div>
              <div className="l"><span className="mut"><i className="op">＋</i>{r.atual ? 'Ainda entra' : 'Entra'}</span><span className="num pos">{brl(r.ent)}</span></div>
              <div className="l"><span className="mut"><i className="op">−</i>{r.atual ? 'Ainda sai' : 'Sai'}</span><span className="num">{brl(r.sai)}</span></div>
              <div className="l end"><span><i className="op">=</i>Termina com</span><span className={`num fim ${r.fim < 0 ? 'neg' : ''}`}>{brl(r.fim)}</span></div>
            </m.div>
          );
        })}
      </m.div>

      <h2>Vem aí</h2>
      {vm.prox.length ? (
        <m.div className="list" variants={listVariants} initial="hidden" animate="shown">
          <AnimatePresence initial={false}>{vm.prox.map((e) => <EvItem key={`${e.ref}-${e.data}-${e.desc}`} e={e} />)}</AnimatePresence>
        </m.div>
      ) : (
        <div className="card empty">Nada programado. Cadastre seus fixos em <b>Fixos</b>.</div>
      )}
      <Button kind="ghost" style={{ marginTop: 14 }} onClick={() => openSheet(<AjustarSaldo />)}>Conferir com o saldo do banco</Button>
    </>
  );
}
