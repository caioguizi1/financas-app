/**
 * Uma fatura que já venceu, inteira: todas as compras, parcelas, puladas (FIN) e créditos.
 * Abre pelo histórico de faturas do cartão (importadas ou lançadas à mão).
 */
import { useState } from 'react';
import { dm, mesCurto, monthKey, today } from '../lib/dates';
import { fatura } from '../lib/faturas';
import { doCartao } from '../lib/importacoes';
import { brl } from '../lib/money';
import { openSheet, useData } from '../store';
import { CatGlyph } from '../ui/CatIco';
import { Chip } from '../ui/Controls';
import { CartaoMini } from '../ui/Ico';
import { nomeExib } from '../ui/nome';
import { SheetHeader } from '../ui/Sheet';
import { QuickAdd } from './QuickAdd';

const fmt = (iso: string) => `${dm(iso)}/${iso.slice(2, 4)}`;
type Filtro = 'todas' | 'puladas' | 'parcelas' | 'creditos';

export function FaturaPassadaSheet({ cartaoId, venc, voltar }: { cartaoId: string; venc: string; voltar?: () => void }) {
  const D = useData();
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const c = D.cartoes.find((x) => x.id === cartaoId);
  if (!c) return null;
  const f = fatura(D, c, venc, 'fechada');
  const reg = doCartao(D, c.id).find((x) => x.venc === venc);
  const lanc = new Map(D.lancamentos.map((l) => [l.id, l]));
  // data da compra (a parcela i mostra a data original da compra, como o banco)
  const linhas = f.itens.map((e) => ({ e, l: lanc.get(e.ref) })).sort((a, b) => (a.l?.data ?? a.e.data).localeCompare(b.l?.data ?? b.e.data) || a.e.valor - b.e.valor);
  const compras = -f.itens.filter((e) => e.valor < 0).reduce((s, e) => s + e.valor, 0);
  const creditos = f.itens.filter((e) => e.valor > 0).reduce((s, e) => s + e.valor, 0);
  const conta = {
    todas: linhas.length,
    puladas: linhas.filter((x) => x.e.adiado).length,
    parcelas: linhas.filter((x) => (x.l?.parcelas ?? 1) > 1).length,
    creditos: linhas.filter((x) => x.e.valor > 0).length,
  };
  const vis = linhas.filter(({ e, l }) => filtro === 'todas' || (filtro === 'puladas' ? e.adiado : filtro === 'parcelas' ? (l?.parcelas ?? 1) > 1 : e.valor > 0));
  const hoje = today();

  return (
    <div className="sl">
      <SheetHeader title={`Fatura de ${mesCurto(monthKey(venc))}`} voltar={voltar ? { label: 'Faturas', onClick: voltar } : undefined} />
      <div className="sl-mid" data-scroll>
        <div className="fp-head">
          <CartaoMini c={c} />
          <div className="fp-meta">
            <div className="mut small">{c.nome} · fechou {fmt(f.fecha)} · {venc < hoje ? 'venceu' : 'vence'} {fmt(venc)}</div>
            <div className="fp-total num">{brl(f.total)}</div>
            {creditos > 0 && <div className="dim small">Compras {brl(compras)} · créditos −{brl(creditos)}</div>}
            {reg && <div className="dim small">{reg.conferida ? 'Importada e conferida com o banco' : 'Importada'}{reg.inferida ? '' : ` em ${dm(new Date(reg.quando).toISOString().slice(0, 10))}`}</div>}
          </div>
        </div>
        <div className="chips scroll" style={{ margin: '14px 0 10px' }}>
          <Chip on={filtro === 'todas'} onClick={() => setFiltro('todas')}>Todas · {conta.todas}</Chip>
          {conta.puladas > 0 && <Chip on={filtro === 'puladas'} onClick={() => setFiltro('puladas')}>Puladas · {conta.puladas}</Chip>}
          {conta.parcelas > 0 && <Chip on={filtro === 'parcelas'} onClick={() => setFiltro('parcelas')}>Parcelas · {conta.parcelas}</Chip>}
          {conta.creditos > 0 && <Chip on={filtro === 'creditos'} onClick={() => setFiltro('creditos')}>Créditos · {conta.creditos}</Chip>}
        </div>
        <div className="fat-box">
          <div className="fat-itens">
            {vis.map(({ e, l }, k) => (
              <button key={k} className="fat-it" onClick={() => l && openSheet(<QuickAdd lanc={l} />)} disabled={!l}>
                <span><CatGlyph cat={e.cat} ico={e.ico} /></span>
                <span className="m">
                  <span className="m-n">{nomeExib(e.desc)}{e.fixo ? ' · fixo' : ''}</span>
                  <span className="fp-sub">{l ? fmt(l.data) : fmt(e.data)}{e.adiado && <span className="tag" title="Compra pulada (Pula Compra): paga nesta fatura">PULADA</span>}</span>
                </span>
                <span className={`num ${e.valor > 0 ? 'pos' : ''}`}>{brl(e.valor, e.valor > 0)}</span>
              </button>
            ))}
          </div>
          <div className="fat-tot"><span className="mut">Total da fatura</span><b className="num">{brl(f.total)}</b></div>
        </div>
      </div>
    </div>
  );
}
