import { useState } from 'react';
import { addDays, dm, today } from '../lib/dates';

import { chaveEvento, eventosEntre, projecao } from '../lib/engine';
import { brl } from '../lib/money';
import { closeSheet, getData, mutate, withUndo } from '../store';
import { Button, Segmented } from '../ui/Controls';
import { AmountDisplay, Keypad } from '../ui/Money';
import { SheetHeader, useRascunho } from '../ui/Sheet';
import { CatGlyph } from '../ui/CatIco';
import { nomeExib } from '../ui/nome';

export function AjustarSaldo() {
  const D0 = getData();
  const hoje = today();
  const atual = projecao(D0, 0).saldoEm(hoje) ?? 0;
  const [v, setV] = useState(Math.abs(atual));
  const [sg, setSg] = useState<1 | -1>(atual < 0 ? -1 : 1);
  useRascunho(v * sg !== atual); // digitou um saldo novo: fechar sem querer pergunta antes
  // o que está previsto pra hoje (salário, aluguel, fatura…): já caiu no banco ou ainda não?
  const doDia = eventosEntre(D0, hoje, hoje).filter((e) => !e.estimativa);
  const [pend, setPend] = useState<Set<string>>(() => new Set(D0.saldo.data === hoje ? D0.saldo.pendentes ?? [] : []));
  const alternar = (k: string) => setPend((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  // v2.54: reembolsos de fixo previstos pros próximos 10 dias (podem cair antes) ou que já deviam ter caído
  // desde o último saldo conferido. Futuro: começa em "ainda não"; atrasado: começa em "já caiu".
  const reembs = eventosEntre(D0, addDays(D0.saldo.data, 1), addDays(hoje, 10)).filter((e) => e.reembolso && e.data !== hoje);
  const [caiu, setCaiu] = useState<Set<string>>(() => new Set(reembs.filter((e) => e.data < hoje).map(chaveEvento)));
  const alternarReemb = (k: string) => setCaiu((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const salvar = () => {
    const valor = v * sg;
    closeSheet();
    // reembolso que já caiu: passa a valer hoje (e está nesse saldo); atrasado que não caiu: previsto pra amanhã
    const datas = new Map<string, Record<string, string>>();
    for (const e of reembs) {
      const k = chaveEvento(e), sim = caiu.has(k);
      const nova = sim && e.data > hoje ? hoje : !sim && e.data < hoje ? addDays(hoje, 1) : null;
      if (!nova) continue;
      datas.set(e.reembolso!.rec, { ...(datas.get(e.reembolso!.rec) ?? {}), [e.reembolso!.mk]: nova });
    }
    withUndo(`Saldo ajustado (${brl(valor - atual, true)})`, (d) => ({
      ...d,
      saldo: { valor, data: hoje, ts: Date.now(), pendentes: pend.size ? [...pend] : undefined },
      recorrentes: datas.size ? d.recorrentes.map((r) => (datas.has(r.id) && r.reembolso ? { ...r, reembolso: { ...r.reembolso, datas: { ...(r.reembolso.datas ?? {}), ...datas.get(r.id)! } } } : r)) : d.recorrentes,
    }));
  };
  return (
    <>
      <SheetHeader title="Saldo real agora" />
      <p className="mut small">O app calcula {brl(atual)}. Informe o que aparece no banco e eu corrijo a diferença, sem precisar lembrar gasto por gasto.</p>
      <AmountDisplay value={v} />
      <Segmented value={sg} onChange={setSg} options={[{ v: 1, label: 'Positivo', tone: 'in' }, { v: -1, label: 'Negativo', tone: 'out' }]} />
      {doDia.length > 0 && (
        <div className="hoje-box">
          <div className="lab" style={{ marginTop: 0 }}>Previsto pra hoje — já está nesse saldo?</div>
          {doDia.map((e) => {
            const k = chaveEvento(e);
            const caiu = !pend.has(k);
            return (
              <button key={k} className={`hoje-it ${caiu ? 'ok' : ''}`} onClick={() => alternar(k)}>
                <span className="t"><CatGlyph cat={e.cat} ico={e.ico} />{nomeExib(e.desc)}</span>
                <span className={`num ${e.valor > 0 ? 'pos' : ''}`}>{brl(e.valor, true)}</span>
                <span className="st">{caiu ? '✓ já caiu' : 'ainda não'}</span>
              </button>
            );
          })}
        </div>
      )}
      {reembs.length > 0 && (
        <div className="hoje-box reemb-box">
          <div className="lab" style={{ marginTop: 0 }}>Reembolso — já caiu na conta?</div>
          {reembs.map((e) => {
            const k = chaveEvento(e);
            const sim = caiu.has(k);
            const atrasado = e.data < hoje;
            return (
              <button key={k} className={`hoje-it ${sim ? 'ok' : ''}`} onClick={() => alternarReemb(k)} aria-pressed={sim}>
                <span className="t"><CatGlyph cat={e.cat} ico={e.ico} />{nomeExib(e.desc)}<small className="reemb-q">{atrasado ? `era pra ${dm(e.data)}` : `previsto até ${dm(e.data)}`}{e.sessoes ? ` · ${e.sessoes} sess${e.sessoes > 1 ? 'ões' : 'ão'}` : ''}</small></span>
                <span className="num pos">{brl(e.valor, true)}</span>
                <span className="st">{sim ? '✓ já caiu' : 'ainda não'}</span>
              </button>
            );
          })}
          <div className="reemb-nota">{caiu.size ? 'O que já caiu passa a valer hoje e não é contado de novo depois.' : 'Toque no que já caiu: ele passa a valer hoje e não é contado de novo na data prevista.'}</div>
        </div>
      )}
      <Keypad value={v} onChange={setV} />
      <div className="actions"><Button onClick={salvar}>Atualizar saldo</Button></div>
    </>
  );
}

export function EditNome() {
  const [nome, setNome] = useState(getData().perfil.nome);
  const salvar = () => { mutate((d) => ({ ...d, perfil: { nome: nome.trim() } })); closeSheet(); };
  return (
    <>
      <SheetHeader title="Seu nome" />
      <input className="field" value={nome} autoFocus onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && salvar()} style={{ margin: '12px 0 4px' }} />
      <div className="actions"><Button onClick={salvar}>Salvar</Button></div>
    </>
  );
}
