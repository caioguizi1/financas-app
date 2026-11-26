/**
 * Barra compacta de ordenar + filtrar por categoria (listas de fatura e de parcelas).
 * Usa <select> nativo: no iPhone abre a roleta do sistema, leve e acessível.
 */
import { catN } from '../lib/categories';
import { CatGlyph } from './CatIco';
import { Ico } from './Ico';

export interface OpcaoOrdem { id: string; label: string }

export function FiltroBar({ ordem, setOrdem, opcoes, cats, cat, setCat }: {
  ordem: string; setOrdem: (o: string) => void; opcoes: OpcaoOrdem[];
  cats: { cat: string; n: number }[]; cat: string | null; setCat: (c: string | null) => void;
}) {
  const atual = opcoes.find((o) => o.id === ordem) ?? opcoes[0];
  return (
    <div className="fbar">
      <label className={`fsel ${ordem !== opcoes[0].id ? 'on' : ''}`}>
        <Ico n="ordenar" size={15} />
        <span className="fsel-t">{atual.label}</span>
        <select aria-label="Ordenar" value={ordem} onChange={(e) => setOrdem(e.target.value)}>
          {opcoes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      {cats.length > 1 && (
        <label className={`fsel ${cat ? 'on' : ''}`}>
          {cat ? <CatGlyph cat={cat} size={15} solo /> : <Ico n="filtro" size={15} />}
          <span className="fsel-t">{cat ? catN(cat) : 'Categoria'}</span>
          <select aria-label="Categoria" value={cat ?? ''} onChange={(e) => setCat(e.target.value || null)}>
            <option value="">Todas as categorias</option>
            {cats.map((c) => <option key={c.cat} value={c.cat}>{catN(c.cat)} ({c.n})</option>)}
          </select>
        </label>
      )}
      {cat && <button className="fsel-x" onClick={() => setCat(null)} aria-label="Limpar categoria">Limpar</button>}
    </div>
  );
}

/** Categorias presentes numa lista, mais frequentes primeiro. */
export function catsDe(cats: string[]) {
  const m = new Map<string, number>();
  for (const c of cats) m.set(c, (m.get(c) ?? 0) + 1);
  return [...m].map(([cat, n]) => ({ cat, n })).sort((a, b) => b.n - a.n || catN(a.cat).localeCompare(catN(b.cat)));
}
