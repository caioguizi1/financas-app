import { describe, expect, it } from 'vitest';
import { gerarInsights, parcelasAbertas } from './insights';
import type { Data, Lancamento } from './types';

const HOJE = '2026-11-23';
const base = (over: Partial<Data> = {}): Data => ({
  v: 1, onboarded: true, perfil: { nome: '' }, saldo: { valor: 300_000, data: HOJE, ts: 1 },
  recorrentes: [
    { id: 's', tipo: 'entrada', desc: 'Salário', cat: 'salario', valor: 800_000, dia: 5, inicio: '2026-01' },
    { id: 'a', tipo: 'saida', desc: 'Aluguel', cat: 'casa', valor: 200_000, dia: 1, inicio: '2026-01' },
  ],
  cartoes: [], lancamentos: [], uso: {}, ...over,
});
const lanc = (id: string, data: string, valor: number, cat = 'comida', desc = '', extra: Partial<Lancamento> = {}): Lancamento =>
  ({ id, tipo: 'saida', valor, cat, desc, data, criado: 1, ...extra });

describe('insights', () => {
  it('gasto por dia até o próximo salário desconta as contas antes dele', () => {
    const i = gerarInsights(base(), HOJE).find((x) => x.id === 'dia')!;
    // 3.000 − aluguel 2.000 (dia 1) = 1.000 ÷ 12 dias até 05/12 → R$ 83/dia
    expect(i.titulo).toBe('R$ 83,00 por dia');
    expect(i.texto).toContain('05/12');
  });
  it('alerta quando as contas passam do saldo', () => {
    const i = gerarInsights(base({ saldo: { valor: 100_000, data: HOJE, ts: 1 } }), HOJE).find((x) => x.id === 'dia')!;
    expect(i.tom).toBe('alerta');
  });
  it('categoria acima da média', () => {
    const D = base({ lancamentos: [lanc('1', '2026-09-10', 40_000), lanc('2', '2026-10-10', 40_000), lanc('3', '2026-11-10', 90_000)] });
    const i = gerarInsights(D, HOJE).find((x) => x.id === 'cat-comida')!;
    expect(i.titulo).toBe('Comida: +125% este mês');
  });
  it('sugere virar fixo o que se repete 3 meses', () => {
    const D = base({ lancamentos: ['2026-09-08', '2026-10-08', '2026-11-08'].map((d, k) => lanc(String(k), d, 2190, 'assinaturas', 'Spotify')) });
    const i = gerarInsights(D, HOJE).find((x) => x.id === 'rec-spotify')!;
    expect(i.acao?.tipo).toBe('virarFixo');
  });
  it('não sugere fixo pra quem já é fixo', () => {
    const D = base({ lancamentos: ['2026-09-08', '2026-10-08', '2026-11-08'].map((d, k) => lanc(String(k), d, 1000, 'casa', 'Aluguel')) });
    expect(gerarInsights(D, HOJE).some((x) => x.id === 'rec-aluguel')).toBe(false);
  });
  it('fatura prevista do cartão', () => {
    const D = base({ cartoes: [{ id: 'nu', nome: 'Nubank', fechamento: 3, vencimento: 10 }], lancamentos: [lanc('c', '2026-11-20', 15_000, 'compras', 'Tênis', { cartaoId: 'nu' })] });
    const i = gerarInsights(D, HOJE).find((x) => x.id === 'fat-nu-aberta')!;
    expect(i.titulo).toBe('Fatura Nubank: R$ 150,00');
    expect(i.texto).toContain('10/12');
  });
  it('parcelas em aberto', () => {
    const D = base({ lancamentos: [lanc('p', '2026-10-15', 100_000, 'compras', 'Celular', { parcelas: 10 })] });
    const [a] = parcelasAbertas(D, HOJE);
    expect(a.total).toBe(10);
    expect(a.pagas).toBe(2); // out e nov
    expect(a.restante).toBe(80_000);
    expect(a.ultima).toBe('2027-07-15');
  });
});
