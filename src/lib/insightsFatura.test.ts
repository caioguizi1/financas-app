import { describe, expect, it } from 'vitest';
import { dicasDaFatura } from './insightsFatura';
import type { Data, Evento } from './types';

const c = { id: 'it', nome: 'Itaú', fechamento: 31, vencimento: 7 };
const ev = (desc: string, cat: string, valor: number, venc = '2026-12-07', extra: Partial<Evento> = {}): Evento =>
  ({ data: venc, venc, valor: -valor, desc, cat, ref: desc, cartao: 'Itaú', cartaoId: 'it', lanc: true, criado: 1, ...extra });
const D = (over: Partial<Data> = {}): Data => ({ v: 1, onboarded: true, perfil: { nome: '' }, saldo: { valor: 0, data: '2026-11-23', ts: 1 }, recorrentes: [], cartoes: [c], lancamentos: [], uso: {}, ...over });
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('dicas da fatura', () => {
  it('concentração numa categoria e compra que pesa muito', () => {
    const its = [ev('Mercado A', 'mercado', 50000), ev('Mercado B', 'mercado', 30000), ev('Uber', 'transporte', 10000), ev('Cinema', 'lazer', 10000)];
    const d = dicasDaFatura(D(), c, '2026-12-07', its);
    expect(ids(d)).toEqual(expect.arrayContaining(['conc', 'maior']));
    expect(d.find((x) => x.id === 'conc')!.texto).toContain('80% desta fatura');
  });
  it('parcelas: peso e compras novas parceladas', () => {
    const its = [ev('TV 1/10', 'compras', 30000), ev('Sofá 1/6', 'casa', 20000), ev('Fone 4/5', 'compras', 10000), ev('Padaria', 'mercado', 5000)];
    const d = dicasDaFatura(D(), c, '2026-12-07', its);
    expect(d.find((x) => x.id === 'parc')!.texto).toMatch(/^92% desta fatura são parcelas/);
    expect(d.find((x) => x.id === 'novasparc')!.texto).toBe('2 compras novas parceladas nesta fatura: +R$ 500,00 por mês até set/27.');
  });
  it('valor informado à mão entra na base (não diz 100% parcelas)', () => {
    const its = [ev('TV 2/10', 'compras', 30000), ev('Ajuste fatura Itaú', 'fatura', 70000)];
    expect(dicasDaFatura(D(), c, '2026-12-07', its).find((x) => x.id === 'parc')).toBeUndefined(); // 30% < 40%
  });
  it('acima do gasto típico', () => {
    const d = dicasDaFatura(D({ cartoes: [{ ...c, estimativa: 100000 }] }), { ...c, estimativa: 100000 }, '2026-12-07', [ev('A', 'compras', 80000), ev('B', 'lazer', 50000)]);
    expect(d.find((x) => x.id === 'acima')!.texto).toBe('R$ 300,00 acima do seu gasto típico (R$ 1.000,00).');
  });
  it('compara categoria só com faturas completas (importadas), não com parcelas soltas', () => {
    const hist = [{ id: 'h', tipo: 'saida' as const, valor: 10000, cat: 'pets', desc: 'Vet', data: '2026-10-10', cartaoId: 'it', fatura: '2026-11-07', criado: 1 }];
    const its = [ev('Vet 1', 'pets', 40000), ev('Mercado', 'mercado', 5000)];
    // sem registro de importação: fatura de nov tem 1 compra só → não conta como histórico
    expect(dicasDaFatura(D({ lancamentos: hist }), c, '2026-12-07', its).some((x) => x.id === 'alta-pets')).toBe(false);
    const comImport = D({ lancamentos: hist, importacoes: [{ id: 'i', tipo: 'fatura', cartaoId: 'it', venc: '2026-11-07', total: 10000, ids: ['h'], quando: 1 }] });
    expect(dicasDaFatura(comImport, c, '2026-12-07', its).find((x) => x.id === 'alta-pets')!.texto).toBe('Você está gastando mais com Pets: R$ 400,00, 4,0x a fatura de nov/26 (+R$ 300,00).');
  });
  it('compra da fatura anterior (adiada) não infla a categoria e ganha a explicação', () => {
    const hist = [{ id: 'h', tipo: 'saida' as const, valor: 10000, cat: 'pets', desc: 'Vet', data: '2026-10-10', cartaoId: 'it', fatura: '2026-11-07', criado: 1 }];
    const comImport = D({ lancamentos: hist, importacoes: [{ id: 'i', tipo: 'fatura', cartaoId: 'it', venc: '2026-11-07', total: 10000, ids: ['h'], quando: 1 }] });
    const its = [ev('Vet antigo', 'pets', 40000, '2026-12-07', { adiado: true }), ev('Vet', 'pets', 10000), ev('Mercado', 'mercado', 5000)];
    const d = dicasDaFatura(comImport, c, '2026-12-07', its);
    expect(d.some((x) => x.id === 'alta-pets')).toBe(false);
    expect(d.find((x) => x.id === 'adiadas')!.texto).toBe('R$ 400,00 desta fatura é 1 compra que veio da fatura anterior e é paga nesta. Fica fora da comparação com o normal.');
  });
  it('fatura futura: fala do que já está comprometido, não de "100% parcelas"', () => {
    const its = [ev('TV 3/10', 'compras', 30000, '2027-01-07'), ev('Sofá 2/6', 'casa', 20000, '2027-01-07'), ev('Previsto', 'outros', 50000, '2027-01-07', { estimativa: true })];
    const d = dicasDaFatura(D({ cartoes: [{ ...c, estimativa: 100000 }] }), { ...c, estimativa: 100000 }, '2027-01-07', its);
    expect(d.find((x) => x.id === 'parc')!.texto).toBe('R$ 500,00 (50% da fatura prevista) já estão comprometidos em 2 parcelas. Sobra R$ 500,00 até o seu gasto típico.');
    expect(d.some((x) => x.id === 'conc' || x.id === 'maior')).toBe(false);
  });
});
