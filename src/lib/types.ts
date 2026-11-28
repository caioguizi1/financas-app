/** Data no formato YYYY-MM-DD (horário local). */
export type ISODate = string;
/** Mês no formato YYYY-MM. */
export type MonthKey = string;
export type Tipo = 'entrada' | 'saida';
/** Forma de pagamento. pix = Pix/débito (sai na hora); credito usa cartaoId. */
export type Meio = 'pix' | 'boleto' | 'pixparc' | 'credito';

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
  /** Forma de pagamento (saídas). Cartão = cartaoId. */
  meio?: Meio;
  /** Marca recorrentes criados pelo cadastro inicial (ex.: 'renda'). */
  onb?: string;
  /** Versões do mesmo fixo compartilham a série (histórico de valores). Padrão: o próprio id. */
  serie?: string;
  /** Frequência: sem campo = todo mês (como sempre foi). */
  freq?: 'semanal' | 'anual';
  /** Semanal: dia da semana (0 = domingo … 6 = sábado). */
  semana?: number;
  /** Anual: mês (1–12); o dia fica em `dia`. */
  mes?: number;
  /**
   * v2.54 · Semanal fora do cartão: as sessões do mês são pagas JUNTAS, nesse dia do mesmo mês
   * (31 vira o último dia). Valor = sessões do mês (sem as pausadas) × `valor`.
   */
  agrupar?: { dia: number };
  /**
   * v2.54 · Semanal: parte do que foi pago volta (ex.: 100% do convênio), no dia `dia` do MÊS SEGUINTE às sessões.
   * O app conta com ele só nesse dia (o último provável, o lado seguro). `datas`: quando caiu antes (ou a nova
   * previsão, se atrasou), por mês das sessões.
   */
  reembolso?: { pct: number; dia: number; datas?: Record<MonthKey, ISODate> };
  /** v2.54 · Períodos sem ocorrência (ex.: férias). Datas inclusivas. */
  pausas?: { de: ISODate; ate: ISODate }[];
  /** Quando foi criado (ms). No dia em que o saldo foi informado, a ocorrência de um fixo criado DEPOIS
   *  desconta (como um lançamento); sem isso, contava como "já estava no saldo do banco" (v2.42). */
  criado?: number;
}

export interface Cartao {
  id: string;
  nome: string;
  fechamento: number;
  vencimento: number;
  /** Gasto típico por fatura (centavos). Preenche faturas futuras com uma estimativa. */
  estimativa?: number;
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
  meio?: Meio;
  /** Parcelado fora do cartão: meses até a 1ª parcela (0 = na data da compra, 1 = mês seguinte). */
  adiar?: number;
  /** Valor bruto (ex.: PLR), quando o lançamento guarda o líquido. */
  bruto?: number;
  /** Cartão: vencimento da fatura da 1ª parcela, quando conhecido (importação). Tem prioridade sobre a regra de fechamento. */
  fatura?: ISODate;
  /** Ícone sugerido pelo dicionário (ex.: 🐾); se ausente, usa o da categoria. */
  ico?: string;
  /** Veio de fatura/extrato importado: só esses têm o nome do banco limpo na exibição.
   *  O que você digita aparece exatamente como digitou. */
  importado?: boolean;
  /** Compra pulada (PicPay "FIN" = Pula Compra): paga depois, às vezes parcelada no app. Gasto de outro mês, não compra nova. */
  adiado?: boolean;
  /** Vencimento da fatura em que o "FIN" apareceu: só nela a compra conta como pulada; nas parcelas seguintes é parcela normal. */
  adiadoEm?: ISODate;
  criado: number;
}

export interface Saldo {
  valor: number;
  data: ISODate;
  /** Momento em que o saldo foi informado (ms). */
  ts: number;
  /** Movimentos previstos para o próprio dia do saldo que AINDA NÃO tinham caído quando ele foi informado (`ref|data`). */
  pendentes?: string[];
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
  /** Salário bruto informado em Minha renda (para calcular INSS, IR, 13º). */
  folha?: { bruto: number; dependentes: number; outros: number };
  /** Fatura paga/agendada fora do vencimento: 'cartaoId|vencimento' → data e momento. */
  /** Correções únicas já aplicadas aos dados. */
  migracoes?: string[];
  /** Dia do último backup exportado (pro lembrete em Ajustes). */
  backupEm?: ISODate;
  /** Nomes de loja corrigidos pelo usuário (descritor normalizado → nome). */
  nomes?: Record<string, string>;
  /** Faturas/extratos importados (histórico por cartão). */
  importacoes?: Importacao[];
  pagFaturas?: Record<string, { data: ISODate; ts: number }>;
  /** Avisos que o usuário dispensou (ex.: '13-2026'). */
  dispensados?: string[];
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
  cartaoId?: string;
  /** Vencimento original da fatura (compras de cartão), mesmo se paga em outra data. */
  venc?: ISODate;
  /** Estimativa de gasto típico (não é um lançamento real). */
  estimativa?: boolean;
  /** Compra pulada, na fatura em que o "FIN" apareceu (ver Lancamento.adiado). */
  adiado?: boolean;
  /** Parcela i de n (só compras parceladas). */
  parcela?: { i: number; n: number };
  /** Item agrupado (fatura): as compras que o compõem. */
  itens?: Evento[];
  /** Fixo por sessão (v2.54): quantas sessões este pagamento/reembolso cobre. */
  sessoes?: number;
  /** Reembolso de um fixo (v2.54): de qual fixo e de qual mês de sessões. */
  reembolso?: { rec: string; mk: MonthKey };
  criado: number;
}

/** Registro de uma importação de fatura (ou extrato). */
export interface Importacao {
  id: string;
  tipo: 'fatura' | 'extrato';
  cartaoId?: string;
  /** Vencimento da fatura importada (quando conhecido). */
  venc?: ISODate;
  fechamento?: ISODate;
  arquivo?: string;
  /** Compras da fatura (centavos). */
  total: number;
  /** Total impresso pelo banco, quando o PDF informa — e se bateu com o lido. */
  totalBanco?: number;
  conferida?: boolean;
  /** Lançamentos criados (permite desfazer a importação). */
  ids: string[];
  quando: number;
  /** Reconstruída a partir dos lançamentos (importação feita antes do histórico existir). */
  inferida?: boolean;
}
