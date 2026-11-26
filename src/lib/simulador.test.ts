import { describe, expect, it } from 'vitest';
import { simular } from './simulador';
import type { Cartao, Data } from './types';

const HOJE = '2026-11-26';
const cartao: Cartao = { id: 'it', nome: 'Itaú', fechamento: 1, vencimento: 10 }; // compra hoje → fatura que vence 10/12
const base = (over: Partial<Data> = {}): Data => ({
  v: 1, onboarded: true, perfil: { nome: 'T' }, saldo: { valor: 50_000, data: HOJE, ts: 1 },
  recorrentes: [{ id: 'sal', tipo: 'entrada', desc: 'Salário', cat: 'salario', valor: 300_000, dia: 5, inicio: '2026-01' }],
  cartoes: [cartao], lancamentos: [], uso: {}, ...over,
});
const em = (pts: { d: string; v: number }[], d: string) => pts.find((p) => p.d === d)!.v;

describe('simulador', () => {
  it('Pix à vista: sai hoje, o saldo inteiro cai o valor da compra', () => {
    const s = simular(base(), { valor: 10_000, cartaoId: null, parcelas: 1 }, [1, 2], HOJE);
    expect(s.opcoes).toHaveLength(1); // no Pix não há parcelado
    expect(em(s.opcoes[0].pts, HOJE)).toBe(40_000);
    expect(em(s.opcoes[0].pts, '2027-01-20') - em(s.base.pts, '2027-01-20')).toBe(-10_000);
  });

  it('cartão: à vista sai no vencimento da fatura; 2x em duas faturas', () => {
    const s = simular(base(), { valor: 10_000, cartaoId: 'it', parcelas: 1 }, [1, 2], HOJE);
    const [vista, duas] = s.opcoes;
    expect(em(vista.pts, '2026-12-09')).toBe(em(s.base.pts, '2026-12-09')); // antes do vencimento: nada
    expect(em(vista.pts, '2026-12-10') - em(s.base.pts, '2026-12-10')).toBe(-10_000);
    expect(em(duas.pts, '2026-12-10') - em(s.base.pts, '2026-12-10')).toBe(-5_000);
    expect(em(duas.pts, '2027-01-10') - em(s.base.pts, '2027-01-10')).toBe(-10_000);
    expect(duas.primeira).toEqual({ d: '2026-12-10', v: 5_000 });
  });

  it('conta como gasto a mais mesmo com "gasto típico" no cartão (não some na estimativa)', () => {
    const s = simular(base({ cartoes: [{ ...cartao, estimativa: 200_000 }] }), { valor: 10_000, cartaoId: 'it', parcelas: 1 }, [1], HOJE);
    expect(em(s.opcoes[0].pts, '2026-12-10') - em(s.base.pts, '2026-12-10')).toBe(-10_000);
  });

  it('veredito: aperta quando cria dias no negativo; a melhor é a que não deixa negativo', () => {
    // saldo baixo até o salário de 05/01: uma compra grande à vista em 10/12 deixa negativo até lá
    const D = base({ saldo: { valor: 5_000, data: HOJE, ts: 1 }, recorrentes: [{ id: 'sal', tipo: 'entrada', desc: 'Salário', cat: 'salario', valor: 300_000, dia: 5, inicio: '2027-01' }] });
    const s = simular(D, { valor: 8_000, cartaoId: 'it', parcelas: 1 }, [1, 2], HOJE);
    const [vista, duas] = s.opcoes;
    expect(vista.veredito).toBe('aperta');
    expect(vista.diasNeg).toBeGreaterThan(0);
    expect(duas.veredito).toBe('tranquilo');
    expect(duas.melhor).toBe(true);
    expect(s.dica).toMatch(/À vista te deixa \d+ dias? a mais no negativo; 2x não/);
  });

  it('sem aperto: ninguém leva "Melhor" e a dica diz que cabe', () => {
    const s = simular(base({ saldo: { valor: 500_000, data: HOJE, ts: 1 } }), { valor: 10_000, cartaoId: 'it', parcelas: 1 }, [1, 2], HOJE);
    expect(s.opcoes.every((o) => o.veredito === 'tranquilo')).toBe(true);
    expect(s.opcoes.some((o) => o.melhor)).toBe(false);
    expect(s.dica).toMatch(/Qualquer opção cabe/);
  });

  it('empate no aperto (ponto mais baixo depois das parcelas): sem selo, dica explica a troca', () => {
    // já negativo no fim do horizonte, por um gasto fixo grande; a compra não muda os dias no negativo
    const D = base({ recorrentes: [{ id: 'alu', tipo: 'saida', desc: 'Aluguel', cat: 'casa', valor: 400_000, dia: 15, inicio: '2026-01' }] });
    const s = simular(D, { valor: 10_000, cartaoId: 'it', parcelas: 1 }, [1, 2], HOJE);
    expect(s.opcoes[0].minimo.v).toBe(s.opcoes[1].minimo.v);
    expect(s.opcoes.some((o) => o.melhor)).toBe(false);
    expect(s.dica).toMatch(/já fica negativo/);
    expect(s.dica).toMatch(/Em 2x sobram R\$\s?50,00 a mais no fim de dezembro, mas as parcelas seguem até janeiro/);
  });

  it('comprometimento da renda com parcelas (mês do 1º pagamento)', () => {
    const s = simular(base(), { valor: 60_000, cartaoId: 'it', parcelas: 1 }, [1, 2], HOJE);
    const duas = s.opcoes[1];
    expect(duas.mes).toBe('2026-12');
    expect(duas.comprometimento).toEqual({ antes: 0, depois: 10 }); // R$ 300 de R$ 3.000
  });
});
