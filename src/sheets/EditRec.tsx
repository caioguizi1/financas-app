import { useMemo, useState } from 'react';
import { CAT_IN, CAT_OUT, catE, catN } from '../lib/categories';
import { aprender, normalizar, sugerir } from '../lib/smart';
import { SmartDesc, SmartHint } from '../ui/Smart';
import { mesCurto, monthKey, today } from '../lib/dates';
import { brl } from '../lib/money';
import { aplicarAlteracao, encerrar as encerrarRec, serieDe, versoes, type Vigencia } from '../lib/versions';
import { VigenciaPicker } from './Renda';
import { uid } from '../lib/money';
import type { Recorrente, Tipo } from '../lib/types';
import { closeSheet, getData, mutate, toast, withUndo } from '../store';
import { SheetHeader } from '../ui/Sheet';
import { Button, Chip, DayGrid, Segmented } from '../ui/Controls';
import { DIAS_SEMANA_CURTO, MES_CURTO, freqDe, quando, type Freq } from '../lib/recorrencia';
import { Aviso } from '../ui/Aviso';
import { AmountDisplay, Keypad, TecladoRecolhivel, useTeclado } from '../ui/Money';
import { CatGlyph } from '../ui/CatIco';
import { CartaoMini, Ico } from '../ui/Ico';

type Draft = Omit<Recorrente, 'id' | 'inicio' | 'dia'> & Partial<Pick<Recorrente, 'id' | 'inicio'>> & { dia: number | null };

