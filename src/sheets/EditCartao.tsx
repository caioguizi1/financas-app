import { useMemo, useState } from 'react';
import { dm, today } from '../lib/dates';
import { ajusteFatura, faturasAtuais } from '../lib/faturas';
import { brl, uid } from '../lib/money';
import type { Cartao, Lancamento } from '../lib/types';
import { closeSheet, getData, mutate, openSheet, withUndo } from '../store';
import { SheetHeader, useRascunho } from '../ui/Sheet';
import { Button, DayGrid } from '../ui/Controls';
import { ValueRows } from '../ui/ValueRows';
import { FaturasSheet } from './Faturas';

const fmt = (iso: string) => `${dm(iso)}/${iso.slice(2, 4)}`;

export function EditCartao({ cartao }: { cartao?: Cartao }) {
  const novo = !cartao;
  type Draft = Omit<Cartao, 'id' | 'fechamento' | 'vencimento'> & { id?: string; fechamento: number | null; vencimento: number | null };
  const [c, setC] = useState<Draft>(() => cartao ?? { nome: '', fechamento: null, vencimento: null });
  const [estimativa, setEstimativa] = useState(cartao?.estimativa ?? 0);
  const set = (p: Partial<Draft>) => setC((x) => ({ ...x, ...p }));
  const ok = !!c.fechamento && !!c.vencimento;
  const [id] = useState(() => cartao?.id ?? uid());

  // valor ATUAL de cada fatura que ainda vai sair (fechada a vencer + aberta) — no cadastro e na edição
  const fats = useMemo(() => {
    if (!ok) return [];
    const cc: Cartao = { id, nome: c.nome || 'Cartão', fechamento: c.fechamento!, vencimento: c.vencimento! };
    const D = getData();
    return faturasAtuais({ ...D, cartoes: [...D.cartoes.filter((x) => x.id !== id), cc] }, cc, today());
  }, [ok, id, c.nome, c.fechamento, c.vencimento]);
  const [valores, setValores] = useState<Record<string, number>>({});
  const valorDe = (f: (typeof fats)[number]) => valores[f.vencimento] ?? f.total;
  const [ativa, setAtiva] = useState(0);
  // mexeu em algo e não salvou? fechar sem querer pergunta antes
  const [c0] = useState(() => JSON.stringify(c));
  const sujo = JSON.stringify(c) !== c0 || estimativa !== (cartao?.estimativa ?? 0) || Object.keys(valores).length > 0;
  useRascunho(sujo);

  const salvar = () => {
    if (!ok) return;
    const final: Cartao = { ...c, fechamento: c.fechamento!, vencimento: c.vencimento!, id, nome: c.nome.trim() || 'Cartão', estimativa: estimativa || undefined };
    const ajustes = fats.map((f) => ajusteFatura({ ...f, cartao: final }, valorDe(f))).filter(Boolean) as Lancamento[];
    mutate((d) => ({
      ...d,
      cartoes: novo ? [...d.cartoes, final] : d.cartoes.map((x) => (x.id === final.id ? final : x)),
      lancamentos: [...d.lancamentos, ...ajustes],
    }));
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
        <div className="lab">Dia do fechamento</div>
        <DayGrid value={c.fechamento} onChange={(fechamento) => set({ fechamento })} caption={(d) => `fecha todo dia ${d} (compras a partir dele vão pra próxima)`} />
        <div className="lab">Dia do vencimento</div>
        <DayGrid value={c.vencimento} onChange={(vencimento) => set({ vencimento })} caption={(d) => `vence todo dia ${d}`} />
        <div className="lab-big">Fatura atual</div>
        {!ok ? (
          <div className="pay-info" style={{ height: 'auto', padding: '12px 14px' }}>Escolha os dias de fechamento e vencimento acima pra informar o valor da fatura.</div>
        ) : (
          <>
            <div className="dim hint" style={{ marginTop: -2, marginBottom: 8 }}>
              {fats.length > 1 ? 'Hoje existem duas: a que já fechou e ainda vai vencer, e a aberta. ' : ''}Digite o valor que aparece no app do banco{novo ? '' : ' (já vem com o que o app somou)'}.
            </div>
            <ValueRows
              linhas={[
                ...fats.map((f) => ({ id: f.vencimento, label: `${f.status === 'fechada' ? 'Fechada' : 'Aberta'} · vence ${fmt(f.vencimento)}`, valor: valorDe(f),
                  nota: !novo && valorDe(f) !== f.total ? `ajuste de ${brl(valorDe(f) - f.total, true)}` : f.status === 'fechada' ? 'já fechou, ainda não venceu' : `recebendo compras até o dia ${c.fechamento! - 1 || c.fechamento}` })),
                { id: 'est', label: 'Gasto típico por fatura', valor: estimativa, nota: 'Opcional: média que completa as próximas faturas' },
              ]}
              ativa={Math.min(ativa, fats.length)} onAtiva={setAtiva}
              onValor={(i, v) => (i < fats.length ? setValores((x) => ({ ...x, [fats[i].vencimento]: v })) : setEstimativa(v))}
            />
          </>
        )}
        {!novo && (
          <Button kind="ghost" style={{ marginTop: 12 }} disabled={sujo && !ok} onClick={() => { if (sujo) salvar(); openSheet(<FaturasSheet cartaoId={cartao!.id} />); }}>{sujo ? 'Salvar e ver as compras de cada fatura' : 'Ver compras de cada fatura e data de pagamento'}</Button>
        )}
      </div>
      <div className="sl-foot">
        <Button disabled={!ok} onClick={salvar}>Salvar</Button>
        {!ok && <div className="need">Escolha o dia do fechamento e do vencimento</div>}
      </div>
    </div>
  );
}
