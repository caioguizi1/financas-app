import { AnimatePresence, m } from 'motion/react';
import { useMemo, useState } from 'react';
import { CAT_IN, CAT_OUT, catE, catN } from '../lib/categories';
import { dm, mesCurto, today } from '../lib/dates';
import { analisar, encaixar, lerArquivo, paraLancamentos, preparar, type Item, type MetaFatura, type TipoImport } from '../lib/importar';
import type { Cartao, Data } from '../lib/types';
import { registrar } from '../lib/importacoes';
import { brl } from '../lib/money';
import { aprender } from '../lib/smart';
import { closeSheet, getData, restore, mutate, toast } from '../store';
import { Button, Chip, Segmented } from '../ui/Controls';
import { SheetHeader } from '../ui/Sheet';
import { Expande } from '../ui/Expande';
import { spring } from '../ui/motion';
import { CartaoMini, Ico } from '../ui/Ico';
import { nomeExib } from '../ui/nome';

const MOTIVO: Record<string, string> = { duplicado: 'já lançado', parcela: 'parcela de compra já importada', fixo: 'já é fixo', pagamento: 'pagamento da fatura', entrada: 'estorno/crédito' };
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
  const [meta, setMeta] = useState<MetaFatura>({});
  const [nomeArquivo, setNomeArquivo] = useState<string>();
  const [ajustarDias, setAjustarDias] = useState(true);
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
        const lido = lerArquivo(f.name, texto, today());
        if (!lido.linhas.length) throw new Error('vazio');
        // fatura em PDF diz de qual banco é: escolhe o cartão certo sozinho
        let alvo = cartao;
        if (tipo === 'fatura' && lido.meta.banco) {
          const b = normalizarNome(lido.meta.banco);
          alvo = getData().cartoes.find((c) => normalizarNome(c.nome).includes(b) || b.includes(normalizarNome(c.nome))) ?? cartao;
          if (alvo) setCid(alvo.id);
        }
        setMeta(lido.meta);
        setNomeArquivo(f.name);
        setItens(preparar(getData(), lido.linhas, tipo, alvo));
      } catch {
        setErro('Não consegui ler esse arquivo. Tente exportar em CSV ou OFX pelo app do banco — ou continue lançando à mão, que funciona igual.');
      } finally { setLendo(false); }
    };
    inp.click();
  };

  const a = useMemo(() => (itens ? analisar(itens, today(), cartao, meta) : null), [itens, cartao, meta]);
  const incluidos = itens?.filter((i) => i.incluir) ?? [];

  // dias de fechamento/vencimento que a fatura informa (quando diferem do cadastro)
  const diaFecha = meta.fechamento ? +meta.fechamento.slice(8) : undefined;
  const diaVence = meta.vencimento ? +meta.vencimento.slice(8) : undefined;
  const cartaoFinal: Cartao | undefined = cartao && ajustarDias ? { ...cartao, fechamento: diaFecha ?? cartao.fechamento, vencimento: diaVence ?? cartao.vencimento } : cartao;
  const difDias = !!cartao && ((diaFecha && diaFecha !== cartao.fechamento) || (diaVence && diaVence !== cartao.vencimento));

  // como a importação se encaixa no que já existe (valores informados à mão nas faturas seguintes)
  const plano = useMemo(() => {
    if (!itens) return null;
    const novos = paraLancamentos(itens, tipo, cartaoFinal, meta.vencimento);
    const D0 = getData();
    if (tipo !== 'fatura' || !cartaoFinal || !meta.vencimento) return { novos, lancamentos: [...D0.lancamentos, ...novos], reajustes: [] };
    const base = { ...D0, cartoes: D0.cartoes.map((c) => (c.id === cartaoFinal.id ? cartaoFinal : c)) };
    return { novos, ...encaixar(base, novos, cartaoFinal, meta.vencimento) };
  }, [itens, tipo, cartaoFinal, meta.vencimento]);

  const importar = () => {
    if (!itens) return;
    if (!plano) return;
    const before = getData();
    const novos = plano.novos;
    mutate((d) => {
      let mem = d.aprendido ?? {};
      for (const l of novos) if (l.desc) mem = aprender(mem, l.desc, l.tipo, l.cat, l.ico);
      const nd: Data = {
        ...d,
        lancamentos: plano.lancamentos,
        aprendido: mem,
        cartoes: cartaoFinal ? d.cartoes.map((c) => (c.id === cartaoFinal.id ? { ...cartaoFinal, estimativa: c.estimativa ?? (usarTipico && a ? a.tipicoSugerido : undefined) } : c)) : d.cartoes,
      };
      // histórico: qual fatura foi enviada pra qual cartão, e se bateu com o banco
      const conf = a?.conferencia;
      return registrar(nd, {
        tipo, cartaoId: cartaoFinal?.id, venc: meta.vencimento, fechamento: meta.fechamento, arquivo: nomeArquivo,
        total: a?.total ?? 0, totalBanco: conf?.banco, conferida: conf ? Math.abs(conf.lido - conf.banco) <= 100 : undefined,
        ids: novos.map((l) => l.id),
      });
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
          <div className="imp-opc"><Ico n="info" size={16} />Opcional: um atalho pra preencher mais rápido. O Fluxo funciona igual lançando à mão.</div>
          <Segmented value={tipo} onChange={setTipo} options={[{ v: 'fatura', label: 'Fatura do cartão' }, { v: 'extrato', label: 'Extrato da conta' }]} />
          {tipo === 'fatura' && (
            D.cartoes.length ? (
              <>
                <div className="lab">De qual cartão?</div>
                <div className="chips scroll">{D.cartoes.map((c) => <Chip key={c.id} on={c.id === cid} onClick={() => setCid(c.id)}><CartaoMini c={c} />{c.nome}</Chip>)}</div>
              </>
            ) : <div className="pay-info" style={{ marginTop: 12, height: 'auto', padding: 12 }}>Cadastre um cartão em Ajustes antes de importar uma fatura.</div>
          )}
          <button className="imp-drop" onClick={escolher} disabled={lendo || (tipo === 'fatura' && !cartao)}>
            <span className="imp-ico">{lendo ? <Ico n="carregando" size={30} className="spin" /> : <Ico n="arquivo" size={30} />}</span>
            <b>{lendo ? 'Lendo o arquivo…' : 'Escolher arquivo'}</b>
            <span className="mut small">CSV, OFX ou PDF exportado do app do banco</span>
          </button>
          {erro && <div className="alert" style={{ marginTop: 12 }}><span>⚠️</span><div>{erro}</div></div>}
          <div className="imp-dicas">
            <div><Ico n="privado" size={16} />O arquivo é lido só no seu celular — nada é enviado.</div>
            <div><Ico n="parcelas" size={16} />Parcelas como "PARC 03/10" viram as 7 parcelas restantes nos meses seguintes.</div>
            <div><Ico n="semDuplicar" size={16} />O que você já lançou, os fixos e o pagamento da fatura são reconhecidos e não duplicam.</div>
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
        {tipo === 'fatura' && meta.vencimento && (
          <div className={`imp-venc ${meta.vencimento < today() ? 'passada' : ''}`}>
            <b>{meta.vencimento < today() ? `Fatura que venceu em ${fmt(meta.vencimento)}` : `Fatura que vence em ${fmt(meta.vencimento)}`}</b>
            <span>{meta.fechamento ? `Fechou em ${fmt(meta.fechamento)}. ` : ''}{meta.vencimento < today()
              ? 'Já foi paga: entra como histórico e não mexe no saldo de hoje. As parcelas que continuam caem sozinhas nas próximas faturas.'
              : 'Ainda vai sair da conta: entra na previsão no dia do vencimento.'}</span>
          </div>
        )}
        {a && (a.conferencia || a.confProxima || a.confRestante) && (
          <div className="imp-conf">
            {a.conferencia && <Conf ok={Math.abs(a.conferencia.lido - a.conferencia.banco) <= 100} t={Math.abs(a.conferencia.lido - a.conferencia.banco) <= 100 ? `Soma das compras confere com o banco (${brl(a.conferencia.banco)})` : `Li ${brl(a.conferencia.lido)}, o banco diz ${brl(a.conferencia.banco)} — algum item pode não ter sido lido`} />}
            {a.confProxima && <Conf ok={Math.abs(a.confProxima.calc - a.confProxima.banco) <= Math.max(100, a.confProxima.banco * 0.01)} t={`Parcelas na próxima fatura: ${brl(a.confProxima.calc)} (banco: ${brl(a.confProxima.banco)})`} />}
            {a.confRestante && <Conf ok={Math.abs(a.confRestante.calc - a.confRestante.banco) <= Math.max(100, a.confRestante.banco * 0.02)} t={`Parcelas futuras no total: ${brl(a.confRestante.calc)} (banco: ${brl(a.confRestante.banco)})`} />}
          </div>
        )}
        {difDias && cartao && (
          <label className="imp-opt"><input type="checkbox" checked={ajustarDias} onChange={(e) => setAjustarDias(e.target.checked)} />
            <span>Corrigir o {cartao.nome} como na fatura: fecha dia <b>{diaFecha ?? cartao.fechamento}</b>{diaFecha !== cartao.fechamento ? ` (era ${cartao.fechamento})` : ''}, vence dia <b>{diaVence ?? cartao.vencimento}</b>{diaVence !== cartao.vencimento ? ` (era ${cartao.vencimento})` : ''}</span></label>
        )}
        {plano && plano.reajustes.length > 0 && (
          <div className="imp-conf">
            {plano.reajustes.map((r) => (
              <Conf key={r.venc} ok t={`Fatura de ${mesCurto(r.venc.slice(0, 7))}: o valor que você informou à mão já incluía ${brl(r.antes - r.depois)} destas parcelas — descontei pra não contar em dobro`} />
            ))}
          </div>
        )}
        {a && (
          <div className="imp-an">
            <div className="imp-tot"><span className="mut">{tipo === 'fatura' ? 'Compras na fatura' : 'Total de saídas'}</span><b className="num">{brl(a.total)}</b></div>
            {a.creditos > 0 && <div className="imp-split"><span>Estornos/créditos <b className="num pos">−{brl(a.creditos)}</b></span></div>}
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
                <div className="lab">Já comprometido nas próximas faturas</div>
                <div className="imp-meses">
                  {a.proximosMeses.filter((x) => x.valor > 0).map((x) => <div key={x.mes}><span className="mut">{mesCurto(x.mes)}</span><b className="num">{brl(x.valor)}</b></div>)}
                </div>
                <div className="dim hint">{a.parcelados.length} {a.parcelados.length === 1 ? 'compra parcelada continua' : 'compras parceladas continuam'} — entram sozinhas nas próximas faturas.</div>
              </>
            )}
            {a.assinaturas.length > 0 && <div className="dim hint"><Ico n="assinatura" size={16} />Assinaturas nesta fatura: {a.assinaturas.map((i) => i.desc).join(', ')}. Vale cadastrar como fixo no cartão.</div>}
            {cartao && (cartao.estimativa
              ? <div className="dim hint">Gasto típico do {cartao.nome}: {brl(cartao.estimativa)} (esta fatura: {brl(a.total)}). Ajuste em Editar cartão se mudou.</div>
              : <label className="imp-opt"><input type="checkbox" checked={usarTipico} onChange={(e) => setUsarTipico(e.target.checked)} />
                <span>Usar <b>{brl(a.tipicoSugerido)}</b> como gasto típico do {cartao.nome} (prevê as próximas faturas)</span></label>
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
                <div className="t">{nomeExib(i.desc)}{i.parcela && <span className="tag">{i.parcela.i}/{i.parcela.n}</span>}</div>{nomeExib(i.desc) !== i.desc && <div className="raw">{i.desc}</div>}
                <div className="s">{fmt(i.data)} · {catN(i.cat)}{i.motivo ? ` · ${MOTIVO[i.motivo]}` : ''}</div>
                <AnimatePresence initial={false}>
                  {catAberta === i.id && (
                    <Expande className="chips scroll" style={{ marginTop: 8 }}>
                      {(i.valor > 0 ? CAT_OUT : CAT_IN).map(([k, e, n]) => <Chip key={k} on={i.cat === k} onClick={() => mudarCat(i.id, k)}>{e} {n}</Chip>)}
                    </Expande>
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

const normalizarNome = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

function Conf({ ok, t }: { ok: boolean; t: string }) {
  return <div className={`imp-c ${ok ? 'ok' : 'warn'}`}><span>{ok ? '✓' : '!'}</span><div>{t}</div></div>;
}
