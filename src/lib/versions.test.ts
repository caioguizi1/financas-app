import { describe, expect, it } from 'vitest';
import { eventosEntre } from './engine';
import { ano13, EXTRAS, proxData } from './extras';
import { aplicarAlteracao, cancelarVersao, encerrar, oQueMuda, substituirRenda, versoes } from './versions';
import type { Data, Recorrente } from './types';

const aluguel: Recorrente = { id: 'a', tipo: 'saida', desc: 'Aluguel', cat: 'casa', valor: 250_000, dia: 10, inicio: '2026-01' };
const D = (recorrentes: Recorrente[]): Data => ({ v: 1, onboarded: true, perfil: { nome: '' }, saldo: { valor: 0, data: '2026-01-01', ts: 0 }, recorrentes, cartoes: [], lancamentos: [], uso: {} });
const valorEm = (recs: Recorrente[], dia: string) => eventosEntre(D(recs), dia, dia).reduce((a, e) => a + e.valor, 0);

describe('v2.58 · cancelar mudança agendada', () => {
  it('Pix → cartão a partir de dez, cancelado: volta a ser Pix em todos os meses, uma versão só', () => {
    const agendada = aplicarAlteracao([aluguel], 'a', { cartaoId: 'picpay', meio: 'credito' }, '2026-12');
    const nova = versoes(agendada, 'a')[1];
    const r = cancelarVersao(agendada, nova.id);
    expect(r).toEqual([{ ...aluguel, serie: 'a' }]);
    expect('fim' in r[0]).toBe(false);
    expect(eventosEntre(D(r), '2026-11-01', '2027-01-31').map((e) => `${e.data} ${e.cartaoId ?? 'pix'}`)).toEqual(['2026-11-10 pix', '2026-12-10 pix', '2027-01-10 pix']);
  });
  it('com três versões, cancelar a do meio devolve o período dela pra anterior', () => {
    let r = aplicarAlteracao([aluguel], 'a', { valor: 260_000 }, '2026-12');
    r = aplicarAlteracao(r, versoes(r, 'a')[1].id, { valor: 270_000 }, '2027-03');
    r = cancelarVersao(r, versoes(r, 'a')[1].id);
    expect(versoes(r, 'a').map((v) => [v.inicio, v.fim ?? null, v.valor])).toEqual([['2026-01', '2027-02', 250_000], ['2027-03', null, 270_000]]);
  });
  it('editar de novo "a partir de dez" com uma mudança já agendada pra dez não cria versão em cima (não conta 2×)', () => {
    let r = aplicarAlteracao([aluguel], 'a', { cartaoId: 'picpay', meio: 'credito' }, '2026-12');
    r = aplicarAlteracao(r, 'a', { valor: 260_000, cartaoId: null, meio: 'boleto' }, '2026-12');
    expect(versoes(r, 'a').map((v) => [v.inicio, v.fim ?? null, v.valor, v.meio])).toEqual([['2026-01', '2026-11', 250_000, undefined], ['2026-12', null, 260_000, 'boleto']]);
    expect(eventosEntre(D(r), '2026-12-01', '2026-12-31')).toHaveLength(1);
  });
  it('descreve o que muda', () => {
    const cartoes = [{ id: 'picpay', nome: 'Cartão PicPay', fechamento: 1, vencimento: 10 }];
    expect(oQueMuda({ ...aluguel, meio: 'pix' }, { ...aluguel, cartaoId: 'picpay', meio: 'credito' }, cartoes)).toBe('Cartão PicPay');
    expect(oQueMuda(aluguel, { ...aluguel, valor: 260_000, dia: 15 }, cartoes)).toBe('−R$ 2.600,00 · dia 15');
  });
  it('a primeira versão não se cancela (isso é apagar)', () => {
    expect(cancelarVersao([aluguel], 'a')).toEqual([aluguel]);
  });
});

describe('alteração com vigência', () => {
  it('a partir de dezembro: passado intacto, futuro com valor novo', () => {
    const r = aplicarAlteracao([aluguel], 'a', { valor: 270_000 }, '2026-12');
    expect(valorEm(r, '2026-11-10')).toBe(-250_000);
    expect(valorEm(r, '2026-12-10')).toBe(-270_000);
    expect(valorEm(r, '2027-03-10')).toBe(-270_000);
    expect(versoes(r, 'a').map((v) => [v.inicio, v.fim ?? null, v.valor])).toEqual([['2026-01', '2026-11', 250_000], ['2026-12', null, 270_000]]);
  });
  it('"corrigir tudo" reescreve sem criar versão', () => {
    const r = aplicarAlteracao([aluguel], 'a', { valor: 260_000 }, 'sempre');
    expect(r).toHaveLength(1);
    expect(valorEm(r, '2026-02-10')).toBe(-260_000);
  });
  it('mudar o dia também vale só pra frente', () => {
    const r = aplicarAlteracao([aluguel], 'a', { dia: 5 }, '2026-12');
    expect(eventosEntre(D(r), '2026-11-01', '2026-12-31').map((e) => e.data)).toEqual(['2026-11-10', '2026-12-05']);
  });
  it('encerrar mantém o passado e para daí em diante', () => {
    const r = encerrar([aluguel], 'a', '2026-12');
    expect(valorEm(r, '2026-11-10')).toBe(-250_000);
    expect(valorEm(r, '2026-12-10')).toBe(0);
  });
});

describe('troca de renda', () => {
  const sal: Recorrente = { id: 's', onb: 'renda', tipo: 'entrada', desc: 'Salário', cat: 'salario', valor: 850_000, dia: 5, inicio: '2026-01' };
  it('1x → 2x a partir de dezembro', () => {
    const r = substituirRenda([sal, aluguel], [{ desc: 'Adiantamento', valor: 400_000, dia: 20 }, { desc: 'Salário', valor: 500_000, dia: 5 }], '2026-12', '2026-11');
    expect(valorEm(r, '2026-11-05')).toBe(850_000);
    expect(valorEm(r, '2026-12-05')).toBe(500_000);
    expect(valorEm(r, '2026-12-20')).toBe(400_000);
    expect(valorEm(r, '2026-12-10')).toBe(-250_000); // aluguel não foi tocado
    const salarios = r.filter((x) => x.desc === 'Salário');
    expect(new Set(salarios.map((x) => x.serie ?? x.id)).size).toBe(1); // mesma série = histórico contínuo
  });
});

describe('extras', () => {
  it('13º: datas da CLT no ciclo certo', () => {
    const m = EXTRAS.find((e) => e.k === '13')!;
    expect(m.parcelas.map((p) => p.data('2026-11-23'))).toEqual(['2026-11-30', '2026-12-18']); // 20/12/2026 é domingo
    expect(ano13('2026-12-21')).toBe(2027);
  });
  it('próxima data rola pro ano seguinte', () => {
    expect(proxData('2026-11-23', 1, 28)).toBe('2027-02-28');
    expect(proxData('2026-01-10', 1, 28)).toBe('2026-02-28');
  });
});
