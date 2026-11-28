import { AnimatePresence, m } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { dateOf, diaLabel, dm, MESL, parse, saudacao, today } from '../lib/dates';
import { fluxoMeses, pendentesHoje, projecao } from '../lib/engine';
import { brl } from '../lib/money';
import { openSheet, useData, useUI } from '../store';
import { Simulador } from '../sheets/Simulador';
import { ParaOndeFoi } from '../ui/ParaOndeFoi';
import { AjustarSaldo } from '../sheets/Misc';
import { ExtraSheet } from '../sheets/Extras';
import { rendaAtual } from '../sheets/Renda';
import { ano13 } from '../lib/extras';
import { mutate } from '../store';
import { InsightsStrip } from '../ui/Insights';
import { Lista } from '../ui/Lista';
import { CardFace, CarteiraSheet } from '../sheets/Carteira';
import { faturasAtuais } from '../lib/faturas';
import { trechoNegativo } from '../lib/insights';
import { agruparFaturas } from '../lib/faturas';
import { BalanceChart } from '../ui/Chart';
import { FolgaSheet, QuantoFalta, QuantoFaltaSheet } from '../ui/QuantoFalta';
import { Button } from '../ui/Controls';
import { EvItem } from '../ui/Items';
import { AnimatedBRL } from '../ui/Money';
import { springSnappy } from '../ui/motion';
import { CatTile } from '../ui/CatIco';
import { Ico } from '../ui/Ico';
import { nomeExib } from '../ui/nome';

