import { AnimatePresence, m } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PRESETS } from '../lib/categories';
import { dateOf, MESL, monthKey, today } from '../lib/dates';
import { projecao } from '../lib/engine';
import { brl, uid } from '../lib/money';
import { getData, mutate, openSheet, useData } from '../store';
import { EditCartao } from '../sheets/EditCartao';
import { EditRec } from '../sheets/EditRec';
import { Button, Chip, DayGrid, itemVariants, listVariants } from '../ui/Controls';
import { IBack, ICheck, IChevron, ITrend } from '../ui/Icons';
import { RecItem } from '../ui/Items';
import { AmountDisplay, AnimatedBRL, Keypad } from '../ui/Money';
import { importar } from './backup';
import { spring } from '../ui/motion';
import { CartaoMini } from '../ui/Ico';

const STEPS = ['welcome', 'nome', 'saldo', 'renda', 'rendaFreq', 'adiantDia', 'adiantValor', 'rendaDia', 'cartoes', 'fixos', 'fim'] as const;
type Step = (typeof STEPS)[number];

interface Ob { renda: number; freq: 1 | 2; adDia: number | null; adValor: number | null; rendaDia: number | null }

const slide = {
  enter: (dir: number) => ({ x: dir * 44, opacity: 0, scale: 0.985 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir * -44, opacity: 0, scale: 0.985 }),
};

