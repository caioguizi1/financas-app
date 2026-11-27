import { describe, expect, it } from 'vitest';
import type { Ponto } from './engine';
import { quantoFalta } from './quantoFalta';

/** série diária fictícia a partir de 25/11/2026 */
const serie = (vals: number[]): Ponto[] => vals.map((v, i) => { const d = new Date(2026, 10, 25 + i); return { d: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, v }; });
const somarAPartir = (pts: Ponto[], d: string, x: number) => pts.map((p) => (p.d >= d ? { ...p, v: p.v + x } : p));

describe('quanto falta pra não ficar negativo', () => {
  it('nunca negativo: nada a mostrar', () => {
    expect(quantoFalta(serie([500, 300, 100, 0, 200]))).toBeNull();
  });

  // pontual: fica negativo em 27/11, pior em 29/11, volta em 30/11
  const pontual = serie([500, 200, -100, -300, -700, 900, 900, 950]);
  const q = quantoFalta(pontual)!;
  it('falta = |pior| e o prazo é o 1º dia negativo (não o dia do pior)', () => {
    expect(q.falta).toBe(700);
    expect(q.ate).toBe('2026-11-27');
    expect(q.pior).toEqual({ d: '2026-11-29', v: -700 });
    expect(q.dias).toBe(3);
    expect(q.trechos).toHaveLength(1);
    expect(q.trechos[0].volta?.d).toBe('2026-11-30');
    expect(q.repete).toBe(false);
  });
  it('a promessa vale: entrando "falta" até o prazo, nenhum dia fica negativo', () => {
    expect(somarAPartir(pontual, q.ate, q.falta).every((p) => p.v >= 0)).toBe(true);
    // um centavo a menos não basta
    expect(somarAPartir(pontual, q.ate, q.falta - 1).some((p) => p.v < 0)).toBe(true);
    // entrando um dia depois do prazo, o 1º dia negativo continua negativo
    expect(somarAPartir(pontual, '2026-11-28', q.falta).some((p) => p.v < 0)).toBe(true);
  });

  it('dois buracos sem o saldo cair: avisa dois trechos, mas não "se repete"', () => {
    const r = quantoFalta(serie([500, -100, 400, -200, 600]))!;
    expect(r.trechos).toHaveLength(2);
    expect(r.repete).toBe(false);
    expect(r.falta).toBe(200);
    expect(r.ate).toBe('2026-11-26');
  });

  it('buraco que volta e saldo caindo mês a mês: "se repete", com a queda média por mês', () => {
    // 91 dias, cai 30 por dia → 900 por mês, com respiros positivos no meio
    const vals = Array.from({ length: 91 }, (_, i) => 1000 - i * 30 + (i % 30 === 0 ? 2500 : 0));
    const r = quantoFalta(serie(vals))!;
    expect(r.trechos.length).toBeGreaterThan(1);
    expect(r.repete).toBe(true);
    expect(r.quedaMes).toBe(900);
    expect(somarAPartir(serie(vals), r.ate, r.falta).every((p) => p.v >= 0)).toBe(true);
  });
});

describe('folga apertada (sem ficar negativo)', () => {
  it('perto de zero: avisa com o dia mais apertado', async () => {
    const { folgaApertada } = await import('./quantoFalta');
    expect(folgaApertada(serie([90_000, 30_000, 18_000, 70_000]))).toEqual({ folga: 18_000, dia: '2026-11-27' });
  });
  it('tranquilo (acima de R$ 500): nada', async () => {
    const { folgaApertada } = await import('./quantoFalta');
    expect(folgaApertada(serie([90_000, 60_000, 50_000]))).toBeNull();
  });
  it('fica negativo: quem fala é o "faltam", não a folga', async () => {
    const { folgaApertada } = await import('./quantoFalta');
    expect(folgaApertada(serie([90_000, -10, 50_000]))).toBeNull();
  });
  it('zero conta como folga apertada (não como negativo)', async () => {
    const { folgaApertada, quantoFalta } = await import('./quantoFalta');
    expect(quantoFalta(serie([1000, 0, 1000]))).toBeNull();
    expect(folgaApertada(serie([1000, 0, 1000]))).toEqual({ folga: 0, dia: '2026-11-26' });
  });
});