export function EditRec({ rec, tipo = 'saida' }: { rec?: Draft; tipo?: Tipo }) {
  const novo = !rec?.id;
  const [r, setR] = useState<Draft>(() => rec ?? { tipo, desc: '', cat: tipo === 'entrada' ? 'salario' : 'contas', valor: 0, dia: null });
  const set = (p: Partial<Draft>) => setR((x) => ({ ...x, ...p }));
  const cats = r.tipo === 'entrada' ? CAT_IN : CAT_OUT;
  const D = getData();
  const cartoes = D.cartoes;
  // existente ou sugestão do cadastro (com ícone) = já escolhido; senão o dicionário decide até a pessoa tocar numa categoria
  const tec = useTeclado(false); // teclado só aparece ao tocar no valor (novo e edição)
  // editando: a categoria salva vale até você trocar o nome; aí a sugestão do nome novo entra
  const [manual, setManual] = useState(novo && !!rec?.ico);
  const sug = useMemo(() => sugerir(r.desc, r.tipo, D.aprendido), [r.desc, r.tipo, D.aprendido]);
  const descInicial = useMemo(() => normalizar(rec?.desc ?? ''), []); // eslint-disable-line react-hooks/exhaustive-deps
  const usaSug = !manual && !!sug && (novo || normalizar(r.desc) !== descInicial);
  const cat = usaSug ? sug!.cat : r.cat;
  const ico = usaSug ? sug!.ico || catE(cat) : r.ico || catE(cat);

  const mk = monthKey(today());
  const freq = freqDe(r);
  const mudouValor = !novo && !!rec && (r.valor !== rec.valor || r.dia !== rec.dia || freq !== freqDe(rec) || r.semana !== rec.semana || r.mes !== rec.mes);
  // o que falta pra salvar, conforme a frequência
  const faltaQuando = freq === 'semanal' ? r.semana == null : freq === 'anual' ? !r.dia || !r.mes : !r.dia;
  const falta = [!r.valor && 'o valor', faltaQuando && (freq === 'semanal' ? 'o dia da semana' : freq === 'anual' ? 'o dia e o mês' : 'o dia')].filter(Boolean).join(' e ');
  const mudarFreq = (f: Freq) => {
    const hoje = new Date();
    set({ freq: f === 'mensal' ? undefined : f,
      ...(f === 'semanal' && r.semana == null ? { semana: hoje.getDay() } : {}),
      ...(f === 'anual' && !r.mes ? { mes: hoje.getMonth() + 1 } : {}) });
  };
  // já existe um fixo com esse nome? (evita contar duas vezes)
  const dup = novo && r.desc.trim() ? D.recorrentes.find((x) => x.tipo === r.tipo && normalizar(x.desc) === normalizar(r.desc) && (!x.fim || x.fim >= mk)) : undefined;
  const [vig, setVig] = useState<Vigencia>(mk);
  const historico = !novo && r.id ? versoes(D.recorrentes, serieDe(r as Recorrente)) : [];

  const salvar = () => {
    if (falta) return;
    const { semana, mes, freq: _f, ...base } = r;
    const final: Recorrente = { ...base, ...(freq !== 'mensal' ? { freq } : {}), ...(freq === 'semanal' ? { semana } : {}), ...(freq === 'anual' ? { mes } : {}), cat, ico: ico !== catE(cat) ? ico : undefined, dia: freq === 'semanal' ? r.dia ?? 1 : r.dia!, id: r.id ?? uid(), inicio: r.inicio ?? monthKey(today()), desc: r.desc.trim() || catN(cat), ...(novo ? { criado: Date.now() } : {}) };
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
      <SmartDesc value={r.desc} onChange={(desc) => set({ desc })} ico={ico} cat={cat} placeholder={r.tipo === 'saida' ? 'Nome (ex: Internet, Ração, Academia)' : 'Nome (ex: Salário, Freela)'} />
      <SmartHint sug={sug} aplicada={usaSug} atual={cat} onUsar={() => { setManual(true); set({ cat: sug!.cat, ico: sug!.ico }); }} />
      <AmountDisplay value={r.valor} onClick={tec.abrir} ativo={tec.aberto} />
      <TecladoRecolhivel aberto={tec.aberto} onOk={tec.fechar}><Keypad recomecar={!novo} value={r.valor} onChange={(valor) => set({ valor })} /></TecladoRecolhivel>
      <div className="lab">Repete</div>
      <Segmented<Freq> value={freq} onChange={mudarFreq} options={[{ v: 'mensal', label: 'Todo mês' }, { v: 'semanal', label: 'Toda semana' }, { v: 'anual', label: 'Todo ano' }]} />
      {freq === 'semanal' && (
        <>
          <div className="lab">Dia da semana</div>
          <div className="chips sem">{[1, 2, 3, 4, 5, 6, 0].map((d) => <Chip key={d} on={r.semana === d} onClick={() => set({ semana: d })}>{DIAS_SEMANA_CURTO[d]}</Chip>)}</div>
        </>
      )}
      {freq === 'anual' && (
        <>
          <div className="lab">Mês</div>
          <div className="chips meses">{MES_CURTO.map((n, i) => <Chip key={n} on={r.mes === i + 1} onClick={() => set({ mes: i + 1 })}>{n}</Chip>)}</div>
        </>
      )}
      {freq !== 'semanal' && (
        <>
          <div className="lab">{freq === 'anual' ? 'Dia' : 'Todo dia'}</div>
          <DayGrid value={r.dia} onChange={(dia) => set({ dia })} caption={freq === 'anual' ? (d) => quando({ freq: 'anual', dia: d, mes: r.mes }) : undefined} />
        </>
      )}
      <div className="lab">Categoria</div>
      <div className="chips scroll">
        {cats.map(([k, e, n]) => <Chip key={k} on={cat === k} onClick={() => { setManual(true); set({ cat: k, ico: undefined }); }}><CatGlyph cat={k} ico={e} />{n}</Chip>)}
      </div>
      {r.tipo === 'saida' && (
        <>
          <div className="lab">Como é pago</div>
          <div className="chips scroll">
            <Chip on={!r.cartaoId && (r.meio ?? 'pix') === 'pix'} onClick={() => set({ cartaoId: null, meio: 'pix' })}><Ico n="pix" size={16} />Pix / débito</Chip>
            {cartoes.map((c) => <Chip key={c.id} on={r.cartaoId === c.id} onClick={() => set({ cartaoId: c.id, meio: 'credito' })}><CartaoMini c={c} />{c.nome}</Chip>)}
            <Chip on={!r.cartaoId && r.meio === 'boleto'} onClick={() => set({ cartaoId: null, meio: 'boleto' })}><Ico n="boleto" size={16} />Boleto</Chip>
          </div>
          <div className="dim hint">{r.cartaoId ? 'Entra na fatura do cartão e sai no vencimento dela.' : r.meio === 'boleto' ? 'Sai da conta no dia do boleto.' : 'Sai direto da conta no dia escolhido.'}</div>
        </>
      )}
      {mudouValor && <VigenciaPicker vig={vig} setVig={setVig} mk={mk} temHistorico antes={rec!.valor} depois={r.valor} />}
      {historico.length > 1 && (
        <>
          <div className="lab">Histórico</div>
          <div className="hist">
            {historico.map((v) => (
              <div key={v.id} className={`hist-row ${v.id === r.id ? 'on' : ''}`}>
                <span>{mesCurto(v.inicio)} → {v.fim ? mesCurto(v.fim) : 'hoje'}</span><span className="sp" /><b className="num">{brl(v.valor)}</b><span className="dim"> · {quando(v).replace('Todo dia', 'dia').replace('Todo ano, ', '').toLowerCase()}</span>
              </div>
            ))}
          </div>
        </>
      )}
      </div>
      <div className="sl-foot">
        <div className="actions sl-actions">
        {dup && !falta && <Aviso nivel="atencao">Você já tem <b>{dup.desc}</b> em Fixos ({brl(dup.valor)}, {quando(dup).toLowerCase()}). Se for o mesmo, edite ele em vez de criar outro, pra não contar duas vezes.</Aviso>}
        <Button disabled={!!falta} onClick={salvar}>{dup ? 'Salvar outro mesmo assim' : 'Salvar'}</Button>
        {falta && <div className="need">Falta {falta}</div>}
        {!novo && <Button kind="link" onClick={encerrar}>Encerrar a partir deste mês (mantém o histórico)</Button>}
      </div>
      </div>
    </div>
  );
}
