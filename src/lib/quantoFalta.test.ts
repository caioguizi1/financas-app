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
    expect(q.primeiroNeg).toBe('2026-11-27');
    expect(q.etapas).toEqual([{ ate: '2026-11-27', valor: 700, acumulado: 700, trecho: 0 }]);
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
    // o total (200) só é preciso na 2ª vez; até a 1ª bastam 100
    expect(r.primeiroNeg).toBe('2026-11-26');
    expect(r.ate).toBe('2026-11-28');
    expect(r.etapas).toEqual([{ ate: '2026-11-26', valor: 100, acumulado: 100, trecho: 0 }, { ate: '2026-11-28', valor: 100, acumulado: 200, trecho: 1 }]);
  });

  it('buraco que volta e saldo caindo mês a mês: "se repete", com a queda média por mês', () => {
    // 91 dias, cai 30 por dia → 900 por mês, com respiros positivos no meio
    const vals = Array.from({ length: 91 }, (_, i) => 1000 - i * 30 + (i % 30 === 0 ? 2500 : 0));
    const r = quantoFalta(serie(vals))!;
    expect(r.trechos.length).toBeGreaterThan(1);
    expect(r.repete).toBe(true);
    expect(r.quedaMes).toBe(900);
    let p = serie(vals); for (const e of r.etapas) p = somarAPartir(p, e.ate, e.valor);
    expect(p.every((x) => x.v >= 0)).toBe(true); // seguindo o cronograma
    expect(r.etapas.reduce((a, e) => a + e.valor, 0)).toBe(r.falta);
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

// o caso do print (27/11): 3 vezes no negativo — duas rasas em dezembro e uma funda em janeiro.
// Antes: "Faltam R$ 1.176,56 até 15/12" (cobrava tudo no 1º buraco, que era pequeno).
describe('cronograma por vez no negativo (o caso do print)', () => {
  // 15/12–17/12: −63; 29/12: −12; 05/01–31/01: −400 descendo até −1.176,56 em 26/01
  const dias: number[] = [];
  for (let i = 0; i < 91; i++) {
    const d = new Date(2026, 10, 27 + i), k = `${d.getMonth() + 1}/${d.getDate()}`;
    const jan = d.getMonth() === 0;
    dias.push(
      ['12/15', '12/16', '12/17'].includes(k) ? -6_300
        : k === '12/29' ? -1_200
          : jan && d.getDate() >= 5 && d.getDate() < 26 ? -40_000 - (d.getDate() - 5) * 3_000
            : jan && d.getDate() >= 26 ? -117_656
              : d.getMonth() === 1 && d.getDate() === 1 ? -50_000 : 90_000,
    );
  }
  const pts = (() => { const out: Ponto[] = []; for (let i = 0; i < 91; i++) { const d = new Date(2026, 10, 27 + i); out.push({ d: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, v: dias[i] }); } return out; })();
  const q = quantoFalta(pts)!;

  it('3 vezes; total = o pior dia; prazo do total = o começo da vez mais funda', () => {
    expect(q.trechos).toHaveLength(3);
    expect(q.falta).toBe(117_656);
    expect(q.ate).toBe('2027-01-05');
    expect(q.primeiroNeg).toBe('2026-12-15');
  });
  it('cronograma: R$ 63 até 15/12; a 2ª vez (−R$ 12) já está coberta; o resto até 05/01', () => {
    expect(q.etapas).toEqual([
      { ate: '2026-12-15', valor: 6_300, acumulado: 6_300, trecho: 0 },
      { ate: '2027-01-05', valor: 111_356, acumulado: 117_656, trecho: 2 },
    ]);
  });
  it('seguindo o cronograma, nenhum dia fica negativo', () => {
    let p = pts; for (const e of q.etapas) p = somarAPartir(p, e.ate, e.valor);
    expect(p.every((x) => x.v >= 0)).toBe(true);
  });
  it('e ele não pede a mais: 1 centavo a menos em qualquer etapa deixa algum dia negativo', () => {
    q.etapas.forEach((_, k) => {
      let p = pts; q.etapas.forEach((e, j) => { p = somarAPartir(p, e.ate, e.valor - (j === k ? 1 : 0)); });
      expect(p.some((x) => x.v < 0)).toBe(true);
    });
  });
});
