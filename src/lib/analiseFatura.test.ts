import { describe, expect, it } from 'vitest';
import { analisarFatura } from './analiseFatura';
import type { Data, Lancamento } from './types';

const pp = { id: 'pp', nome: 'PicPay', fechamento: 9, vencimento: 15 };
let k = 0;
const L = (o: Partial<Lancamento>): Lancamento => ({ id: `l${++k}`, tipo: 'saida', valor: 1000, cat: 'comida', desc: 'x', data: '2026-10-20', cartaoId: 'pp', meio: 'credito', criado: 1, ...o });
const D = (ls: Lancamento[], rec: Data['recorrentes'] = []) => ({ v: 1, onboarded: true, perfil: { nome: 'X' }, saldo: { valor: 0, data: '2026-11-24', ts: 1 }, recorrentes: rec, cartoes: [pp], lancamentos: ls, uso: {} } as unknown as Data);

describe('análise da fatura', () => {
  it('separa compras do mês, parcelas novas/antigas, puladas, fixos e créditos', () => {
    const d = D([
      L({ valor: 5000 }), // à vista, ciclo de nov
      L({ valor: 30000, parcelas: 3, data: '2026-10-20' }), // 1/3 em nov
      L({ valor: 9000, parcelas: 3, data: '2026-08-20' }), // 3/3 em nov
      L({ valor: 4000, adiado: true, adiadoEm: '2026-11-15', fatura: '2026-11-15', data: '2026-09-18' }),
      L({ tipo: 'entrada', valor: 1500, cat: 'reembolso', data: '2026-10-25' }),
    ], [{ id: 'cel', tipo: 'saida', desc: 'Celular', cat: 'contas', valor: 5500, dia: 10, inicio: '2026-01', cartaoId: 'pp' } as never]);
    const a = analisarFatura(d, pp, '2026-11-15');
    expect(Object.fromEntries(a.partes.map((p) => [p.id, p.valor]))).toEqual({ mes: 5000, novas: 10000, antigas: 3000, puladas: 4000, fixos: 5500 });
    expect(a.creditos).toBe(1500);
    expect(a.total).toBe(5000 + 10000 + 3000 + 4000 + 5500 - 1500);
    // a parcelada nova ainda cobra 2 parcelas nas próximas
    expect(a.futuro).toEqual([{ venc: '2026-12-15', valor: 10000 }, { venc: '2027-01-15', valor: 10000 }]);
    // outubro só tem parcelas deduzidas: não serve de comparação
    expect(a.anterior).toBeNull();
    const d2 = D([...d.lancamentos, L({ data: '2026-09-20' }), L({ data: '2026-09-21' }), L({ data: '2026-09-22' })], d.recorrentes);
    expect(analisarFatura(d2, pp, '2026-11-15').anterior?.venc).toBe('2026-10-15');
  });
});
