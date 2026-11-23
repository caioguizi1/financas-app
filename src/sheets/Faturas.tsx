import { useState } from 'react';
import { catE } from '../lib/categories';
import { dm, today } from '../lib/dates';
import { ajusteFatura, faturasAtuais, pagarFatura } from '../lib/faturas';
import { brl } from '../lib/money';
import type { Lancamento } from '../lib/types';
import { closeSheet, openSheet, useData, withUndo } from '../store';
import { Button, Chip } from '../ui/Controls';
import { SheetHeader } from '../ui/Sheet';
import { ValueRows } from '../ui/ValueRows';
import { QuickAdd } from './QuickAdd';

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
            {D.cartoes.map((x) => <Chip key={x.id} on={x.id === sel} onClick={() => { setSel(x.id); setAtiva(0); }}>💳 {x.nome}</Chip>)}
          </div>
        )}
        <p className="mut small" style={{ marginBottom: 12 }}>
          Fecha dia {c.fechamento}, vence dia {c.vencimento}. Confira com o app do banco: se o valor for diferente, digite o real e eu ajusto a diferença.
        </p>
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
                      <span>{e.ico || catE(e.cat)}</span><span className="m">{e.desc}{e.fixo ? ' · fixo' : ''}</span><span className="num">{brl(e.valor)}</span>
                    </button>
                  );
                })}
              </div>
            ) : <div className="dim small" style={{ padding: '6px 0' }}>Nada lançado nesta fatura ainda.</div>}
            <div className="fat-tot"><span className="mut">Somado no app</span><b className="num">{brl(f.total)}</b></div>
            {c.estimativa && f.status === 'aberta' && c.estimativa > f.total && (
              <div className="fat-tot"><span className="mut">📊 Previsto com gasto típico</span><span className="num">{brl(c.estimativa)}</span></div>
            )}
            <div className="fat-pag">
              <span className="mut small">{f.antecipada ? <>Sai da conta em <b>{fmt(f.pagaEm)}</b> {f.pagaEm < f.vencimento ? '(adiantada)' : '(agendada)'}</> : <>Sai da conta no vencimento, <b>{fmt(f.vencimento)}</b></>}</span>
              <div className="chips" style={{ marginTop: 8 }}>
                {f.pagaEm !== hoje && <Chip onClick={() => withUndo(`Fatura ${c.nome} paga hoje`, (d) => pagarFatura(d, c, f.vencimento, hoje))}>✅ Paguei hoje</Chip>}
                <label className="chip" style={{ position: 'relative' }}>
                  📅 {f.antecipada ? 'Mudar data' : 'Pagar em outra data'}
                  <input type="date" className="date-overlay" value={f.pagaEm}
                    onChange={(e) => e.target.value && withUndo(`Fatura ${c.nome}: pagamento em ${fmt(e.target.value)}`, (d) => pagarFatura(d, c, f.vencimento, e.target.value))} />
                </label>
                {f.antecipada && <Chip onClick={() => withUndo('Voltou pro vencimento', (d) => pagarFatura(d, c, f.vencimento, null))}>↩︎ Voltar pro vencimento</Chip>}
              </div>
            </div>
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
        <Button disabled={!mudou} onClick={salvar}>{mudou ? 'Ajustar faturas' : 'Faturas conferidas'}</Button>
      </div>
    </div>
  );
}
