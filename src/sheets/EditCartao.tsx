import { useMemo, useState } from 'react';
import { dm, today } from '../lib/dates';
import { ajusteFatura, faturasAtuais } from '../lib/faturas';
import { uid } from '../lib/money';
import type { Cartao, Lancamento } from '../lib/types';
import { closeSheet, getData, mutate, openSheet, withUndo } from '../store';
import { SheetHeader } from '../ui/Sheet';
import { Button, DayGrid } from '../ui/Controls';
import { ValueRows } from '../ui/ValueRows';
import { FaturasSheet } from './Faturas';

const fmt = (iso: string) => `${dm(iso)}/${iso.slice(2, 4)}`;

export function EditCartao({ cartao }: { cartao?: Cartao }) {
  const novo = !cartao;
  type Draft = Omit<Cartao, 'id' | 'fechamento' | 'vencimento'> & { id?: string; fechamento: number | null; vencimento: number | null };
  const [c, setC] = useState<Draft>(() => cartao ?? { nome: '', fechamento: null, vencimento: null });
  const set = (p: Partial<Draft>) => setC((x) => ({ ...x, ...p }));
  const ok = !!c.fechamento && !!c.vencimento;
  const [id] = useState(() => cartao?.id ?? uid());

  // cartão novo: pergunta o valor de CADA fatura que ainda vai sair (fechada a vencer + aberta)
  const fats = useMemo(() => {
    if (!novo || !ok) return [];
    const cc: Cartao = { id, nome: c.nome || 'Cartão', fechamento: c.fechamento!, vencimento: c.vencimento! };
    return faturasAtuais({ ...getData(), cartoes: [cc] }, cc, today());
  }, [novo, ok, id, c.nome, c.fechamento, c.vencimento]);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [ativa, setAtiva] = useState(0);

  const salvar = () => {
    if (!ok) return;
    const final: Cartao = { ...c, fechamento: c.fechamento!, vencimento: c.vencimento!, id, nome: c.nome.trim() || 'Cartão' };
    const ajustes = fats.map((f) => ajusteFatura({ ...f, cartao: final }, valores[f.vencimento] ?? 0)).filter(Boolean) as Lancamento[];
    mutate((d) => (novo
      ? { ...d, cartoes: [...d.cartoes, final], lancamentos: [...d.lancamentos, ...ajustes] }
      : { ...d, cartoes: d.cartoes.map((x) => (x.id === final.id ? final : x)) }));
    closeSheet();
  };
  const apagar = () => {
    closeSheet();
    withUndo(`Cartão ${c.nome} apagado`, (d) => ({ ...d, cartoes: d.cartoes.filter((x) => x.id !== c.id) }));
  };

  return (
    <div className="sl">
      <SheetHeader title={novo ? 'Novo cartão' : 'Editar cartão'} onDelete={novo ? undefined : apagar} />
      <div className="sl-mid" data-scroll>
        <input className="field" placeholder="Nome (ex: Nubank)" value={c.nome} onChange={(e) => set({ nome: e.target.value })} />
        {!novo && (
          <Button kind="ghost" style={{ marginTop: 10 }} onClick={() => openSheet(<FaturasSheet cartaoId={cartao!.id} />)}>💳 Ver e conferir faturas</Button>
        )}
        <div className="lab">Dia do fechamento</div>
        <DayGrid value={c.fechamento} onChange={(fechamento) => set({ fechamento })} caption={(d) => `fecha todo dia ${d} (compras a partir dele vão pra próxima)`} />
        <div className="lab">Dia do vencimento</div>
        <DayGrid value={c.vencimento} onChange={(vencimento) => set({ vencimento })} caption={(d) => `vence todo dia ${d}`} />
        {novo && fats.length > 0 && (
          <>
            <div className="lab">Quanto já tem {fats.length > 1 ? 'em cada fatura' : 'na fatura'}? <span className="dim">(veja no app do banco)</span></div>
            {fats.length > 1 && <div className="dim hint" style={{ marginTop: -4, marginBottom: 8 }}>Hoje existem duas: a que já fechou e ainda vai vencer, e a aberta.</div>}
            <ValueRows
              linhas={fats.map((f) => ({ id: f.vencimento, label: `${f.status === 'fechada' ? 'Fechada' : 'Aberta'} · vence ${fmt(f.vencimento)}`, valor: valores[f.vencimento] ?? 0 }))}
              ativa={Math.min(ativa, fats.length - 1)} onAtiva={setAtiva}
              onValor={(i, v) => setValores((x) => ({ ...x, [fats[i].vencimento]: v }))}
            />
          </>
        )}
      </div>
      <div className="sl-foot">
        <Button disabled={!ok} onClick={salvar}>Salvar</Button>
        {!ok && <div className="need">Escolha o dia do fechamento e do vencimento</div>}
      </div>
    </div>
  );
}
