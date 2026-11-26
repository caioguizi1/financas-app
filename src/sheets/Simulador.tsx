/**
 * "E se eu comprar…?" — simula uma compra antes de fazer, comparando à vista e parcelado.
 * Nada é salvo. "Ver no gráfico" deixa a compra tracejada no gráfico do Início; "Lançar" abre o ＋ preenchido.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { dm } from '../lib/dates';
import { brl } from '../lib/money';
import { rotuloOpcao, simular, type OpcaoSim, type Veredito } from '../lib/simulador';
import { sugerir } from '../lib/smart';
import { closeSheet, getData, openSheet, useUI } from '../store';
import { Button, Chip } from '../ui/Controls';
import { CartaoMini, Ico } from '../ui/Ico';
import { AmountDisplay, Keypad, TecladoRecolhivel, useTeclado } from '../ui/Money';
import { SheetHeader, useRascunho } from '../ui/Sheet';
import { SmartDesc } from '../ui/Smart';
import { QuickAdd } from './QuickAdd';

const EXTRAS = [3, 6, 10, 12];
const SELO: Record<Veredito, string> = { tranquilo: 'Tranquilo', atencao: 'Atenção', aperta: 'Aperta' };
const mesNome = (mk: string) => new Date(`${mk}-15T12:00`).toLocaleDateString('pt-BR', { month: 'long' });

export function Simulador() {
  const D = getData();
  const tec = useTeclado(false);
  const [valor, setValor] = useState(0);
  const [desc, setDesc] = useState('');
  useRascunho(valor > 0 || !!desc.trim()); // fechar sem querer pergunta antes
  const [cartaoId, setCartaoId] = useState<string | null>(D.cartoes[0]?.id ?? null);
  const [extras, setExtras] = useState<number[]>([]);
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const manter = useRef(false);
  const cartao = D.cartoes.find((c) => c.id === cartaoId);
  const sug = desc.trim() ? sugerir(desc, 'saida', D.aprendido) : null;

  const sim = useMemo(
    () => (valor > 0 ? simular(D, { valor, cartaoId, parcelas: 1, desc: desc.trim() || undefined, cat: sug?.cat }, [1, 2, ...extras]) : null),
    [D, valor, cartaoId, extras, desc, sug?.cat],
  );
  const sel: OpcaoSim | undefined = sim?.opcoes.find((o) => o.parcelas === escolhida) ?? sim?.opcoes.find((o) => o.melhor) ?? sim?.opcoes[0];

  // a linha tracejada no Início acompanha a opção escolhida; fechar sem "Ver no gráfico" limpa
  useEffect(() => () => { if (!manter.current) useUI.getState().setSim(null); }, []);

  const verNoGrafico = () => {
    if (!sim || !sel) return;
    manter.current = true;
    useUI.getState().setSim({ ...sim, opcoes: [sel] });
    closeSheet();
  };
  const lancar = (o: OpcaoSim) => {
    manter.current = false;
    openSheet(<QuickAdd inicial={{ valor, desc: desc.trim(), cat: sug?.cat ?? '', cartaoId, parcelas: o.parcelas, meio: cartaoId ? 'credito' : 'pix' }} />);
  };

  return (
    <div className="sl sim">
      <SheetHeader title="E se eu comprar…?" />
      <div className="sl-top">
        <AmountDisplay value={valor} compact onClick={tec.abrir} ativo={tec.aberto} />
        <div className="sim-sub">Só uma simulação · nada é salvo</div>
      </div>
      <div className="sl-mid" data-scroll>
        <SmartDesc value={desc} onChange={setDesc} ico={sug?.ico ?? '🛍️'} cat={sug?.cat ?? 'compras'} placeholder="O quê? (opcional)" />

        <div className="lab">Como pagaria</div>
        <div className="chips scroll">
          <Chip on={!cartaoId} onClick={() => { setCartaoId(null); setEscolhida(null); }}><Ico n="pix" size={16} />Pix / débito</Chip>
          {D.cartoes.map((c) => <Chip key={c.id} on={cartaoId === c.id} onClick={() => { setCartaoId(c.id); setEscolhida(null); }}><CartaoMini c={c} />{c.nome}</Chip>)}
        </div>

        {!sim && <div className="sim-vazio"><Ico n="info" size={16} />Toque no valor e digite quanto custa. O app compara à vista e parcelado com a sua projeção dos próximos 90 dias.</div>}

        {sim && (
          <>
            <div className="lab">Comparar</div>
            <div className="sim-ops">
              {sim.opcoes.map((o) => {
                const parcela = Math.round(valor / o.parcelas);
                return (
                  <button key={o.parcelas} className={`sim-op ${o.veredito}${sel === o ? ' sel' : ''}`} onClick={() => setEscolhida(o.parcelas)} aria-pressed={sel === o}>
                    <span className="sim-op-h">
                      <b>{o.parcelas === 1 ? 'À vista' : `${o.parcelas}x`}</b>
                      <span className={`selo ${o.melhor ? 'melhor' : o.veredito}`}>{o.melhor ? 'Melhor' : SELO[o.veredito]}</span>
                    </span>
                    <span className="sim-de">{o.parcelas === 1 ? (cartao ? `na fatura de ${mesNome(o.mes)}` : 'sai hoje') : `de ${brl(parcela)}`}</span>
                    <span className="sim-k">Saldo mais baixo</span>
                    <span className={`sim-v ${o.minimo.v < 0 ? 'neg' : ''}`}>{brl(o.minimo.v)} <small>{dm(o.minimo.d)}</small></span>
                    <span className="sim-k">Dias no negativo</span>
                    <span className="sim-v">{o.diasNeg === 0 ? 'nenhum' : `${o.diasNeg} dia${o.diasNeg > 1 ? 's' : ''}`}{o.diasNeg > sim.base.diasNeg && <small> (+{o.diasNeg - sim.base.diasNeg})</small>}</span>
                    <span className="sim-k">Fim de {mesNome(o.mes)}</span><span className={`sim-v ${o.fimMes < 0 ? 'neg' : ''}`}>{brl(o.fimMes)}</span>
                    <span className="sim-k">Parcelas/renda · {mesNome(o.mes).slice(0, 3)}</span>
                    <span className="sim-v">{o.comprometimento ? `${o.comprometimento.antes}% → ${o.comprometimento.depois}%` : 'sem parcela nova'}</span>
                  </button>
                );
              })}
            </div>
            {cartaoId ? (
              <div className="chips sim-mais">
                {EXTRAS.map((n) => <Chip key={n} on={extras.includes(n)} onClick={() => setExtras((x) => (x.includes(n) ? x.filter((y) => y !== n) : [...x, n]))}>{extras.includes(n) ? `${n}x ✓` : `+ ${n}x`}</Chip>)}
              </div>
            ) : <div className="sim-nota">No Pix a compra sai na hora. Parcelado: escolha um cartão.</div>}

            {sim.dica && <div className="sim-dica"><Ico n="ideia" size={17} /><span>{sim.dica}</span></div>}
            <div className="sim-nota">Conta como gasto a mais, além do gasto típico do cartão. Parcelas sem juros. {sim.base.diasNeg > 0 && `Sem a compra, o saldo mais baixo seria ${brl(sim.base.minimo.v)} em ${dm(sim.base.minimo.d)}.`}</div>
          </>
        )}
      </div>
      <div className="sl-foot">
        <TecladoRecolhivel aberto={tec.aberto} onOk={tec.fechar}><Keypad small value={valor} onChange={(v) => { setValor(v); }} /></TecladoRecolhivel>
        <div className="actions tight">
          <Button disabled={!sel} onClick={() => sel && lancar(sel)}>{sel ? `Lançar ${rotuloOpcao(sel.parcelas).toLowerCase()}${cartao ? ` no ${cartao.nome}` : ' no Pix'}` : 'Lançar'}</Button>
          {/* sempre presente (inativo sem valor): se aparecesse no 1º dígito, o teclado subia e o dedo errava a tecla */}
          <Button kind="ghost" disabled={!sel} onClick={verNoGrafico}>Ver no gráfico</Button>
        </div>
      </div>
    </div>
  );
}

export const tituloSim = (o: OpcaoSim, valor: number, cartao?: string) =>
  `${brl(valor)} ${o.parcelas === 1 ? 'à vista' : `em ${o.parcelas}x`}${cartao ? ` · ${cartao}` : ' · Pix'}`;
