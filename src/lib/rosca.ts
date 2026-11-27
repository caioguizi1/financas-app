/**
 * Fatias da rosca do "Para onde foi" (v2.47).
 * Antes cada fatia perdia um espaço fixo de separação: categoria menor que o espaço SUMIA e o fundo escuro
 * aparecia no lugar (a "lacuna sem cor" no topo). Agora toda fatia tem um tamanho mínimo visível e o que
 * falta é tirado das maiores, na proporção do tamanho delas — a volta fecha sempre em 100%.
 */
export interface Fatia { chave: string; len: number; off: number }

/** `pcts` somam 1. `circ` = comprimento da volta; `gap` = espaço entre fatias; `min` = menor fatia visível. */
export function fatiasRosca(itens: { chave: string; pct: number }[], circ: number, gap = 3, min = 3): Fatia[] {
  const vivos = itens.filter((i) => i.pct > 0);
  if (!vivos.length) return [];
  if (vivos.length === 1) return [{ chave: vivos[0].chave, len: circ, off: 0 }];
  const piso = min + gap; // espaço que cada fatia ocupa na volta, no mínimo
  const arcos = vivos.map((i) => Math.max(i.pct * circ, piso));
  const excesso = arcos.reduce((a, b) => a + b, 0) - circ;
  if (excesso > 0) {
    const folga = arcos.reduce((a, b) => a + (b - piso), 0);
    for (let k = 0; k < arcos.length; k++) arcos[k] -= folga > 0 ? excesso * ((arcos[k] - piso) / folga) : excesso / arcos.length;
  }
  let off = 0;
  return vivos.map((i, k) => { const f = { chave: i.chave, len: Math.max(0, arcos[k] - gap), off }; off += arcos[k]; return f; });
}