export function Onboarding() {
  const D = useData();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [ob, setOb] = useState<Ob>(() => {
    const sal = D.recorrentes.filter((r) => r.onb === 'renda');
    return { renda: sal.reduce((a, r) => a + r.valor, 0), freq: sal.length > 1 ? 2 : 1, adDia: null, adValor: null, rendaDia: null };
  });
  const [saldo, setSaldo] = useState(Math.max(0, D.saldo.valor));
  const step: Step = STEPS[i];

  const aplica = (s: Step, o: Ob) => {
    if ((s === 'rendaFreq' || s === 'adiantDia' || s === 'adiantValor' || s === 'rendaDia') && !o.renda) return false;
    if ((s === 'adiantDia' || s === 'adiantValor') && o.freq !== 2) return false;
    return true;
  };
  const go = (d: 1 | -1, o: Ob = ob) => {
    let n = i;
    do n += d; while (n > 0 && n < STEPS.length && !aplica(STEPS[n], o));
    if (n >= STEPS.length) { mutate((x) => ({ ...x, onboarded: true })); return; }
    setDir(d);
    setI(Math.max(0, n));
  };
  const next = (o?: Ob) => go(1, o);

  const salvarRenda = (o: Ob) => {
    const mk = monthKey(today());
    mutate((d) => {
      const outros = d.recorrentes.filter((r) => r.onb !== 'renda');
      const novos = !o.renda ? [] : o.freq === 2
        ? [
          { id: uid(), onb: 'renda', tipo: 'entrada' as const, desc: 'Adiantamento', cat: 'salario', valor: o.adValor!, dia: o.adDia!, inicio: mk },
          { id: uid(), onb: 'renda', tipo: 'entrada' as const, desc: 'Salário', cat: 'salario', valor: o.renda - o.adValor!, dia: o.rendaDia!, inicio: mk },
        ]
        : [{ id: uid(), onb: 'renda', tipo: 'entrada' as const, desc: 'Salário', cat: 'salario', valor: o.renda, dia: o.rendaDia!, inicio: mk }];
      return { ...d, recorrentes: [...outros, ...novos] };
    });
  };

  const pct = (i / (STEPS.length - 1)) * 100;
  let body: ReactNode = null;
  let foot: ReactNode = null;
  const nome = D.perfil.nome;

  switch (step) {
    case 'welcome':
      body = (
        <div className="welcome">
          <m.div className="logo" initial={{ scale: 0.6, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ ...spring, delay: 0.1 }}><ITrend /></m.div>
          <div className="q" style={{ marginTop: 0 }}>Seu dinheiro,<br />daqui pra frente.</div>
          <div className="h">Em menos de 2 minutos eu monto o seu mapa: quanto entra, quanto sai e quanto sobra em cada dia dos próximos meses.</div>
        </div>
      );
      foot = <><Button onClick={() => next()}>Começar</Button><Button kind="link" onClick={importar}>Já tenho backup</Button></>;
      break;
    case 'nome':
      body = <NomeStep onEnter={() => nome.trim() && next()} />;
      foot = <Button disabled={!nome.trim()} onClick={() => next()}>Continuar</Button>;
      break;
    case 'saldo':
      body = <>
        <div className="q">{nome ? `${nome}, q` : 'Q'}uanto tem na sua conta hoje?</div>
        <div className="h">O saldo de agora, somando as contas que você usa no dia a dia. Pode ser aproximado.</div>
        <AmountDisplay value={saldo} /><Keypad value={saldo} onChange={setSaldo} />
      </>;
      foot = <Button onClick={() => { mutate((d) => ({ ...d, saldo: { valor: saldo, data: today(), ts: Date.now() } })); next(); }}>Continuar</Button>;
      break;
    case 'renda':
      body = <>
        <div className="q">Qual sua renda mensal líquida?</div>
        <div className="h">O total que cai na conta no mês, já com descontos. Outras rendas você adiciona depois em <b>Fixos</b>.</div>
        <AmountDisplay value={ob.renda} /><Keypad value={ob.renda} onChange={(renda) => setOb((o) => ({ ...o, renda, adValor: null }))} />
      </>;
      foot = <>
        <Button onClick={() => { if (!ob.renda) salvarRenda(ob); next(); }}>Continuar</Button>
        <Button kind="link" onClick={() => { const o = { ...ob, renda: 0 }; setOb(o); salvarRenda(o); next(o); }}>Não tenho renda fixa</Button>
      </>;
      break;
    case 'rendaFreq':
      body = <>
        <div className="q">Como ela cai na conta?</div>
        <div className="h">Muita empresa paga em duas partes: adiantamento (vale) e o restante.</div>
        <m.div className="list" variants={listVariants} initial="hidden" animate="shown">
          {([[1, 'Uma vez por mês', 'Tudo num dia só'], [2, 'Duas vezes por mês', 'Adiantamento + salário, ou quinzena']] as const).map(([f, t, s]) => (
            <m.button key={f} variants={itemVariants} className="item" onClick={() => { const o = { ...ob, freq: f }; setOb(o); next(o); }}>
              <div className="ico">{f}×</div><div className="m"><div className="t">{t}</div><div className="s">{s}</div></div><span className="dim"><IChevron /></span>
            </m.button>
          ))}
        </m.div>
      </>;
      break;
    case 'adiantDia':
      body = <><div className="q">Que dia cai o adiantamento?</div><div className="h">A primeira parte do mês — o "vale" ou a 1ª quinzena.</div><DayGrid value={ob.adDia} onChange={(adDia) => setOb((o) => ({ ...o, adDia }))} caption={(d) => `adiantamento todo dia ${d}`} /></>;
      foot = <Button disabled={!ob.adDia} onClick={() => next()}>{ob.adDia ? 'Continuar' : 'Escolha o dia'}</Button>;
      break;
    case 'adiantValor': {
      const v = ob.adValor ?? Math.round(ob.renda * 0.4);
      const setV = (adValor: number) => setOb((o) => ({ ...o, adValor }));
      body = <>
        <div className="q">Quanto vem no adiantamento?</div>
        <div className="h">Do total de {brl(ob.renda)}. O resto cai no outro dia.</div>
        <div className="chips">{[30, 40, 50].map((p) => { const x = Math.round((ob.renda * p) / 100); return <Chip key={p} on={x === v} onClick={() => setV(x)}>{p}% · {brl(x)}</Chip>; })}</div>
        <AmountDisplay value={v} /><Keypad value={v} onChange={setV} />
      </>;
      foot = <Button disabled={!v || v >= ob.renda} onClick={() => { const o = { ...ob, adValor: v }; setOb(o); next(o); }}>Continuar</Button>;
      break;
    }
    case 'rendaDia': {
      const resto = ob.renda - (ob.freq === 2 ? ob.adValor ?? 0 : 0);
      body = <>
        <div className="q">{ob.freq === 2 ? 'E o restante, que dia cai?' : 'Em que dia ela cai?'}</div>
        <div className="h">{ob.freq === 2 ? `${brl(resto)} — s` : 'S'}e cair em dia não útil, escolha o dia mais comum.</div>
        <DayGrid value={ob.rendaDia} onChange={(rendaDia) => setOb((o) => ({ ...o, rendaDia }))} caption={(d) => `${ob.freq === 2 ? 'restante' : 'salário'} todo dia ${d}`} />
      </>;
      foot = <Button disabled={!ob.rendaDia} onClick={() => { salvarRenda(ob); next(); }}>{ob.rendaDia ? 'Continuar' : 'Escolha o dia'}</Button>;
      break;
    }
    case 'fixos': {
      const fix = D.recorrentes.filter((r) => r.tipo === 'saida');
      const tot = fix.reduce((a, r) => a + r.valor, 0);
      body = <>
        <div className="q">Quais são seus gastos fixos?</div>
        <div className="h">Toque nos que você tem e diga como paga (Pix, boleto ou cartão). Cada um vira automático todo mês. Pra apagar ou editar, deslize o item pro lado.</div>
        <div className="chips">
          {PRESETS.map(([n, cat, ico]) => {
            const ex = fix.find((r) => r.desc === n);
            return <Chip key={n} added={!!ex} onClick={() => openSheet(<EditRec rec={ex ?? { tipo: 'saida', desc: n, cat, ico, valor: 0, dia: null }} />)}>{ico} {n}</Chip>;
          })}
          <Chip onClick={() => openSheet(<EditRec tipo="saida" />)}>＋ Outro</Chip>
        </div>
        {fix.length > 0 && <>
          <m.div className="list" style={{ marginTop: 18 }} variants={listVariants} initial="hidden" animate="shown"><AnimatePresence presenceAffectsLayout={false} initial={false}>{fix.map((r) => <RecItem key={r.id} r={r} />)}</AnimatePresence></m.div>
          <div className="row" style={{ padding: '12px 4px' }}><span className="mut">Total fixo</span><span className="sp" /><b className="num"><AnimatedBRL value={-tot} /></b></div>
        </>}
      </>;
      foot = <Button onClick={() => next()}>{fix.length ? 'Continuar' : 'Pular por enquanto'}</Button>;
      break;
    }
    case 'cartoes':
      body = <>
        <div className="q">Usa cartão de crédito?</div>
        <div className="h">Assim o app joga cada compra pro dia certo: o vencimento da fatura.</div>
        {D.cartoes.length > 0 && (
          <m.div className="list" style={{ marginBottom: 14 }} variants={listVariants} initial="hidden" animate="shown">
            {D.cartoes.map((c) => (
              <m.button key={c.id} variants={itemVariants} className="item" onClick={() => openSheet(<EditCartao cartao={c} />)}>
                <div className="ico"><CartaoMini c={c} /></div><div className="m"><div className="t">{c.nome}</div><div className="s">Fecha dia {c.fechamento} · vence dia {c.vencimento}</div></div>
              </m.button>
            ))}
          </m.div>
        )}
        <Button kind="ghost" onClick={() => openSheet(<EditCartao />)}>＋ Adicionar cartão</Button>
      </>;
      foot = <Button onClick={() => next()}>{D.cartoes.length ? 'Continuar' : 'Não uso cartão'}</Button>;
      break;
    case 'fim': {
      const n = new Date();
      const fimMes = projecao(getData(), 60).saldoEm(dateOf(n.getFullYear(), n.getMonth(), 31)) ?? 0;
      body = (
        <div className="welcome">
          <m.div className="logo ok" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}><ICheck /></m.div>
          <div className="q" style={{ marginTop: 0 }}>Pronto{nome ? `, ${nome}` : ''}!</div>
          <div className="h">Pela sua base, você deve fechar {MESL[n.getMonth()]} com</div>
          <div className={`hero-num num ${fimMes < 0 ? 'neg' : ''}`}><CountUp to={fimMes} /></div>
          <div className="h" style={{ marginTop: 14 }}>Daqui pra frente é só tocar no <b className="acc">＋</b> quando gastar algo. Três toques e pronto.</div>
        </div>
      );
      foot = <Button onClick={() => next()}>Ver meu fluxo</Button>;
      break;
    }
  }

  return (
    <div className="ob">
      <div className="head" style={{ visibility: i === 0 ? 'hidden' : 'visible' }}>
        <m.button whileTap={{ scale: 0.9 }} className="back" onClick={() => go(-1)} aria-label="Voltar"><IBack /></m.button>
        <div className="sp"><div className="bar"><m.i animate={{ width: `${pct}%` }} transition={spring} /></div></div>
      </div>
      <AnimatePresence presenceAffectsLayout={false} mode="wait" custom={dir} initial={false}>
        <m.div key={step} className="body" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ ...spring, opacity: { duration: 0.18 } }}>
          {body}
        </m.div>
      </AnimatePresence>
      <div className="foot">{foot}</div>
    </div>
  );
}

function NomeStep({ onEnter }: { onEnter: () => void }) {
  const nome = useData().perfil.nome;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => ref.current?.focus(), 350); return () => clearTimeout(t); }, []);
  return <>
    <div className="q">Como posso te chamar?</div>
    <div className="h">Só pra deixar o app com a sua cara.</div>
    <input ref={ref} className="big-input" placeholder="Seu nome" value={nome} autoComplete="given-name" enterKeyHint="next"
      onChange={(e) => mutate((d) => ({ ...d, perfil: { nome: e.target.value } }))}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); ref.current?.blur(); onEnter(); } }} />
  </>;
}

/** Conta de 0 até o valor, uma vez. */
function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(to), 250); return () => clearTimeout(t); }, [to]);
  return <AnimatedBRL value={v} />;
}
