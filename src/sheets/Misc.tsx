import { useState } from 'react';
import { today } from '../lib/dates';

import { chaveEvento, eventosEntre, projecao } from '../lib/engine';
import { brl } from '../lib/money';
import { closeSheet, getData, mutate, withUndo } from '../store';
import { Button, Segmented } from '../ui/Controls';
import { AmountDisplay, Keypad } from '../ui/Money';
import { SheetHeader } from '../ui/Sheet';
import { CatGlyph } from '../ui/CatIco';
import { nomeExib } from '../ui/nome';

export function AjustarSaldo() {
  const D0 = getData();
  const hoje = today();
  const atual = projecao(D0, 0).saldoEm(hoje) ?? 0;
  const [v, setV] = useState(Math.abs(atual));
  const [sg, setSg] = useState<1 | -1>(atual < 0 ? -1 : 1);
  // o que está previsto pra hoje (salário, aluguel, fatura…): já caiu no banco ou ainda não?
  const doDia = eventosEntre(D0, hoje, hoje).filter((e) => !e.estimativa);
  const [pend, setPend] = useState<Set<string>>(() => new Set(D0.saldo.data === hoje ? D0.saldo.pendentes ?? [] : []));
  const alternar = (k: string) => setPend((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const salvar = () => {
    const valor = v * sg;
    closeSheet();
    withUndo(`Saldo ajustado (${brl(valor - atual, true)})`, (d) => ({ ...d, saldo: { valor, data: hoje, ts: Date.now(), pendentes: pend.size ? [...pend] : undefined } }));
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
