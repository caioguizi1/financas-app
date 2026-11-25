/**
 * Dados FICTÍCIOS para os testes (o repositório é público: nada real aqui).
 * Gerados de forma determinística — o mesmo resultado em toda execução.
 */
import type { Data, Lancamento } from '../src/lib/types';

/** "Hoje" dos testes: datas fixas deixam a evidência reproduzível. */
export const HOJE = '2026-11-25';

export const vazio = (): Data => ({
  v: 1, onboarded: true, perfil: { nome: 'Ana' },
  saldo: { valor: 320_000, data: HOJE, ts: 1 },
  recorrentes: [], cartoes: [], lancamentos: [], uso: {}, backupEm: HOJE,
});

const CARTOES = [
  { id: 'roxo', nome: 'Cartão Roxo', fechamento: 8, vencimento: 15, estimativa: 300_000 },
  { id: 'laranja', nome: 'Cartão Laranja', fechamento: 30, vencimento: 7 },
];

const COMPRAS: [string, string, number][] = [
  ['Mercado Bom Preço', 'mercado', 18_000], ['Padaria da Esquina', 'comida', 2_400], ['Posto Avenida', 'transporte', 15_000],
  ['Farmácia Saúde', 'saude', 4_900], ['Uber', 'transporte', 2_300], ['iFood', 'comida', 5_600], ['Cinema', 'lazer', 6_000],
  ['Loja de Roupas', 'compras', 12_000], ['Petshop Amigo', 'pets', 9_000], ['Livraria Central', 'educacao', 7_500],
];

/** ~150 lançamentos em 6 meses, 2 cartões, fixos de renda e contas. */
export function realista(): Data {
  let s = 42;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const lancamentos: Lancamento[] = [];
  for (let i = 0; i < 150; i++) {
    const [desc, cat, v] = COMPRAS[Math.floor(rnd() * COMPRAS.length)];
    const dias = Math.floor(rnd() * 180);
    const d = new Date(`${HOJE}T12:00:00`); d.setDate(d.getDate() - dias);
    const data = d.toISOString().slice(0, 10);
    const meio = rnd();
    const cartaoId = meio < 0.45 ? 'roxo' : meio < 0.7 ? 'laranja' : null;
    const parcelas = cartaoId && rnd() < 0.12 ? 3 + Math.floor(rnd() * 7) : 1;
    lancamentos.push({ id: `l${i}`, tipo: 'saida', valor: Math.round(v * (0.6 + rnd() * 0.8)) * (parcelas > 1 ? 4 : 1), cat, data, desc,
      cartaoId, parcelas, criado: i + 1, meio: cartaoId ? 'credito' : 'pix' });
  }
  return {
    ...vazio(),
    cartoes: CARTOES,
    recorrentes: [
      { id: 'sal', tipo: 'entrada', desc: 'Salário', cat: 'salario', valor: 650_000, dia: 5, inicio: '2026-01', onb: 'renda' },
      { id: 'alu', tipo: 'saida', desc: 'Aluguel', cat: 'casa', valor: 180_000, dia: 10, inicio: '2026-01', meio: 'boleto' },
      { id: 'net', tipo: 'saida', desc: 'Internet', cat: 'contas', valor: 12_000, dia: 12, inicio: '2026-01', meio: 'pix' },
      { id: 'str', tipo: 'saida', desc: 'Streaming', cat: 'assinaturas', valor: 5_590, dia: 3, inicio: '2026-01', cartaoId: 'roxo', meio: 'credito' },
    ],
    lancamentos,
  };
}
