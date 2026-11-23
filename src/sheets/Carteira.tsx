import { animate, AnimatePresence, m, useMotionValue, type PanInfo } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { catE, catN } from '../lib/categories';
import { dm, mesCurto, monthKey, today } from '../lib/dates';
import { projecao } from '../lib/engine';
import { agruparFaturas, faturasAtuais } from '../lib/faturas';
import { abrirImagem, corDoCartao, recortar, salvarImagem, useImagem, type Caixa, type FonteRecorte } from '../lib/imagens';
import { Recorte } from '../ui/Recorte';
import { parcelasAbertas } from '../lib/insights';
import type { Cartao } from '../lib/types';
import { brl } from '../lib/money';
import { openSheet, toast, useData } from '../store';
import { Button } from '../ui/Controls';
import { SheetHeader } from '../ui/Sheet';
import { Expande } from '../ui/Expande';
import { spring, springSnappy } from '../ui/motion';
import { EditCartao } from './EditCartao';
import { FaturasSheet } from './Faturas';
import { ImportarSheet } from './Importar';

const fmt = (iso: string) => `${dm(iso)}/${iso.slice(2, 4)}`;

/** A "face" do cartão: arte enviada pelo usuário ou gradiente da marca. */
export function CardFace({ c, mini, valor, src }: { c: Cartao; mini?: boolean; valor?: number; src?: string }) {
  const salva = useImagem(c.id);
  const img = src ?? salva;
  const [a, b] = corDoCartao(c.nome);
  return (
    <div className={`cface ${mini ? 'mini' : ''} ${img ? 'has-img' : ''}`} style={img ? { backgroundImage: `url(${img})` } : { background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)` }}>
      {/* com a arte do banco, nada por cima: a imagem já tem logo e bandeira */}
      {!img && <><span className="cf-chip" /><span className="cf-name">{c.nome}</span>
        <span className="cf-foot">{valor != null ? <b className="num">{brl(valor)}</b> : <>fecha {c.fechamento} · vence {c.vencimento}</>}</span></>}
    </div>
  );
}

export function CarteiraSheet({ cartaoId }: { cartaoId?: string }) {
  const D = useData();
  const ini = Math.max(0, D.cartoes.findIndex((c) => c.id === cartaoId));
  const [i, setI] = useState(ini);
  const c = D.cartoes[Math.min(i, D.cartoes.length - 1)];
  // carrossel próprio: ao soltar, o cartão SEMPRE assenta no centro (a rolagem nativa às vezes parava no meio)
  const [cw, setCw] = useState(0);
  const x = useMotionValue(0);
  const arrastou = useRef(false);
  const inicioX = useRef(0);
  const panAtivo = useRef(false);
  // largura da faixa: o navegador avisa (ResizeObserver) — ler clientWidth a cada redesenho forçava o layout da janela inteira
  const walletRef = useRef<HTMLDivElement>(null);
  const iRef = useRef(i);
  iRef.current = i;
  useEffect(() => {
    const el = walletRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      setCw((antes) => {
        if (!antes) x.jump((w - w * 0.8) / 2 - iRef.current * (w * 0.8 + GAP)); // posição inicial sem animar
        return w;
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const panBase = useRef(0);
  const slot = cw * 0.8, GAP = 12;
  const pos = (n: number) => (cw - slot) / 2 - n * (slot + GAP);
  useEffect(() => { if (cw) animate(x, pos(i), springSnappy); }, [i, cw]); // eslint-disable-line react-hooks/exhaustive-deps
  const irPara = (n: number) => setI(Math.max(0, Math.min(D.cartoes.length - 1, n)));
  const soltar = (_: unknown, info: PanInfo) => {
    const passo = slot + GAP;
    // quantos cartões andar: pela distância + impulso do gesto (um toque rápido também troca)
    const projetado = -(info.offset.x + info.velocity.x * 0.18) / passo;
    let n = i + Math.round(projetado);
    if (n === i && Math.abs(info.velocity.x) > 350) n = i + (info.velocity.x < 0 ? 1 : -1);
    n = Math.max(0, Math.min(D.cartoes.length - 1, n));
    if (n === i) animate(x, pos(i), springSnappy); else setI(n);
  };

  if (!c) {
    return (
      <div className="sl">
        <SheetHeader title="Carteira" />
        <div className="sl-mid" data-scroll><div className="empty">Nenhum cartão ainda.</div></div>
        <div className="sl-foot"><Button onClick={() => openSheet(<EditCartao />)}>＋ Adicionar cartão</Button></div>
      </div>
    );
  }

  return (
    <div className="sl">
      <SheetHeader title="Carteira" />
      <div className="sl-mid" data-scroll>
        <div className="wallet" ref={walletRef}>
          <m.div
            className="wtrack"
            style={{ x, gap: GAP }}
            onPanStart={(_, info) => { panAtivo.current = D.cartoes.length > 1 && Math.abs(info.offset.x) > Math.abs(info.offset.y); panBase.current = x.get(); if (panAtivo.current) arrastou.current = true; }}
            onPan={(_, info) => {
              if (!panAtivo.current) return;
              let v = panBase.current + info.offset.x;
              const min = pos(D.cartoes.length - 1), max = pos(0);
              if (v > max) v = max + (v - max) * 0.18; else if (v < min) v = min + (v - min) * 0.18; // borda elástica
              x.set(v);
            }}
            // bolha (não captura): o arrasto do próprio carrossel precisa receber o toque; só a janela não
            onPointerDown={(e) => { e.stopPropagation(); arrastou.current = false; inicioX.current = e.clientX; }}
            onPointerMove={(e) => { if (Math.abs(e.clientX - inicioX.current) > 6) arrastou.current = true; }}
            onPanEnd={(e, info) => { if (panAtivo.current) { panAtivo.current = false; soltar(e, info); } }}
          >
            {D.cartoes.map((cc, k) => (
              <button key={cc.id} className={`wslot ${k === i ? 'on' : ''}`} style={{ width: slot || '80%' }} aria-label={cc.nome}
                onClick={() => { if (arrastou.current) return; if (k === i) openSheet(<EditCartao cartao={cc} />); else irPara(k); }}>
                <CardFace c={cc} />
              </button>
            ))}
          </m.div>
        </div>
        {D.cartoes.length > 1 && <div className="wdots">{D.cartoes.map((cc, k) => <button key={cc.id} className={k === i ? 'on' : ''} onClick={() => irPara(k)} aria-label={cc.nome} />)}</div>}
        <AnimatePresence mode="popLayout" initial={false}>
          <m.div key={c.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring}>
            <Detalhes c={c} />
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Detalhes({ c }: { c: Cartao }) {
  const D = useData();
  const t = today();
  const [imgAberta, setImgAberta] = useState(false);
  const [catSel, setCatSel] = useState<string | null>(null);
  const [fonte, setFonte] = useState<(FonteRecorte & { canvas: HTMLCanvasElement }) | null>(null);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const abrir = async (f: File | HTMLCanvasElement, girar = false) => { const x = await abrirImagem(f, girar); setFonte(x); setCaixa(x.caixa); };
  const img = useImagem(c.id);
  const v = useMemo(() => {
    const fats = faturasAtuais(D, c, t);
    const fechada = fats.find((f) => f.status === 'fechada');
    const aberta = fats.find((f) => f.status === 'aberta')!;
    const futuras = agruparFaturas(projecao(D, 220, t).evs.filter((e) => e.cartaoId === c.id && (e.venc ?? e.data) > aberta.vencimento), D.cartoes).slice(0, 4);
    const parcelas = parcelasAbertas(D, t).filter((p) => p.lanc.cartaoId === c.id);
    const cats = new Map<string, number>();
    for (const e of aberta.itens) if (e.valor < 0 && e.cat !== 'fatura') cats.set(e.cat, (cats.get(e.cat) ?? 0) - e.valor);
    const totCat = [...cats.values()].reduce((a, b) => a + b, 0);
    return { fechada, aberta, futuras, parcelas, cats: [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5), totCat };
  }, [D, c, t]);

  const { fechada, aberta } = v;
  const meta = c.estimativa ?? 0;
  const pct = meta ? Math.min(1.15, aberta.total / meta) : 0;
  const status = fechada
    ? (fechada.antecipada && fechada.pagaEm <= t ? { t: `Fatura paga em ${dm(fechada.pagaEm)}`, k: 'ok' } : { t: `Fatura fechada · vence ${dm(fechada.vencimento)}`, k: 'warn' })
    : { t: `Fatura aberta · fecha ${dm(aberta.fecha)}`, k: 'open' };

  // volta pro visual gerado (cores do banco + nome); dá pra desfazer pelo aviso
  const voltarPadrao = () => {
    const antes = img;
    salvarImagem(c.id, null);
    setImgAberta(false);
    toast('Cartão voltou ao visual padrão', antes ? () => salvarImagem(c.id, antes) : undefined);
  };
  const escolherImg = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      try { await abrir(f); } catch { toast('Não consegui abrir essa imagem'); }
    };
    inp.click();
  };

  return (
    <div className="wdet">
      <div className={`wstatus ${status.k}`}><i />{status.t}</div>

      {fechada && (
        <button className="wbill" onClick={() => openSheet(<FaturasSheet cartaoId={c.id} />)}>
          <div><span className="mut small">Fechada · {fechada.antecipada ? `paga ${dm(fechada.pagaEm)}` : `vence ${fmt(fechada.vencimento)}`}</span><b className="num">{brl(fechada.total)}</b></div>
          <span className="chev">›</span>
        </button>
      )}
      <button className="wbill" onClick={() => openSheet(<FaturasSheet cartaoId={c.id} />)}>
        <div style={{ flex: 1 }}>
          <span className="mut small">Aberta · fecha {dm(aberta.fecha)} · vence {fmt(aberta.vencimento)}</span>
          <b className="num">{brl(aberta.total)}</b>
          {meta > 0 && (
            <>
              <div className="wprog"><m.i className={pct > 1 ? 'over' : ''} initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct * 100)}%` }} transition={spring} /></div>
              <span className="dim small">{pct > 1 ? `${brl(aberta.total - meta)} acima do típico` : `${Math.round(pct * 100)}% do típico (${brl(meta)})`}</span>
            </>
          )}
        </div>
        <span className="chev">›</span>
      </button>

      {v.futuras.length > 0 && (
        <>
          <div className="lab">Próximas faturas</div>
          <div className="imp-meses">
            {v.futuras.map((f) => (
              <div key={f.ref}><span className="mut">{mesCurto(monthKey(f.venc ?? f.data))}{f.estimativa ? ' · est.' : ''}</span><b className="num">{brl(-f.valor)}</b></div>
            ))}
          </div>
        </>
      )}

      {v.cats.length > 0 && (
        <>
          <div className="lab">Nesta fatura <span className="dim">· toque pra ver as compras</span></div>
          {v.cats.map(([cat, val]) => {
            const aberto = catSel === cat;
            const itens = aberto ? aberta.itens.filter((e) => e.cat === cat && e.valor < 0).sort((a, b) => a.valor - b.valor) : [];
            return (
              <div key={cat} className={`wcat ${aberto ? 'on' : ''} ${catSel && !aberto ? 'off' : ''}`}>
                <button className="imp-cat" onClick={() => setCatSel(aberto ? null : cat)} aria-expanded={aberto}>
                  <span>{catE(cat)} {catN(cat)}</span>
                  <div className="imp-bar"><m.i initial={{ width: 0 }} animate={{ width: `${Math.max(4, (val / v.totCat) * 100)}%` }} transition={spring} /></div>
                  <span className="num">{brl(val)}</span>
                </button>
                <AnimatePresence initial={false}>
                  {aberto && (
                    <Expande className="wcat-list">
                      {itens.map((e) => (
                        <div key={`${e.ref}${e.desc}`} className="wcat-it">
                          <span className="t">{e.ico || catE(e.cat)} {e.desc}</span>
                          <span className="num">{brl(-e.valor)}</span>
                        </div>
                      ))}
                      <div className="dim small" style={{ padding: '4px 0 2px' }}>{itens.length} {itens.length === 1 ? 'compra' : 'compras'} · {Math.round((val / v.totCat) * 100)}% da fatura</div>
                    </Expande>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </>
      )}

      {v.parcelas.length > 0 && (
        <>
          <div className="lab">Parcelas em aberto</div>
          <div className="list">
            {v.parcelas.map((p) => (
              <div key={p.lanc.id} className="wparc">
                <div className="m"><div className="t">{p.lanc.desc || catN(p.lanc.cat)}</div><div className="s">{p.pagas}/{p.total} · até {fmt(p.ultima)}</div></div>
                <div className="r"><b className="num">{brl(p.valorParcela)}</b><span className="dim small">faltam {brl(p.restante)}</span></div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="wacts">
        <Button kind="ghost" onClick={() => openSheet(<FaturasSheet cartaoId={c.id} />)}>Conferir fatura</Button>
        <Button kind="ghost" onClick={() => openSheet(<ImportarSheet cartaoId={c.id} />)}>📥 Importar</Button>
      </div>
      <div className="wacts">
        <Button kind="ghost" onClick={() => setImgAberta((x) => !x)}>🖼️ Imagem</Button>
        <Button kind="ghost" onClick={() => openSheet(<EditCartao cartao={c} />)}>✏️ Editar</Button>
      </div>
      <AnimatePresence initial={false}>
        {imgAberta && (
          <Expande className="wimg" chave={fonte ? `rec${fonte.w}x${fonte.h}` : 'opcoes'}>
            <div className="alert"><span>🔒</span><div>Use só a <b>arte</b> do cartão (a imagem do site do banco ou uma foto do verso liso). <b>Nunca</b> uma foto com número, nome, validade ou CVV. A imagem fica só neste aparelho.</div></div>
            {fonte && caixa ? (
              <>
                <div className="lab">Recortei sozinho — ajuste se precisar:</div>
                <Recorte fonte={fonte} caixa={caixa} onChange={setCaixa} />
                <div className="wacts">
                  <Button onClick={async () => { await salvarImagem(c.id, recortar(fonte.canvas, caixa)); setFonte(null); setImgAberta(false); toast('Imagem do cartão salva'); }}>Usar esta</Button>
                  <Button kind="ghost" onClick={() => abrir(fonte.canvas, true)}>⟲ Girar</Button>
                </div>
                <Button kind="link" onClick={escolherImg}>Escolher outra imagem</Button>
              </>
            ) : (
              <div className="wacts">
                <Button onClick={escolherImg}>📷 Escolher</Button>
                {img && <Button kind="ghost" onClick={voltarPadrao}>↺ Padrão</Button>}
              </div>
            )}
          </Expande>
        )}
      </AnimatePresence>
    </div>
  );
}
