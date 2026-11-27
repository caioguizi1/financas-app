import { describe, expect, it } from 'vitest';
import { fatiasRosca } from './rosca';

const C = 2 * Math.PI * 70;
const soma = (fs: { len: number }[], gap = 3) => fs.reduce((a, f) => a + f.len + gap, 0);

describe('rosca: nenhuma fatia some e a volta fecha', () => {
  // parecido com o print: 4 grandes + 8 pequenas, 3 delas menores que o espaço entre fatias
  const itens = [0.33, 0.26, 0.16, 0.11, 0.05, 0.03, 0.02, 0.015, 0.009, 0.004, 0.0015, 0.0005].map((pct, i) => ({ chave: `c${i}`, pct }));
  const total = itens.reduce((a, i) => a + i.pct, 0);
  const norm = itens.map((i) => ({ ...i, pct: i.pct / total }));
  const fs = fatiasRosca(norm, C);

  it('toda categoria aparece com pelo menos o mínimo visível', () => {
    expect(fs).toHaveLength(12);
    for (const f of fs) expect(f.len).toBeGreaterThanOrEqual(3 - 1e-9);
  });
  it('a volta fecha: fatias + espaços = 100% do círculo, sem lacuna', () => {
    expect(soma(fs)).toBeCloseTo(C, 6);
    const ult = fs[fs.length - 1];
    expect(ult.off + ult.len + 3).toBeCloseTo(C, 6);
  });
  it('fatias seguem a ordem e não se sobrepõem', () => {
    for (let k = 1; k < fs.length; k++) expect(fs[k].off).toBeCloseTo(fs[k - 1].off + fs[k - 1].len + 3, 6);
  });
  it('as grandes continuam proporcionais (perdem pouco)', () => {
    expect((fs[0].len + 3) / C).toBeGreaterThan(0.31);
    expect(fs[0].len).toBeGreaterThan(fs[1].len);
  });
  it('uma categoria só: volta inteira, sem espaço', () => {
    expect(fatiasRosca([{ chave: 'a', pct: 1 }], C)).toEqual([{ chave: 'a', len: C, off: 0 }]);
  });
  it('categoria com 0% não entra', () => {
    expect(fatiasRosca([{ chave: 'a', pct: 1 }, { chave: 'b', pct: 0 }], C)).toHaveLength(1);
  });
});
