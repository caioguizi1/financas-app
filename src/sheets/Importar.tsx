import { AnimatePresence, m } from 'motion/react';
import { useMemo, useState } from 'react';
import { CAT_IN, CAT_OUT, catE, catN } from '../lib/categories';
import { dm, mesCurto, today } from '../lib/dates';
import { pagamentoCartao } from '../lib/engine';
import { analisar, lerArquivo, paraLancamentos, preparar, type Item, type TipoImport } from '../lib/importar';
import { brl } from '../lib/money';
import { aprender } from '../lib/smart';
import { closeSheet, getData, restore, mutate, toast } from '../store';
import { Button, Chip, Segmented } from '../ui/Controls';
import { SheetHeader } from '../ui/Sheet';
import { spring } from '../ui/motion';

const MOTIVO: Record<string, string> = { duplicado: 'já lançado', fixo: 'já é fixo', pagamento: 'pagamento da fatura', entrada: 'estorno/crédito' };
const fmt = (iso: string) => `${dm(iso)}/${iso.slice(2, 4)}`;

/** Importar fatura do cartão ou extrato (opcional). */
export function ImportarSheet({ cartaoId }: { cartaoId?: string }) {
  const D = getData();
  const [tipo, setTipo] = useState<TipoImport>(cartaoId || D.cartoes.length ? 'fatura' : 'extrato');
  const [cid, setCid] = useState(cartaoId ?? D.cartoes[0]?.id);
  const [itens, setItens] = useState<Item[] | null>(null);
  const [erro, setErro] = useState('');
  const [lendo, setLendo] = useState(false);
  const [usarTipico, setUsarTipico] = useState(true);
  const [trocarAjustes, setTrocarAjustes] = useState(true);
  const [catAberta, setCatAberta] = useState<string | null>(null);
  const cartao = tipo === 'fatura' ? D.cartoes.find((c) => c.id === cid) : undefined;

  const escolher = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.csv,.ofx,.pdf,.txt,text/csv,application/pdf,application/x-ofx';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return;
      setErro(''); setLendo(true);
      try {
        const texto = f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
          ? await (await import('../lib/pdfTexto')).textoDoPDF(f)
          : await f.text();
        const linhas = lerArquivo(f.name, texto, today());
        if (!linhas.length) throw new Error('vazio');
        setItens(preparar(getData(), linhas, tipo, cartao));
      } catch {
        setErro('Não consegui ler esse arquivo. Tente exportar em CSV ou OFX pelo app do banco — ou continue lançando à mão, que funciona igual.');
      } finally { setLendo(false); }
    };
    inp.click();
  };

  const a = useMemo(() => (itens ? analisar(itens, today(), cartao) : null), [itens, cartao]);
  const incluidos = itens?.filter((i) => i.incluir) ?? [];

  // ajustes de fatura que este arquivo substitui (pra não contar em dobro)
  const ajustesAfetados = useMemo(() => {
    if (!cartao || !itens) return [];
    const vencs = new Set(incluidos.map((i) => pagamentoCartao(cartao, i.data)));
    return D.lancamentos.filter((l) => l.cartaoId === cartao.id && l.cat === 'fatura' && l.desc.startsWith('Ajuste fatura') && vencs.has(pagamentoCartao(cartao, l.data)));
  }, [cartao, itens, incluidos, D.lancamentos]);

  const importar = () => {
    if (!itens) return;
    const before = getData();
    const novos = paraLancamentos(itens, tipo, cartao);
    const remover = new Set(trocarAjustes ? ajustesAfetados.map((l) => l.id) : []);
    mutate((d) => {
      let mem = d.aprendido ?? {};
      for (const l of novos) if (l.desc) mem = aprender(mem, l.desc, l.tipo, l.cat, l.ico);
      return {
        ...d,
        lancamentos: [...d.lancamentos.filter((l) => !remover.has(l.id)), ...novos],
        aprendido: mem,
        cartoes: cartao && usarTipico && a && !cartao.estimativa ? d.cartoes.map((c) => (c.id === cartao.id ? { ...c, estimativa: a.tipicoSugerido } : c)) : d.cartoes,
      };
    });
    closeSheet();
    toast(`${novos.length} lançamentos importados`, () => restore(before));
  };

  const alternar = (id: string) => setItens((xs) => xs!.map((i) => (i.id === id ? { ...i, incluir: !i.incluir } : i)));
  const mudarCat = (id: string, cat: string) => { setItens((xs) => xs!.map((i) => (i.id === id ? { ...i, cat, ico: catE(cat) } : i))); setCatAberta(null); };

  // ---------- passo 1: escolher ----------
  if (!itens) {
    return (
      <div className="sl">
        <SheetHeader title="Importar" />
        <div className="sl-mid" data-scroll>
          <div className="imp-opc">✨ Opcional: um atalho pra preencher mais rápido. O Fluxo funciona igual lançando à mão.</div>
          <Segmented value={tipo} onChange={setTipo} options={[{ v: 'fatura', label: 'Fatura do cartão' }, { v: 'extrato', label: 'Extrato da conta' }]} />
          {tipo === 'fatura' && (
            D.cartoes.length ? (
              <>
                <div className="lab">De qual cartão?</div>
                <div className="chips scroll">{D.cartoes.map((c) => <Chip key={c.id} on={c.id === cid} onClick={() => setCid(c.id)}>💳 {c.nome}</Chip>)}</div>
              </>
            ) : <div className="pay-info" style={{ marginTop: 12, height: 'auto', padding: 12 }}>Cadastre um cartão em Ajustes antes de importar uma fatura.</div>
          )}
          <button className="imp-drop" onClick={escolher} disabled={lendo || (tipo === 'fatura' && !cartao)}>
            <span className="imp-ico">{lendo ? '⏳' : '📄'}</span>
            <b>{lendo ? 'Lendo o arquivo…' : 'Escolher arquivo'}</b>
            <span className="mut small">CSV, OFX ou PDF exportado do app do banco</span>
          </button>
          {erro && <div className="alert" style={{ marginTop: 12 }}><span>⚠️</span><div>{erro}</div></div>}
          <div className="imp-dicas">
            <div>🔒 O arquivo é lido só no seu celular — nada é enviado.</div>
            <div>🧾 Parcelas como "PARC 03/10" viram as 7 parcelas restantes nos meses seguintes.</div>
            <div>♻️ O que você já lançou, os fixos e o pagamento da fatura são reconhecidos e não duplicam.</div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- passo 2: revisar + análise ----------
  return (
    <div className="sl">
      <SheetHeader title={tipo === 'fatura' ? `Fatura · ${cartao?.nome}` : 'Extrato'} />
      <div className="sl-mid" data-scroll>
        {a && (
          <div className="imp-an">
            <div className="imp-tot"><span className="mut">Total {tipo === 'fatura' ? 'da fatura' : 'de saídas'}</span><b className="num">{brl(a.total)}</b></div>
            <div className="imp-split"><span>À vista <b className="num">{brl(a.avista)}</b></span><span>Parcelas <b className="num">{brl(a.total - a.avista)}</b></span></div>
            <div className="lab">Onde foi o dinheiro</div>
            {a.porCategoria.slice(0, 5).map((c) => (
              <div key={c.cat} className="imp-cat">
                <span>{catE(c.cat)} {catN(c.cat)}</span>
                <div className="imp-bar"><m.i initial={{ width: 0 }} animate={{ width: `${Math.max(4, c.pct * 100)}%` }} transition={spring} /></div>
                <span className="num">{brl(c.valor)}</span>
              </div>
            ))}
            {a.parcelados.length > 0 && (
              <>
                <div className="lab">Já comprometido nos próximos meses</div>
                <div className="imp-meses">
                  {a.proximosMeses.filter((x) => x.valor > 0).map((x) => <div key={x.mes}><span className="mut">{mesCurto(x.mes)}</span><b className="num">{brl(x.valor)}</b></div>)}
                </div>
                <div className="dim hint">{a.parcelados.length} {a.parcelados.length === 1 ? 'compra parcelada continua' : 'compras parceladas continuam'} — entram sozinhas nas próximas faturas.</div>
              </>
            )}
            {a.assinaturas.length > 0 && <div className="dim hint">📺 Assinaturas nesta fatura: {a.assinaturas.map((i) => i.desc).join(', ')}. Vale cadastrar como fixo no cartão.</div>}
            {cartao && (cartao.estimativa
              ? <div className="dim hint">Gasto típico do {cartao.nome}: {brl(cartao.estimativa)} (esta fatura: {brl(a.total)}). Ajuste em Editar cartão se mudou.</div>
              : <label className="imp-opt"><input type="checkbox" checked={usarTipico} onChange={(e) => setUsarTipico(e.target.checked)} />
                <span>Usar <b>{brl(a.tipicoSugerido)}</b> como gasto típico do {cartao.nome} (prevê as próximas faturas)</span></label>
            )}
            {ajustesAfetados.length > 0 && (
              <label className="imp-opt"><input type="checkbox" checked={trocarAjustes} onChange={(e) => setTrocarAjustes(e.target.checked)} />
                <span>Substituir o valor que você informou à mão nesta fatura ({brl(ajustesAfetados.reduce((s, l) => s + (l.tipo === 'saida' ? l.valor : -l.valor), 0))}) pelos itens importados</span></label>
            )}
          </div>
        )}

        <div className="lab">{itens.length} itens · {incluidos.length} serão lançados</div>
        <div className="list">
          {itens.map((i) => (
            <div key={i.id} className={`imp-it ${i.incluir ? '' : 'off'}`}>
              <button className="imp-chk" onClick={() => alternar(i.id)} aria-label={i.incluir ? 'Não importar' : 'Importar'}>{i.incluir ? '✓' : ''}</button>
              <button className="ico" onClick={() => setCatAberta(catAberta === i.id ? null : i.id)}>{i.ico}</button>
              <div className="m">
                <div className="t">{i.desc}{i.parcela && <span className="tag">{i.parcela.i}/{i.parcela.n}</span>}</div>
                <div className="s">{fmt(i.data)} · {catN(i.cat)}{i.motivo ? ` · ${MOTIVO[i.motivo]}` : ''}</div>
                <AnimatePresence initial={false}>
                  {catAberta === i.id && (
                    <m.div className="chips scroll" style={{ marginTop: 8 }} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                      {(i.valor > 0 ? CAT_OUT : CAT_IN).map(([k, e, n]) => <Chip key={k} on={i.cat === k} onClick={() => mudarCat(i.id, k)}>{e} {n}</Chip>)}
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
              <div className={`v num ${i.valor < 0 ? 'pos' : ''}`}>{brl(-i.valor)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="sl-foot">
        <Button disabled={!incluidos.length} onClick={importar}>Importar {incluidos.length} lançamentos</Button>
      </div>
    </div>
  );
}
