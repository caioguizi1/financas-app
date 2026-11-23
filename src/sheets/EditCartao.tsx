import { useState } from 'react';
import { today } from '../lib/dates';
import { pagamentoCartao } from '../lib/engine';
import { uid } from '../lib/money';
import type { Cartao } from '../lib/types';
import { closeSheet, mutate, toast } from '../store';
import { Button, DayGrid } from '../ui/Controls';
import { AmountDisplay, Keypad } from '../ui/Money';

export function EditCartao({ cartao }: { cartao?: Cartao }) {
  const novo = !cartao;
  const [c, setC] = useState<Omit<Cartao, 'id'> & { id?: string }>(() => cartao ?? { nome: '', fechamento: 3, vencimento: 10 });
  const [fatura, setFatura] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const set = (p: Partial<Cartao>) => setC((x) => ({ ...x, ...p }));

  const salvar = () => {
    const final: Cartao = { ...c, id: c.id ?? uid(), nome: c.nome.trim() || 'Cartão' };
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
    if (!confirm) return setConfirm(true);
    mutate((d) => ({ ...d, cartoes: d.cartoes.filter((x) => x.id !== c.id) }));
    closeSheet();
    toast('Cartão apagado');
  };

  return (
    <>
      <h3>{novo ? 'Novo cartão' : 'Editar cartão'}</h3>
      <input className="field" placeholder="Nome (ex: Nubank)" value={c.nome} onChange={(e) => set({ nome: e.target.value })} style={{ marginTop: 12 }} />
      <div className="lab">Dia do fechamento</div>
      <DayGrid value={c.fechamento} onChange={(fechamento) => set({ fechamento })} />
      <div className="lab">Dia do vencimento</div>
      <DayGrid value={c.vencimento} onChange={(vencimento) => set({ vencimento })} />
      {novo && <>
        <div className="lab">Quanto já tem na fatura aberta? <span className="dim">(opcional)</span></div>
        <AmountDisplay value={fatura} />
        <Keypad value={fatura} onChange={setFatura} />
      </>}
      <div className="actions">
        <Button onClick={salvar}>Salvar</Button>
        {!novo && <Button kind="danger" onClick={apagar}>{confirm ? 'Toque de novo pra apagar' : 'Apagar cartão'}</Button>}
      </div>
    </>
  );
}
