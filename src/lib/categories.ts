export type Cat = readonly [key: string, emoji: string, nome: string];

export const CAT_OUT: Cat[] = [
  ['mercado', '🛒', 'Mercado'], ['comida', '🍔', 'Comida'], ['transporte', '🚗', 'Transporte'], ['casa', '🏠', 'Casa'],
  ['contas', '💡', 'Contas'], ['saude', '💊', 'Saúde'], ['lazer', '🎉', 'Lazer'], ['compras', '🛍️', 'Compras'],
  ['assinaturas', '📺', 'Assinaturas'], ['educacao', '📚', 'Educação'], ['pets', '🐾', 'Pets'], ['beleza', '💇', 'Beleza'],
  ['viagem', '✈️', 'Viagem'], ['outros', '•', 'Outros'],
];
export const CAT_IN: Cat[] = [
  ['salario', '💼', 'Salário'], ['extra', '💻', 'Renda extra'], ['reembolso', '↩️', 'Reembolso'], ['outros_in', '✨', 'Outros'],
];

const CATS: Record<string, { e: string; n: string }> = Object.fromEntries(
  [...CAT_OUT, ...CAT_IN].map(([k, e, n]) => [k, { e, n }]),
);
CATS.fatura = { e: '💳', n: 'Fatura' };

export const catE = (k: string) => (CATS[k] ?? CATS.outros).e;
export const catN = (k: string) => (CATS[k] ?? CATS.outros).n;

/** Gastos fixos sugeridos no cadastro inicial: [nome, categoria, ícone]. */
export const PRESETS: [string, string, string][] = [
  ['Aluguel / Financiamento', 'casa', '🏠'], ['Condomínio', 'casa', '🏢'], ['Luz', 'contas', '💡'], ['Água', 'contas', '🚿'],
  ['Internet', 'contas', '📶'], ['Celular', 'contas', '📱'], ['Academia', 'saude', '🏋️'], ['Streaming', 'assinaturas', '📺'],
  ['Transporte', 'transporte', '🚗'], ['Plano de saúde', 'saude', '🩺'], ['Faculdade / Curso', 'educacao', '📚'], ['Mercado do mês', 'mercado', '🛒'],
];