export function Home() {
  const D = useData();
  const [scrubI, setScrubI] = useState<number | null>(null);
  // compra simulada no gráfico (só na tela); some se os dados mudarem, pra não mostrar conta velha
  const sim = useUI((s) => s.sim);
  const visao = useUI((s) => s.visao);
  const marcas = useUI((s) => s.marcas);
  const setVisao = useUI.getState().setVisao;
  // compra pequena perto da escala do gráfico: a linha tracejada fica em cima da outra; avisa em texto
  const simPequena = !!sim && (() => { const vs = sim.base.pts.map((p) => p.v); const faixa = Math.max(...vs, 0) - Math.min(...vs, 0); return sim.compra.valor < faixa * 0.015; })();
  const simCartao = sim?.compra.cartaoId ? D.cartoes.find((c) => c.id === sim.compra.cartaoId) : undefined;
  const dPrev = useRef(D);
  useEffect(() => { if (dPrev.current !== D) { dPrev.current = D; const ui = useUI.getState(); if (ui.sim) ui.setSim(null); if (ui.marcas) ui.setMarcas(null); } }, [D]);
  const t = today();
  const now = new Date();

  const vm = useMemo(() => {
    const p = projecao(D, 90, t);
    const fut = p.pts.filter((x) => x.d >= t);
    const pend = pendentesHoje(D, p.evs, t);
    const pendV = pend.reduce((a, e) => a + e.valor, 0);
    const hoje = (p.saldoEm(t) ?? D.saldo.valor) - pendV; // saldo AGORA: sem o que ainda vai cair hoje
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
    // quanto das saídas dos próximos 90 dias é só estimativa ("gasto típico" dos cartões), não compra lançada
    const saiFut = p.evs.filter((e) => e.data >= t && e.valor < 0);
    const est = -saiFut.filter((e) => e.estimativa).reduce((a, e) => a + e.valor, 0);
    const saiTot = -saiFut.reduce((a, e) => a + e.valor, 0);
    const estPct = saiTot ? Math.round((est / saiTot) * 100) : 0;
    return { p, fut, hoje, pendV, fimMes, min, months, prox, neg, est, estPct };
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

      <div className="visoes" role="tablist" aria-label="Visões do Início">
        <button role="tab" aria-selected={visao === 'futuro'} className={visao === 'futuro' ? 'on' : ''} onClick={() => setVisao('futuro')}><Ico n="futuro" size={16} />Visão futura</button>
        <button role="tab" aria-selected={visao === 'mes'} className={visao === 'mes' ? 'on' : ''} onClick={() => setVisao('mes')}><Ico n="rosca" size={16} />Para onde foi</button>
      </div>

      {visao === 'mes' ? <ParaOndeFoi /> : (
      <>
      <m.div className={`hero${marcas ? ' em-modo' : ''}`} initial={{ opacity: 0, y: 12, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 26 }}>
        {/* v2.50: "Ver no gráfico" é um MODO do gráfico — faixa com o que está sendo mostrado, Detalhes e Sair */}
        <AnimatePresence initial={false}>
          {marcas && (
            <m.div key="modo" className={`g-modo ${marcas.modo}`} role="status" initial={{ opacity: 0, height: 0, marginBottom: 0 }} animate={{ opacity: 1, height: 'auto', marginBottom: 12 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
              <span className="g-modo-ic"><Ico n={marcas.modo === 'folga' ? 'info' : 'alerta'} size={15} /></span>
              {/* o título é o botão de detalhes (seta), pra caber inteiro até em 375 px */}
              <button className="g-modo-t" aria-label={`Ver detalhes: ${marcas.titulo}`} onClick={() => openSheet(marcas.modo === 'folga' ? <FolgaSheet fut={vm.fut} /> : <QuantoFaltaSheet fut={vm.fut} voltaPor={vm.neg?.voltaPor} />)}>
                <span>{marcas.titulo}</span><Ico n="avancar" size={15} />
              </button>
              <button className="g-modo-x" onClick={() => useUI.getState().setMarcas(null)} aria-label="Sair do modo e voltar ao gráfico normal"><Ico n="fechar" size={16} />Sair</button>
            </m.div>
          )}
        </AnimatePresence>
        <div className="lbl">{sp ? diaLabel(sp.d) : 'Saldo hoje'}</div>
        <div className={`big num ${shown < 0 ? 'neg' : ''}`}>{sp ? brl(sp.v) : <AnimatedBRL value={vm.hoje} />}</div>
        <div className="sub">
          <AnimatePresence presenceAffectsLayout={false} mode="wait" initial={false}>
            <m.span key={sp ? sp.d : 'hint'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}>
              {sp ? (spEvs.length ? spEvs.map((e) => `${nomeExib(e.desc)} ${brl(e.valor, true)}`).join(' · ') : 'Sem movimentação neste dia') : vm.pendV ? `${brl(vm.pendV, true)} ainda hoje · arraste no gráfico pra ver qualquer dia` : 'Toque e arraste no gráfico pra ver qualquer dia'}
            </m.span>
          </AnimatePresence>
        </div>
        {sim && (
          <div className="sim-leg">
            <span><i className="l-hoje" />Hoje</span>
            <span className="g"><i className="l-sim" />Com a compra ({sim.opcoes[0].parcelas === 1 ? 'à vista' : `${sim.opcoes[0].parcelas}x`})</span>
          </div>
        )}
        <BalanceChart pts={vm.fut} onScrub={setScrubI} ghost={sim?.opcoes[0].pts} marcas={marcas?.pontos} faixas={marcas?.faixas} />
      </m.div>

      {sim ? (
        <div className="sim-ativo">
          <span className="sim-ativo-t"><b>Simulando {brl(sim.compra.valor)} {sim.opcoes[0].parcelas === 1 ? 'à vista' : `em ${sim.opcoes[0].parcelas}x`}</b>{simCartao ? ` no ${simCartao.nome}` : ' no Pix'} · saldo mais baixo {brl(sim.opcoes[0].minimo.v)} em {dm(sim.opcoes[0].minimo.d)}{simPequena ? '. A diferença é pequena demais pra aparecer no gráfico.' : ''}</span>
          <div className="sim-ativo-b">
            <Button kind="ghost" onClick={() => openSheet(<Simulador />)}>Mudar</Button>
            <Button kind="ghost" aria-label="Limpar simulação" onClick={() => useUI.getState().setSim(null)}><Ico n="fechar" size={18} />Limpar</Button>
          </div>
        </div>
      ) : (
        <button className="sim-btn" onClick={() => openSheet(<Simulador />)}>
          <span className="sim-btn-ico"><Ico n="simular" size={20} /></span>
          <span className="sim-btn-t"><b>E se eu comprar…?</b><span>Veja o impacto antes, à vista ou parcelado</span></span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      )}

      <Lista className="stats">
        <m.div className="stat"><div className="k">Fim de {MESL[now.getMonth()]}</div><div className={`v num ${vm.fimMes < 0 ? 'neg' : ''}`}><AnimatedBRL value={vm.fimMes} /></div></m.div>
        <m.div className="stat"><div className="k">Daqui a 90 dias</div><div className={`v num ${ultimo < 0 ? 'neg' : ''}`}><AnimatedBRL value={ultimo} /></div></m.div>
      </Lista>

      {vm.estPct >= 25 && (
        <div className="est-nota">
          <Ico n="info" size={15} />
          <span><b>{brl(vm.est)}</b> ({vm.estPct}%) das saídas dos próximos 90 dias são <b>estimativa</b> do gasto típico dos cartões, não compras lançadas. Conforme você lança ou importa a fatura, a estimativa vai sendo trocada pelo real.</span>
        </div>
      )}

      {/* v2.47: no lugar do aviso vermelho — quanto falta e até quando (vermelho) ou folga apertada (âmbar) */}
      <QuantoFalta fut={vm.fut} voltaPor={vm.neg?.voltaPor} />
      </>
      )}

      <AnimatePresence presenceAffectsLayout={false} initial={false}>
        {mostra13 && (
          <m.div className="nudge" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
            <CatTile cat="salario" ico="🎄" />
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
                  <CardFace c={c} mini />
                  <b className="wmini-v num">{brl(f.total)}</b>
                  <span className="wmini-s">{f.status === 'fechada' ? `vence ${dm(f.vencimento)}` : `aberta · fecha ${dm(f.fecha)}`}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <h2>Próximos meses</h2>
      <Lista className="months">
        {vm.months.map((r) => {
          const tot = Math.max(r.ent + r.sai, 1);
          const res = r.ent - r.sai;
          return (
            <m.div key={r.de} whileTap={{ scale: 0.98 }} transition={springSnappy} className="month">
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
      </Lista>

      <h2>Vem aí</h2>
      {vm.prox.length ? (
        <Lista className="list">
          <AnimatePresence presenceAffectsLayout={false} initial={false}>{vm.prox.map((e) => <EvItem key={`${e.ref}-${e.data}-${e.desc}`} e={e} />)}</AnimatePresence>
        </Lista>
      ) : (
        <div className="card empty">Nada programado. Cadastre seus fixos em <b>Fixos</b>.</div>
      )}
      <Button kind="ghost" style={{ marginTop: 14 }} onClick={() => openSheet(<AjustarSaldo />)}>Conferir com o saldo do banco</Button>
    </>
  );
}
