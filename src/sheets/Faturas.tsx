import { useState } from 'react';

import { dm, today } from '../lib/dates';
import { ajusteFatura, faturasAtuais, pagarFatura } from '../lib/faturas';
import { brl } from '../lib/money';
import type { Lancamento } from '../lib/types';
import { closeSheet, openSheet, useData, withUndo } from '../store';
import { Button, Chip } from '../ui/Controls';
import { SheetHeader } from '../ui/Sheet';
import { ValueRows } from '../ui/ValueRows';
import { QuickAdd } from './QuickAdd';
import { doCartao, remover as removerImportacao, valores } from '../lib/importacoes';
import { mesCurto, monthKey } from '../lib/dates';
import { ICalendar, ICheckCircle, IImport, IUndo } from '../ui/Icons';
import type { Fatura } from '../lib/faturas';
import { ImportarSheet } from './Importar';
import { CartaoMini } from '../ui/Ico';
import { CatGlyph } from '../ui/CatIco';
import { nomeExib } from '../ui/nome';

const fmt = (iso: string) => `${dm(iso)}/${iso.slice(2, 4)}`;

/** Faturas de um cartão: o que o app somou + conferência com o valor do app do banco. */
export function FaturasSheet({ cartaoId }: { cartaoId: string }) {
  const D = useData(); // reativo: 'paguei hoje' atualiza na hora
  const [sel, setSel] = useState(cartaoId);
  const c = D.cartoes.find((x) => x.id === sel);
  const hoje = today();
  const fats = c ? faturasAtuais(D, c, hoje) : [];
  const [reaisPor, setReaisPor] = useState<Record<string, number[]>>({});
  const reais = reaisPor[sel] ?? fats.map((f) => f.total);
  const setReais = (fn: (r: number[]) => number[]) => setReaisPor((x) => ({ ...x, [sel]: fn(reais) }));
  const [ativa, setAtiva] = useState(0);
  const importadas = c ? doCartao(D, c.id) : [];
  const vals = (x: (typeof importadas)[number]) => valores(D, x);
  if (!c) return null;

  const mudou = D.cartoes.some((cc) => { const r = reaisPor[cc.id]; return !!r && faturasAtuais(D, cc, hoje).some((f, i) => r[i] !== f.total); });
  // salva a conferência de todos os cartões editados
  const salvar = () => {
    const ajustes = D.cartoes.flatMap((cc) => {
      const r = reaisPor[cc.id];
      if (!r) return [];
      return faturasAtuais(D, cc, hoje).map((f, i) => ajusteFatura(f, r[i])).filter(Boolean) as Lancamento[];
    });
    closeSheet();
    if (ajustes.length) withUndo('Faturas conferidas', (d) => ({ ...d, lancamentos: [...d.lancamentos, ...ajustes] }));
  };

  return (
    <div className="sl">
      <SheetHeader title={`Faturas · ${c.nome}`} />
      <div className="sl-mid" data-scroll>
        {D.cartoes.length > 1 && (
          <div className="chips scroll" style={{ marginBottom: 12 }}>
            {D.cartoes.map((x) => <Chip key={x.id} on={x.id === sel} onClick={() => { setSel(x.id); setAtiva(0); }}><CartaoMini c={x} />{x.nome}</Chip>)}
          </div>
        )}
        <p className="mut small" style={{ marginBottom: 14 }}>
          Fecha dia {c.fechamento}, vence dia {c.vencimento}. Embaixo, confira com o app do banco: se o valor for diferente, digite o real e eu ajusto a diferença.
        </p>
        <div className="lab" style={{ marginTop: 0 }}>Faturas importadas deste cartão</div>
        {importadas.length ? (
          <div className="list imp-lista">
            {importadas.map((x) => (
              <div key={x.id} className="imp-reg">
                <span className={`imp-reg-i ${x.conferida === false ? 'warn' : 'ok'}`}>{x.conferida === false ? '!' : '✓'}</span>
                <div className="m">
                  <div className="t">{x.venc ? `Fatura de ${mesCurto(monthKey(x.venc))}` : 'Extrato'}{x.venc ? <span className="dim"> · {x.venc < hoje ? 'venceu' : 'vence'} {fmt(x.venc)}</span> : null}</div>
                  <div className="s">
                    {x.ids.length} itens · {brl(vals(x).creditos ? vals(x).liquido : x.total)}
                    {x.conferida === true && ' · bate com o banco'}
                    {x.conferida === false && x.totalBanco != null && ` · banco diz ${brl(x.totalBanco)}`}
                    {x.inferida && ' · importada antes do histórico'}
                    {!x.inferida && ` · enviada em ${new Date(x.quando).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
                  </div>
                  {vals(x).creditos > 0 && <div className="s imp-reg-det">Compras {brl(vals(x).compras)} · créditos −{brl(vals(x).creditos)}</div>}
                </div>
                <button className="imp-reg-x" aria-label="Desfazer importação"
                  onClick={() => withUndo(`Importação de ${x.venc ? mesCurto(monthKey(x.venc)) : 'extrato'} desfeita`, (d) => removerImportacao(d, x.id))}>
                  <IUndo size={18} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <button className="imp-vazio" onClick={() => openSheet(<ImportarSheet cartaoId={sel} />)}>
            <IImport /><span>Nenhuma fatura importada ainda. <b>Importar</b> é opcional — lançar à mão funciona igual.</span>
          </button>
        )}

        <div className="lab">Faturas atuais</div>
        {fats.map((f) => (
          <div key={f.vencimento} className="fat-box">
            <div className="fat-h">
              <span className={`fat-tag ${f.status}`}>{f.status === 'fechada' ? 'Fechada' : 'Aberta'}</span>
              <span className="mut small">{f.status === 'fechada' ? `fechou ${fmt(f.fecha)}` : `fecha ${fmt(f.fecha)}`} · vence <b>{fmt(f.vencimento)}</b></span>
            </div>
            {f.itens.length ? (
              <div className="fat-itens">
                {f.itens.map((e, k) => {
                  const l = D.lancamentos.find((x) => x.id === e.ref);
                  return (
                    <button key={k} className="fat-it" onClick={() => l && openSheet(<QuickAdd lanc={l} />)} disabled={!l}>
                      <span><CatGlyph cat={e.cat} ico={e.ico} /></span><span className="m"><span className="m-n">{nomeExib(e.desc)}{e.fixo ? ' · fixo' : ''}</span>{e.adiado && <span className="tag tag-l" title="Compra adiada da fatura anterior (Pula Compra) e paga nesta">FATURA ANTERIOR</span>}</span><span className="num">{brl(e.valor)}</span>
                    </button>
                  );
                })}
              </div>
            ) : <div className="dim small" style={{ padding: '6px 0' }}>Nada lançado nesta fatura ainda.</div>}
            <div className="fat-tot"><span className="mut">Somado no app</span><b className="num">{brl(f.total)}</b></div>
            {c.estimativa && f.status === 'aberta' && c.estimativa > f.total && (
              <div className="fat-tot"><span className="mut">Previsto com gasto típico</span><span className="num">{brl(c.estimativa)}</span></div>
            )}
            <Pagamento f={f} hoje={hoje}
              pagarHoje={() => withUndo(`Fatura ${c.nome} paga hoje`, (d) => pagarFatura(d, c, f.vencimento, hoje))}
              pagarEm={(data) => withUndo(`Fatura ${c.nome}: pagamento em ${fmt(data)}`, (d) => pagarFatura(d, c, f.vencimento, data))}
              voltar={() => withUndo('Voltou pro vencimento', (d) => pagarFatura(d, c, f.vencimento, null))} />
          </div>
        ))}
        <div className="lab">Valor no app do banco</div>
        <ValueRows
          linhas={fats.map((f, i) => ({ id: f.vencimento, label: `${f.status === 'fechada' ? 'Fechada' : 'Aberta'} · vence ${fmt(f.vencimento)}`, valor: reais[i],
            nota: reais[i] !== f.total ? `ajuste de ${brl(reais[i] - f.total, true)}` : 'igual ao app' }))}
          ativa={ativa} onAtiva={setAtiva} onValor={(i, v) => setReais((r) => r.map((x, j) => (j === i ? v : x)))}
        />
      </div>
      <div className="sl-foot">
        {mudou
          ? <Button onClick={salvar}>Salvar valores do banco</Button>
          : <Button kind="ghost" onClick={() => openSheet(<ImportarSheet cartaoId={sel} />)}><span className="btn-ico"><IImport /></span>Importar fatura (opcional)</Button>}
      </div>
    </div>
  );
}

/** Quando a fatura sai da conta + ações (pagar hoje / escolher data / voltar pro vencimento). */
function Pagamento({ f, hoje, pagarHoje, pagarEm, voltar }: { f: Fatura; hoje: string; pagarHoje: () => void; pagarEm: (d: string) => void; voltar: () => void }) {
  const pagaHoje = f.antecipada && f.pagaEm === hoje;
  const jaPaga = f.antecipada && f.pagaEm <= hoje;
  const titulo = !f.antecipada ? `Sai da conta em ${fmt(f.vencimento)}` : jaPaga ? (pagaHoje ? 'Paga hoje' : `Paga em ${fmt(f.pagaEm)}`) : `Agendada pra ${fmt(f.pagaEm)}`;
  const sub = !f.antecipada ? 'no vencimento' : f.pagaEm < f.vencimento ? `${jaPaga ? 'adiantada' : 'antes do vencimento'} (vence ${fmt(f.vencimento)})` : `depois do vencimento (${fmt(f.vencimento)})`;
  const data = (rotulo: string, principal = false) => (
    <label className={`pay-b ${principal ? 'pri' : ''}`}>
      <ICalendar size={18} /><span>{rotulo}</span>
      <input type="date" className="date-overlay" value={f.pagaEm} onChange={(e) => e.target.value && pagarEm(e.target.value)} aria-label={rotulo} />
    </label>
  );
  return (
    <div className={`pay ${jaPaga ? 'paga' : ''}`}>
      <div className="pay-st">
        <span className="pay-i">{jaPaga ? <ICheckCircle size={20} /> : <ICalendar size={20} />}</span>
        <div><b>{titulo}</b><span>{sub}</span></div>
      </div>
      <div className="pay-acts">
        {!jaPaga && <button className="pay-b pri" onClick={pagarHoje}><ICheckCircle size={18} /><span>Paguei hoje</span></button>}
        {data(f.antecipada ? 'Alterar data' : 'Outra data', false)}
        {f.antecipada && <button className="pay-b" onClick={voltar}><IUndo size={18} /><span>Desfazer</span></button>}
      </div>
    </div>
  );
}
