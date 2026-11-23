import { useState } from 'react';
import { today } from '../lib/dates';
import { pagamentoCartao } from '../lib/engine';
import { uid } from '../lib/money';
import type { Cartao } from '../lib/types';
import { closeSheet, mutate, withUndo } from '../store';
import { SheetHeader } from '../ui/Sheet';
import { Button, DayGrid } from '../ui/Controls';
import { AmountDisplay, Keypad } from '../ui/Money';

export function EditCartao({ cartao }: { cartao?: Cartao }) {
  const novo = !cartao;
  type Draft = Omit<Cartao, 'id' | 'fechamento' | 'vencimento'> & { id?: string; fechamento: number | null; vencimento: number | null };
  const [c, setC] = useState<Draft>(() => cartao ?? { nome: '', fechamento: null, vencimento: null });
  const [fatura, setFatura] = useState(0);
  const set = (p: Partial<Draft>) => setC((x) => ({ ...x, ...p }));
  const ok = !!c.fechamento && !!c.vencimento;

  const salvar = () => {
    if (!ok) return;
    const final: Cartao = { ...c, fechamento: c.fechamento!, vencimento: c.vencimento!, id: c.id ?? uid(), nome: c.nome.trim() || 'Cartão' };
    mutate((d) => {
      if (!novo) return { ...d, cartoes: d.cartoes.map((x) => (x.id === final.id ? final : x)) };
      const lancamentos = fatura
        ? [...d.lancamentos, { id: uid(), tipo: 'saida' as const, valor: fatura, cat: 'fatura', desc: `Fatura ${final.nome} (já gasto)`, data: pagamentoCartao(final, today()), criado: Date.now() }]
        : d.lancamentos;
      return { ...d, cartoes: [...d.cartoes, final], lancamentos };
    });
    closeSheet();
  };
  const apagar = () => {
    closeSheet();
    withUndo(`Cartão ${c.nome} apagado`, (d) => ({ ...d, cartoes: d.cartoes.filter((x) => x.id !== c.id) }));
  };

  return (
    <>
      <SheetHeader title={novo ? 'Novo cartão' : 'Editar cartão'} onDelete={novo ? undefined : apagar} />
      <input className="field" placeholder="Nome (ex: Nubank)" value={c.nome} onChange={(e) => set({ nome: e.target.value })} />
      <div className="lab">Dia do fechamento</div>
      <DayGrid value={c.fechamento} onChange={(fechamento) => set({ fechamento })} caption={(d) => `fecha todo dia ${d}`} />
      <div className="lab">Dia do vencimento</div>
      <DayGrid value={c.vencimento} onChange={(vencimento) => set({ vencimento })} caption={(d) => `vence todo dia ${d}`} />
      {novo && <>
        <div className="lab">Quanto já tem na fatura aberta? <span className="dim">(opcional)</span></div>
        <AmountDisplay value={fatura} />
        <Keypad value={fatura} onChange={setFatura} />
      </>}
      <div className="actions">
        <Button disabled={!ok} onClick={salvar}>Salvar</Button>
        {!ok && <div className="need">Escolha o dia do fechamento e do vencimento</div>}
      </div>
    </>
  );
}
