import { useMemo, useState } from 'react';
import { CAT_IN, CAT_OUT, catE, catN } from '../lib/categories';
import { aprender, sugerir } from '../lib/smart';
import { SmartDesc, SmartHint } from '../ui/Smart';
import { dateOf, monthKey, today } from '../lib/dates';
import { uid } from '../lib/money';
import type { Recorrente, Tipo } from '../lib/types';
import { closeSheet, getData, mutate, toast, withUndo } from '../store';
import { SheetHeader } from '../ui/Sheet';
import { Button, Chip, DayGrid } from '../ui/Controls';
import { AmountDisplay, Keypad } from '../ui/Money';

type Draft = Omit<Recorrente, 'id' | 'inicio' | 'dia'> & Partial<Pick<Recorrente, 'id' | 'inicio'>> & { dia: number | null };

export function EditRec({ rec, tipo = 'saida' }: { rec?: Draft; tipo?: Tipo }) {
  const novo = !rec?.id;
  const [r, setR] = useState<Draft>(() => rec ?? { tipo, desc: '', cat: tipo === 'entrada' ? 'salario' : 'contas', valor: 0, dia: null });
  const set = (p: Partial<Draft>) => setR((x) => ({ ...x, ...p }));
  const cats = r.tipo === 'entrada' ? CAT_IN : CAT_OUT;
  const D = getData();
  const cartoes = D.cartoes;
  // existente ou sugestão do cadastro (com ícone) = já escolhido; senão o dicionário decide até a pessoa tocar numa categoria
  const [manual, setManual] = useState(!novo || !!rec?.ico);
  const sug = useMemo(() => sugerir(r.desc, r.tipo, D.aprendido), [r.desc, r.tipo, D.aprendido]);
  const usaSug = !manual && !!sug;
  const cat = usaSug ? sug!.cat : r.cat;
  const ico = usaSug ? sug!.ico || catE(cat) : r.ico || catE(cat);

  const salvar = () => {
    if (!r.valor || !r.dia) return;
    const final: Recorrente = { ...r, cat, ico: ico !== catE(cat) ? ico : undefined, dia: r.dia, id: r.id ?? uid(), inicio: r.inicio ?? monthKey(today()), desc: r.desc.trim() || catN(cat) };
    mutate((d) => ({ ...d, recorrentes: novo ? [...d.recorrentes, final] : d.recorrentes.map((x) => (x.id === final.id ? final : x)), aprendido: r.desc.trim() ? aprender(d.aprendido ?? {}, final.desc, final.tipo, cat, final.ico) : d.aprendido }));
    closeSheet();
    toast(novo ? 'Fixo adicionado' : 'Atualizado');
  };
  const apagar = () => {
    closeSheet();
    withUndo(`"${r.desc}" apagado`, (d) => ({ ...d, recorrentes: d.recorrentes.filter((x) => x.id !== r.id) }));
  };
  const encerrar = () => {
    const n = new Date();
    const fim = monthKey(dateOf(n.getFullYear(), n.getMonth() - 1, 1));
    closeSheet();
    withUndo('Encerrado a partir deste mês', (d) => ({
      ...d,
      recorrentes: d.recorrentes
        .map((x) => (x.id === r.id ? { ...x, fim } : x))
        .filter((x) => !(x.id === r.id && x.fim! < x.inicio)),
    }));
  };

  return (
    <>
      <SheetHeader title={`${novo ? 'Novo' : 'Editar'} ${r.tipo === 'entrada' ? 'recebimento' : 'gasto'} fixo`} onDelete={novo ? undefined : apagar} />
      <SmartDesc value={r.desc} onChange={(desc) => set({ desc })} ico={ico} placeholder={r.tipo === 'saida' ? 'Nome (ex: Internet, Ração, Academia)' : 'Nome (ex: Salário, Freela)'} />
      <SmartHint sug={sug} aplicada={usaSug} />
      <AmountDisplay value={r.valor} />
      <Keypad value={r.valor} onChange={(valor) => set({ valor })} />
      <div className="lab">Todo dia</div>
      <DayGrid value={r.dia} onChange={(dia) => set({ dia })} />
      <div className="lab">Categoria</div>
      <div className="chips scroll">
        {cats.map(([k, e, n]) => <Chip key={k} on={cat === k} onClick={() => { setManual(true); set({ cat: k, ico: undefined }); }}>{e} {n}</Chip>)}
      </div>
      {r.tipo === 'saida' && cartoes.length > 0 && (
        <>
          <div className="lab">Pago com</div>
          <div className="chips scroll">
            <Chip on={!r.cartaoId} onClick={() => set({ cartaoId: null })}>🏦 Conta</Chip>
            {cartoes.map((c) => <Chip key={c.id} on={r.cartaoId === c.id} onClick={() => set({ cartaoId: c.id })}>💳 {c.nome}</Chip>)}
          </div>
        </>
      )}
      <div className="actions">
        <Button disabled={!r.valor || !r.dia} onClick={salvar}>Salvar</Button>
        {(!r.valor || !r.dia) && <div className="need">Falta {[!r.valor && 'o valor', !r.dia && 'o dia'].filter(Boolean).join(' e ')}</div>}
        {!novo && <Button kind="link" onClick={encerrar}>Encerrar a partir deste mês (mantém o histórico)</Button>}
      </div>
    </>
  );
}
