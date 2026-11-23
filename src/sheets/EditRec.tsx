import { useMemo, useState } from 'react';
import { CAT_IN, CAT_OUT, catE, catN } from '../lib/categories';
import { aprender, sugerir } from '../lib/smart';
import { SmartDesc, SmartHint } from '../ui/Smart';
import { mesCurto, monthKey, today } from '../lib/dates';
import { brl } from '../lib/money';
import { aplicarAlteracao, encerrar as encerrarRec, serieDe, versoes, type Vigencia } from '../lib/versions';
import { VigenciaPicker } from './Renda';
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

  const mk = monthKey(today());
  const mudouValor = !novo && !!rec && (r.valor !== rec.valor || r.dia !== rec.dia);
  const [vig, setVig] = useState<Vigencia>(mk);
  const historico = !novo && r.id ? versoes(D.recorrentes, serieDe(r as Recorrente)) : [];

  const salvar = () => {
    if (!r.valor || !r.dia) return;
    const final: Recorrente = { ...r, cat, ico: ico !== catE(cat) ? ico : undefined, dia: r.dia, id: r.id ?? uid(), inicio: r.inicio ?? monthKey(today()), desc: r.desc.trim() || catN(cat) };
    const { id: _id, inicio: _ini, fim: _fim, serie: _s, ...mudancas } = final;
    mutate((d) => ({ ...d, recorrentes: novo ? [...d.recorrentes, final] : aplicarAlteracao(d.recorrentes, final.id, mudancas, mudouValor ? vig : 'sempre'), aprendido: r.desc.trim() ? aprender(d.aprendido ?? {}, final.desc, final.tipo, cat, final.ico) : d.aprendido }));
    closeSheet();
    toast(novo ? 'Fixo adicionado' : mudouValor && vig !== 'sempre' ? `Atualizado a partir de ${mesCurto(vig)}` : 'Atualizado');
  };
  const apagar = () => {
    closeSheet();
    const serie = serieDe(r as Recorrente);
    withUndo(`"${r.desc}" apagado`, (d) => ({ ...d, recorrentes: d.recorrentes.filter((x) => serieDe(x) !== serie) }));
  };
  const encerrar = () => {
    closeSheet();
    withUndo(`Encerrado a partir de ${mesCurto(mk)}`, (d) => ({ ...d, recorrentes: encerrarRec(d.recorrentes, r.id!, mk) }));
  };

  return (
    <div className="sl">
      <SheetHeader title={`${novo ? 'Novo' : 'Editar'} ${r.tipo === 'entrada' ? 'recebimento' : 'gasto'} fixo`} onDelete={novo ? undefined : apagar} />
      <div className="sl-mid" data-scroll>
      <SmartDesc value={r.desc} onChange={(desc) => set({ desc })} ico={ico} placeholder={r.tipo === 'saida' ? 'Nome (ex: Internet, Ração, Academia)' : 'Nome (ex: Salário, Freela)'} />
      <SmartHint sug={sug} aplicada={usaSug} atual={cat} />
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
      {mudouValor && <VigenciaPicker vig={vig} setVig={setVig} mk={mk} temHistorico antes={rec!.valor} depois={r.valor} />}
      {historico.length > 1 && (
        <>
          <div className="lab">Histórico</div>
          <div className="hist">
            {historico.map((v) => (
              <div key={v.id} className={`hist-row ${v.id === r.id ? 'on' : ''}`}>
                <span>{mesCurto(v.inicio)} → {v.fim ? mesCurto(v.fim) : 'hoje'}</span><span className="sp" /><b className="num">{brl(v.valor)}</b><span className="dim"> · dia {v.dia}</span>
              </div>
            ))}
          </div>
        </>
      )}
      </div>
      <div className="sl-foot">
        <div className="actions sl-actions">
        <Button disabled={!r.valor || !r.dia} onClick={salvar}>Salvar</Button>
        {(!r.valor || !r.dia) && <div className="need">Falta {[!r.valor && 'o valor', !r.dia && 'o dia'].filter(Boolean).join(' e ')}</div>}
        {!novo && <Button kind="link" onClick={encerrar}>Encerrar a partir deste mês (mantém o histórico)</Button>}
      </div>
      </div>
    </div>
  );
}
