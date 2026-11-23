import { describe, expect, it } from 'vitest';
import { decimoTerceiro, diaUtilAntes, holerite, inss, irPLR, irrfMensal } from './folha';

const R = (reais: number) => Math.round(reais * 100);

describe('INSS 2026', () => {
  it('faixas progressivas', () => {
    expect(inss(R(1621))).toBe(R(121.58));
    expect(inss(R(3000))).toBe(R(248.6)); // 121,575 + 115,3656 + 11,6592
    expect(inss(R(5900))).toBe(R(627.51));
  });
  it('teto: R$ 988,09', () => {
    expect(inss(R(12000))).toBe(R(988.09));
    expect(inss(R(8475.55))).toBe(R(988.09));
  });
});

describe('IRRF mensal 2026 (exemplos da Receita)', () => {
  it('até R$ 5 mil: imposto zero', () => {
    expect(irrfMensal(R(3036), R(257.73)).devido).toBe(0); // João
    const jose = irrfMensal(R(4000), R(0));
    expect(jose.simplificado).toBe(true);
    expect(jose.tabela).toBe(R(114.76));
    expect(jose.devido).toBe(0);
    expect(irrfMensal(R(5000), R(0)).devido).toBe(0);
  });
  it('acima de R$ 7.350: tabela cheia (Vera, R$ 7.607,20 sem deduções)', () => {
    const vera = irrfMensal(R(7607.2), 0);
    expect(vera.base).toBe(R(7000));
    expect(vera.reducao).toBe(0);
    expect(vera.devido).toBe(R(1016.27));
  });
  it('faixa de transição: redução sobre o bruto', () => {
    const h = holerite(R(5900));
    expect(h.inss).toBe(R(627.51));
    expect(h.ir.tabela).toBe(R(541.2));
    expect(h.ir.reducao).toBe(R(193.06));
    expect(h.ir.devido).toBe(R(348.14));
    expect(h.liquido).toBe(R(5900 - 627.51 - 348.14));
  });
  it('dependentes reduzem a base', () => {
    expect(holerite(R(10000), 2).ir.devido).toBeLessThan(holerite(R(10000), 0).ir.devido);
  });
});

describe('13º', () => {
  it('1ª parcela sem desconto; 2ª com INSS e IR do 13º inteiro', () => {
    const d = decimoTerceiro(R(10000));
    expect(d.parcela1).toBe(R(5000));
    expect(d.inss).toBe(R(988.09));
    expect(d.parcela2).toBe(R(10000) - R(5000) - d.inss - d.ir.devido);
    expect(d.parcela2).toBeLessThan(d.parcela1);
  });
  it('até R$ 5 mil: sem IR no 13º (Lei 15.270, §3º)', () => {
    expect(decimoTerceiro(R(4500)).ir.devido).toBe(0);
  });
  it('proporcional aos meses', () => {
    expect(decimoTerceiro(R(6000), 0, 6).bruto).toBe(R(3000));
  });
  it('prazo em fim de semana antecipa pra sexta (20/12/2026 é domingo)', () => {
    expect(diaUtilAntes('2026-12-20')).toBe('2026-12-18');
    expect(diaUtilAntes('2026-11-30')).toBe('2026-11-30');
  });
});

describe('PLR (tabela exclusiva anual)', () => {
  it('isenta até R$ 8.214,40', () => {
    expect(irPLR(R(8214.4))).toBe(0);
  });
  it('faixas', () => {
    expect(irPLR(R(12000))).toBe(R(12000 * 0.15 - 1360.25));
    expect(irPLR(R(20000))).toBe(R(20000 * 0.275 - 3166.8));
  });
  it('2ª parcela no mesmo ano considera a 1ª', () => {
    const p1 = irPLR(R(8000));
    const p2 = irPLR(R(8000), R(8000));
    expect(p1).toBe(0);
    expect(p1 + p2).toBe(irPLR(R(16000)));
  });
});
