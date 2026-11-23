/** Data no formato YYYY-MM-DD (horário local). */
export type ISODate = string;
/** Mês no formato YYYY-MM. */
export type MonthKey = string;
export type Tipo = 'entrada' | 'saida';

/** Valores sempre em centavos (inteiros). */
export interface Recorrente {
  id: string;
  tipo: Tipo;
  desc: string;
  cat: string;
  ico?: string;
  valor: number;
  dia: number;
  inicio: MonthKey;
  fim?: MonthKey;
  cartaoId?: string | null;
  /** Marca recorrentes criados pelo cadastro inicial (ex.: 'renda'). */
  onb?: string;
}

export interface Cartao {
  id: string;
  nome: string;
  fechamento: number;
  vencimento: number;
}

export interface Lancamento {
  id: string;
  tipo: Tipo;
  valor: number;
  cat: string;
  desc: string;
  data: ISODate;
  cartaoId?: string | null;
  parcelas?: number;
  /** Ícone sugerido pelo dicionário (ex.: 🐾); se ausente, usa o da categoria. */
  ico?: string;
  criado: number;
}

export interface Saldo {
  valor: number;
  data: ISODate;
  /** Momento em que o saldo foi informado (ms). */
  ts: number;
}

export interface Data {
  v: 1;
  onboarded: boolean;
  perfil: { nome: string };
  saldo: Saldo;
  recorrentes: Recorrente[];
  cartoes: Cartao[];
  lancamentos: Lancamento[];
  /** Contagem de uso por categoria, para ordenar sugestões. */
  uso: Record<string, number>;
  /** O que o app aprendeu com as escolhas do usuário: 'tipo|termo' → categoria/ícone. */
  aprendido?: Record<string, { cat: string; ico?: string; n: number }>;
}

/** Movimento de caixa já resolvido (data em que o dinheiro entra/sai da conta). */
export interface Evento {
  data: ISODate;
  valor: number;
  desc: string;
  cat: string;
  ico?: string;
  ref: string;
  fixo?: boolean;
  lanc?: boolean;
  cartao: string | null;
  criado: number;
}
