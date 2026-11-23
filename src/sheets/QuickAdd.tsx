import { AnimatePresence } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CAT_IN, CAT_OUT, catE } from '../lib/categories';
import { aprender, sugerir } from '../lib/smart';
import { SmartDesc, SmartHint } from '../ui/Smart';
import { addDays, dateOf, diaLabel, dm, parse, today } from '../lib/dates';
import { pagamentoCartao } from '../lib/engine';
import { brl, uid } from '../lib/money';
import type { Lancamento, Meio } from '../lib/types';
import { closeSheet, getData, mutate, openSheet, restore, toast, withUndo } from '../store';
import { Button, Chip, Segmented, Stepper } from '../ui/Controls';
import { AmountDisplay, Keypad } from '../ui/Money';
import { SheetHeader } from '../ui/Sheet';
import { Expande } from '../ui/Expande';
import { EditRec } from './EditRec';
import { ExtraSheet } from './Extras';

export function QuickAdd({ lanc }: { lanc?: Lancamento }) {
  const novo = !lanc;
  const D = getData();
  const [l, setL] = useState<Lancamento>(() => lanc ?? { id: '', tipo: 'saida', valor: 0, cat: '', data: today(), cartaoId: null, parcelas: 1, desc: '', criado: 0 });
  const set = (p: Partial<Lancamento>) => setL((x) => ({ ...x, ...p }));
  // categoria escolhida à mão? então a sugestão não sobrescreve
  const [manual, setManual] = useState(!!lanc);
  const sug = useMemo(() => sugerir(l.desc, l.tipo, D.aprendido), [l.desc, l.tipo, D.aprendido]);

  const cats = useMemo(() => {
    const list = l.tipo === 'saida' ? CAT_OUT : CAT_IN;
    return [...list].sort((a, b) => (D.uso[b[0]] ?? 0) - (D.uso[a[0]] ?? 0));
  }, [l.tipo, D.uso]);
  const catEscolhida = l.cat && (l.cat === 'fatura' || cats.some((c) => c[0] === l.cat)) ? l.cat : '';
  const usaSug = !manual && !!sug;
  const cat = usaSug ? sug!.cat : catEscolhida || cats[0][0];
  const ico = sug && sug.cat === cat ? sug.ico || catE(cat) : manual && lanc?.ico && lanc.cat === cat ? lanc.ico : catE(cat);
  const chipsRef = useRef<HTMLDivElement>(null);
  const primeiraVez = useRef(true);
  useEffect(() => {
    // centraliza o chip escolhido só na faixa de chips. Na abertura, só se ele não estiver entre os primeiros
    // (que já aparecem) e depois da animação — ler a posição antes forçava o layout da janela inteira e travava.
    const idx = cats.findIndex((c) => c[0] === cat);
    const centralizar = () => {
      const box = chipsRef.current, chip = box?.querySelector<HTMLElement>('.chip.on');
      if (box && chip) box.scrollTo({ left: chip.offsetLeft - (box.clientWidth - chip.offsetWidth) / 2, behavior: primeiraVez.current ? 'auto' : 'smooth' });
      primeiraVez.current = false;
    };
    if (primeiraVez.current) {
      if (idx < 3) { primeiraVez.current = false; return; }
      const t = setTimeout(centralizar, 380);
      return () => clearTimeout(t);
    }
    centralizar();
  }, [cat]); // eslint-disable-line react-hooks/exhaustive-deps
  const cartao = l.cartaoId ? D.cartoes.find((c) => c.id === l.cartaoId) : undefined;
  // forma de pagamento: Pix/débito sai na hora (sem parcelar); boleto e crédito podem parcelar; Pix parcelado sempre parcela
  const [meio, setMeio] = useState<Meio>(() => (lanc?.cartaoId ? 'credito' : lanc?.meio ?? 'pix'));
  const [parcEscolha, setParcEscolha] = useState((lanc?.parcelas ?? 1) > 1);
  const [nParc, setNParc] = useState(Math.max(2, lanc?.parcelas ?? 2));
  const [adiar, setAdiar] = useState(lanc?.adiar ?? 1);
  const [modoValor, setModoValor] = useState<'total' | 'parcela'>('total');
  const podeParcelar = meio === 'boleto' || meio === 'credito';
  const parcelado = meio === 'pixparc' || (podeParcelar && parcEscolha);
  const parcelas = l.tipo === 'saida' && parcelado ? nParc : 1;
  const escolherMeio = (m: Meio, cartaoId: string | null = null) => { setMeio(m); set({ cartaoId }); };
  const total = parcelas > 1 && modoValor === 'parcela' ? l.valor * parcelas : l.valor;
  const valorParcela = Math.floor(total / parcelas);

  // cronograma: quando cada parcela sai da conta (cartão = vencimento da fatura; boleto/Pix = mês a mês)
  const pd = parse(l.data);
  const desloc = !cartao && parcelado ? adiar : 0;
  const compraN = (i: number) => dateOf(pd.getFullYear(), pd.getMonth() + i + (cartao ? 0 : desloc), pd.getDate());
  const saida = (i: number) => (cartao ? pagamentoCartao(cartao, compraN(i)) : compraN(i));
  const fmtData = (iso: string) => `${dm(iso)}/${iso.slice(2, 4)}`;

  const t = today();
  const datas: [string, string][] = [[t, 'Hoje'], [addDays(t, -1), 'Ontem'], [addDays(t, -2), diaLabel(addDays(t, -2))]];
  const outraData = !datas.some(([d]) => d === l.data);

  const salvar = () => {
    if (!l.valor) return;
    const final: Lancamento = { ...l, valor: total, cat, ico: ico !== catE(cat) ? ico : undefined, desc: l.desc.trim(), cartaoId: l.tipo === 'saida' && meio === 'credito' ? l.cartaoId : null, parcelas,
      meio: l.tipo === 'saida' ? meio : undefined, adiar: !cartao && parcelas > 1 ? desloc : undefined };
    closeSheet();
    if (novo) {
      const before = getData();
      final.id = uid();
      final.criado = Date.now();
      mutate((d) => ({ ...d, lancamentos: [...d.lancamentos, final], uso: { ...d.uso, [cat]: (d.uso[cat] ?? 0) + 1 }, aprendido: final.desc ? aprender(d.aprendido ?? {}, final.desc, final.tipo, cat, final.ico) : d.aprendido }));
      toast(parcelas > 1 ? `${parcelas}x de ${brl(valorParcela)} lançadas` : `${final.tipo === 'saida' ? 'Saída' : 'Entrada'} de ${brl(final.valor)} lançada`, () => restore(before));
    } else {
      mutate((d) => ({ ...d, lancamentos: d.lancamentos.map((x) => (x.id === final.id ? final : x)), aprendido: final.desc ? aprender(d.aprendido ?? {}, final.desc, final.tipo, cat, final.ico) : d.aprendido }));
      toast('Atualizado');
    }
  };
  const apagar = () => {
    closeSheet();
    withUndo('Lançamento apagado', (d) => ({ ...d, lancamentos: d.lancamentos.filter((x) => x.id !== l.id) }));
  };

  return (
    <div className="sl">
      <SheetHeader title={novo ? 'Novo lançamento' : 'Editar lançamento'} onDelete={novo ? undefined : apagar} />
      <div className="sl-top">
      <Segmented
        value={l.tipo}
        onChange={(tipo) => { setManual(false); set({ tipo, cat: '', ...(tipo === 'entrada' ? { cartaoId: null, parcelas: 1 } : {}) }); }}
        options={[{ v: 'saida', label: 'Saída', tone: 'out' }, { v: 'entrada', label: 'Entrada', tone: 'in' }]}
      />
      <AmountDisplay value={l.valor} compact />
      </div>
      <div className="sl-mid" data-scroll>

      <SmartDesc value={l.desc} onChange={(desc) => set({ desc })} ico={ico} placeholder={l.tipo === 'saida' ? 'Com o quê? (ex: ração, uber, ifood)' : 'De onde veio? (ex: freela)'} />
      <SmartHint sug={sug} aplicada={usaSug} atual={cat} />

      <div className="chips scroll" ref={chipsRef} style={{ marginTop: 10 }}>
        {cats.map(([k, e, n]) => <Chip key={k} on={cat === k} onClick={() => { setManual(true); set({ cat: k }); }}>{e} {n}</Chip>)}
      </div>

      {l.tipo === 'saida' && (
        <>
          <div className="lab">Como pagou</div>
          <div className="chips scroll">
            <Chip on={meio === 'pix'} onClick={() => escolherMeio('pix')}>⚡ Pix / débito</Chip>
            {D.cartoes.map((c) => <Chip key={c.id} on={meio === 'credito' && l.cartaoId === c.id} onClick={() => escolherMeio('credito', c.id)}>💳 {c.nome}</Chip>)}
            <Chip on={meio === 'boleto'} onClick={() => escolherMeio('boleto')}>📄 Boleto</Chip>
            <Chip on={meio === 'pixparc'} onClick={() => escolherMeio('pixparc')}>🔁 Pix parcelado</Chip>
          </div>
          {/* linha de altura fixa: troca de forma de pagamento não faz a janela pular */}
          <div className="pay-row">
            {podeParcelar ? (
              <Segmented value={parcEscolha ? 'p' : 'v'} onChange={(v) => setParcEscolha(v === 'p')} options={[{ v: 'v', label: 'À vista' }, { v: 'p', label: 'Parcelado' }]} />
            ) : (
              <div className="pay-info">{meio === 'pix' ? '⚡ Sai na hora da sua conta · sem parcelas' : '🔁 Cobrado mês a mês, fora do cartão'}</div>
            )}
          </div>
          <AnimatePresence initial={false}>
            {parcelado && (
              <Expande>
                <div className="row" style={{ marginTop: 12 }}>
                  <span className="mut small">Quantas vezes</span><span className="sp" />
                  <Stepper value={nParc} min={2} max={48} onChange={setNParc} fmt={(v) => `${v}x`} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <Segmented value={modoValor} onChange={setModoValor} options={[{ v: 'total', label: 'Digitei o total' }, { v: 'parcela', label: 'Digitei a parcela' }]} />
                </div>
                {!cartao && (
                  <div style={{ marginTop: 10 }}>
                    <Segmented value={adiar} onChange={setAdiar} options={[{ v: 0, label: '1ª na data da compra' }, { v: 1, label: '1ª daqui 1 mês' }]} />
                  </div>
                )}
              </Expande>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {(cartao || parcelas > 1) && l.valor > 0 && (
              <Expande className="cronograma">
                {cartao && (
                  <div className="cr-l">
                    🗓️ Compra em {fmtData(l.data)} · {cartao.nome} fecha dia {cartao.fechamento}
                    {' → '}<b>{parse(l.data).getDate() >= cartao.fechamento ? 'entra na fatura seguinte' : 'entra na fatura atual'}</b>, que vence {fmtData(saida(0))}
                  </div>
                )}
                {parcelas > 1 ? (
                  <div className="cr-l">
                    <b className="num">{parcelas}x de {brl(valorParcela)}</b> (total {brl(total)}) · 1ª em {fmtData(saida(0))}, última em {fmtData(saida(parcelas - 1))}
                  </div>
                ) : cartao ? <div className="cr-l">Sai da conta em <b>{fmtData(saida(0))}</b></div> : null}
              </Expande>
            )}
          </AnimatePresence>
        </>
      )}

      <div className="chips scroll" style={{ marginTop: 12 }}>
        {datas.map(([d, n]) => <Chip key={d} on={l.data === d} onClick={() => set({ data: d })}>{n}</Chip>)}
        <label className={`chip ${outraData ? 'on' : ''}`} style={{ position: 'relative' }}>
          📅 {outraData ? dm(l.data) : 'Outra data'}
          <input type="date" value={l.data} onChange={(e) => e.target.value && set({ data: e.target.value })} className="date-overlay" />
        </label>
      </div>

      {l.tipo === 'entrada' && (
        <div className="ent-extra">
          <div className="lab">Isso se repete?</div>
          <div className="chips">
            <Chip onClick={() => openSheet(<EditRec tipo="entrada" rec={{ tipo: 'entrada', desc: l.desc, cat, valor: l.valor, dia: parse(l.data).getDate() }} />)}>🔁 É fixo todo mês</Chip>
            <Chip onClick={() => openSheet(<ExtraSheet />)}>🎁 13º, PLR, férias…</Chip>
          </div>
        </div>
      )}
      </div>
      <div className="sl-foot">
      <Keypad small value={l.valor} onChange={(valor) => set({ valor })} />
      <div className="actions tight">
        <Button disabled={!l.valor} onClick={salvar}>{novo ? 'Lançar' : 'Salvar'}</Button>
      </div>
      </div>
    </div>
  );
}
