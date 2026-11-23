import { describe, expect, it } from 'vitest';
import { pagamentoCartao, projecao } from './engine';
import { agruparFaturas, ajusteFatura, diaDoCiclo, faturasAtuais, fechamentoDe } from './faturas';
import { eventosEntre } from './engine';
import type { Data } from './types';

const HOJE = '2026-11-23';
const itau = { id: 'it', nome: 'Itaú', fechamento: 20, vencimento: 28 };
const picpay = { id: 'pp', nome: 'PicPay', fechamento: 25, vencimento: 5 };
const base = (over: Partial<Data> = {}): Data => ({ v: 1, onboarded: true, perfil: { nome: '' }, saldo: { valor: 500_000, data: HOJE, ts: 1 }, recorrentes: [], cartoes: [itau, picpay], lancamentos: [], uso: {}, ...over });

describe('ciclos de fatura', () => {
  it('fechamento do ciclo', () => {
    expect(fechamentoDe(itau, '2026-11-28')).toBe('2026-11-20');
    expect(fechamentoDe(picpay, '2026-12-05')).toBe('2026-11-25');
  });
  it('dia do ciclo cai sempre na fatura certa', () => {
    for (const c of [itau, picpay]) for (const v of ['2026-11-28', '2026-12-28', '2027-01-05', '2027-03-05']) {
      const venc = `${v.slice(0, 8)}${String(c.vencimento).padStart(2, '0')}`;
      expect(pagamentoCartao(c, diaDoCiclo(c, venc))).toBe(venc);
    }
  });
  it('entre fechamento e vencimento existem 2 faturas (fechada + aberta)', () => {
    const f = faturasAtuais(base(), itau, HOJE);
    expect(f.map((x) => [x.status, x.vencimento])).toEqual([['fechada', '2026-11-28'], ['aberta', '2026-12-28']]);
  });
  it('antes do fechamento só existe a aberta', () => {
    expect(faturasAtuais(base(), picpay, HOJE).map((x) => [x.status, x.vencimento])).toEqual([['aberta', '2026-12-05']]);
  });
});

describe('conferir com o banco', () => {
  it('ajuste faz a fatura fechada descontar no vencimento (o bug reportado)', () => {
    let D = base();
    expect(projecao(D, 40, HOJE).saldoEm('2026-11-28')).toBe(500_000); // antes: nada descontava
    const [fechada, aberta] = faturasAtuais(D, itau, HOJE);
    D = { ...D, lancamentos: [ajusteFatura(fechada, 120_000)!, ajusteFatura(aberta, 45_000)!] };
    const p = projecao(D, 40, HOJE);
    expect(p.saldoEm('2026-11-28')).toBe(380_000);
    expect(p.saldoEm('2026-12-28')).toBe(335_000);
  });
  it('ajuste considera o que já foi lançado (só a diferença)', () => {
    let D = base({ lancamentos: [{ id: 'c', tipo: 'saida', valor: 30_000, cat: 'compras', desc: 'Tênis', data: '2026-11-23', cartaoId: 'it', criado: 2 }] });
    const aberta = faturasAtuais(D, itau, HOJE)[1];
    expect(aberta.total).toBe(30_000);
    const aj = ajusteFatura(aberta, 45_000)!;
    expect([aj.tipo, aj.valor]).toEqual(['saida', 15_000]);
    D = { ...D, lancamentos: [...D.lancamentos, aj] };
    expect(faturasAtuais(D, itau, HOJE)[1].total).toBe(45_000);
    expect(ajusteFatura(faturasAtuais(D, itau, HOJE)[1], 45_000)).toBeNull();
  });
  it('se o app tem mais do que o banco, o ajuste reduz', () => {
    const D = base({ lancamentos: [{ id: 'c', tipo: 'saida', valor: 50_000, cat: 'compras', desc: 'X', data: '2026-11-23', cartaoId: 'it', criado: 2 }] });
    const aj = ajusteFatura(faturasAtuais(D, itau, HOJE)[1], 40_000)!;
    expect([aj.tipo, aj.valor]).toEqual(['entrada', 10_000]);
  });
});

describe('agrupar', () => {
  it('compras do mesmo cartão e vencimento viram 1 item', () => {
    const D = base({ lancamentos: [
      { id: 'a', tipo: 'saida', valor: 10_000, cat: 'compras', desc: 'A', data: '2026-11-21', cartaoId: 'it', criado: 2 },
      { id: 'b', tipo: 'saida', valor: 5_000, cat: 'comida', desc: 'B', data: '2026-11-23', cartaoId: 'it', criado: 2 },
      { id: 'p', tipo: 'saida', valor: 2_000, cat: 'comida', desc: 'Pix', data: '2026-11-30', criado: 2 },
    ] });
    const g = agruparFaturas(eventosEntre(D, HOJE, '2027-01-31'), D.cartoes);
    expect(g.map((e) => [e.data, e.desc, e.valor, e.itens?.length ?? 0])).toEqual([['2026-11-30', 'Pix', -2_000, 0], ['2026-12-28', 'Fatura Itaú', -15_000, 2]]);
  });
});
