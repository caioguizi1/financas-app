import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { CAT_IN, CAT_OUT } from '../lib/categories';
import { addDays, diaLabel, dm, today } from '../lib/dates';
import { pagamentoCartao } from '../lib/engine';
import { brl, uid } from '../lib/money';
import type { Lancamento } from '../lib/types';
import { closeSheet, getData, mutate, restore, toast, withUndo } from '../store';
import { Button, Chip, Segmented, Stepper } from '../ui/Controls';
import { AmountDisplay, Keypad } from '../ui/Money';
import { spring } from '../ui/motion';

export function QuickAdd({ lanc }: { lanc?: Lancamento }) {
  const novo = !lanc;
  const D = getData();
  const [l, setL] = useState<Lancamento>(() => lanc ?? { id: '', tipo: 'saida', valor: 0, cat: '', data: today(), cartaoId: null, parcelas: 1, desc: '', criado: 0 });
  const set = (p: Partial<Lancamento>) => setL((x) => ({ ...x, ...p }));

  const cats = useMemo(() => {
    const list = l.tipo === 'saida' ? CAT_OUT : CAT_IN;
    return [...list].sort((a, b) => (D.uso[b[0]] ?? 0) - (D.uso[a[0]] ?? 0));
  }, [l.tipo, D.uso]);
  const cat = l.cat && (l.cat === 'fatura' || cats.some((c) => c[0] === l.cat)) ? l.cat : cats[0][0];
  const cartao = l.cartaoId ? D.cartoes.find((c) => c.id === l.cartaoId) : undefined;
  const parcelas = l.parcelas ?? 1;

  const t = today();
  const datas: [string, string][] = [[t, 'Hoje'], [addDays(t, -1), 'Ontem'], [addDays(t, -2), diaLabel(addDays(t, -2))]];
  const outraData = !datas.some(([d]) => d === l.data);

  const salvar = () => {
    if (!l.valor) return;
    const final: Lancamento = { ...l, cat, desc: l.desc.trim(), cartaoId: l.tipo === 'saida' ? l.cartaoId : null, parcelas: cartao ? parcelas : 1 };
    closeSheet();
    if (novo) {
      const before = getData();
      final.id = uid();
      final.criado = Date.now();
      mutate((d) => ({ ...d, lancamentos: [...d.lancamentos, final], uso: { ...d.uso, [cat]: (d.uso[cat] ?? 0) + 1 } }));
      toast(`${final.tipo === 'saida' ? 'Saída' : 'Entrada'} de ${brl(final.valor)} lançada`, () => restore(before));
    } else {
      mutate((d) => ({ ...d, lancamentos: d.lancamentos.map((x) => (x.id === final.id ? final : x)) }));
      toast('Atualizado');
    }
  };
  const apagar = () => {
    closeSheet();
    withUndo('Lançamento apagado', (d) => ({ ...d, lancamentos: d.lancamentos.filter((x) => x.id !== l.id) }));
  };

  return (
    <>
      <Segmented
        value={l.tipo}
        onChange={(tipo) => set({ tipo, cat: '', ...(tipo === 'entrada' ? { cartaoId: null, parcelas: 1 } : {}) })}
        options={[{ v: 'saida', label: 'Saída', tone: 'out' }, { v: 'entrada', label: 'Entrada', tone: 'in' }]}
      />
      <AmountDisplay value={l.valor} compact />

      <div className="chips scroll">
        {cats.map(([k, e, n]) => <Chip key={k} on={cat === k} onClick={() => set({ cat: k })}>{e} {n}</Chip>)}
      </div>

      {l.tipo === 'saida' && D.cartoes.length > 0 && (
        <div className="chips scroll" style={{ marginTop: 10 }}>
          <Chip on={!l.cartaoId} onClick={() => set({ cartaoId: null, parcelas: 1 })}>🏦 Conta/Pix</Chip>
          {D.cartoes.map((c) => <Chip key={c.id} on={l.cartaoId === c.id} onClick={() => set({ cartaoId: c.id })}>💳 {c.nome}</Chip>)}
        </div>
      )}
      <AnimatePresence initial={false}>
        {cartao && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} style={{ overflow: 'hidden' }}>
            <div className="row" style={{ marginTop: 12 }}>
              <span className="mut" style={{ fontSize: 14 }}>Parcelas</span>
              <span className="sp" />
              <Stepper value={parcelas} min={1} max={24} onChange={(p) => set({ parcelas: p })} fmt={(v) => `${v}x`} />
            </div>
            <div className="dim hint">
              Sai da conta em {dm(pagamentoCartao(cartao, l.data))}
              {parcelas > 1 && ` · ${parcelas}x de ${brl(Math.floor(l.valor / parcelas))}`}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="chips scroll" style={{ marginTop: 12 }}>
        {datas.map(([d, n]) => <Chip key={d} on={l.data === d} onClick={() => set({ data: d })}>{n}</Chip>)}
        <label className={`chip ${outraData ? 'on' : ''}`} style={{ position: 'relative' }}>
          📅 {outraData ? dm(l.data) : 'Outra data'}
          <input type="date" value={l.data} onChange={(e) => e.target.value && set({ data: e.target.value })} className="date-overlay" />
        </label>
      </div>
      <input className="field" placeholder="Descrição (opcional)" value={l.desc} onChange={(e) => set({ desc: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), e.preventDefault())} style={{ marginTop: 12 }} enterKeyHint="done" />

      <Keypad small value={l.valor} onChange={(valor) => set({ valor })} />
      <div className="actions tight">
        <Button disabled={!l.valor} onClick={salvar}>{novo ? 'Lançar' : 'Salvar'}</Button>
        {!novo && <Button kind="danger" onClick={apagar}>Apagar lançamento</Button>}
      </div>
    </>
  );
}
