import { useState } from 'react';
import { today } from '../lib/dates';
import { projecao } from '../lib/engine';
import { brl } from '../lib/money';
import { closeSheet, getData, mutate, withUndo } from '../store';
import { Button, Segmented } from '../ui/Controls';
import { AmountDisplay, Keypad } from '../ui/Money';
import { SheetHeader } from '../ui/Sheet';

export function AjustarSaldo() {
  const atual = projecao(getData(), 0).saldoEm(today()) ?? 0;
  const [v, setV] = useState(Math.abs(atual));
  const [sg, setSg] = useState<1 | -1>(atual < 0 ? -1 : 1);
  const salvar = () => {
    const valor = v * sg;
    closeSheet();
    withUndo(`Saldo ajustado (${brl(valor - atual, true)})`, (d) => ({ ...d, saldo: { valor, data: today(), ts: Date.now() } }));
  };
  return (
    <>
      <SheetHeader title="Saldo real agora" />
      <p className="mut small">O app calcula {brl(atual)}. Informe o que aparece no banco e eu corrijo a diferença, sem precisar lembrar gasto por gasto.</p>
      <AmountDisplay value={v} />
      <Segmented value={sg} onChange={setSg} options={[{ v: 1, label: 'Positivo', tone: 'in' }, { v: -1, label: 'Negativo', tone: 'out' }]} />
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
