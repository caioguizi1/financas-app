/**
 * Cálculo de folha (CLT) — tabelas vigentes em 2026. Valores em CENTAVOS.
 *
 * Fontes:
 * - INSS: Portaria Interministerial MPS/MF nº 13/2026 (faixas progressivas, teto R$ 8.475,55)
 * - IRRF mensal: tabela da Receita Federal (Lei 15.191/2025) + redução da Lei 15.270/2025
 *   (isenção efetiva até R$ 5.000; redução decrescente até R$ 7.350; também no 13º — art. 3º-A, §3º)
 * - Dependente R$ 189,59; desconto simplificado mensal R$ 607,20
 * - PLR: tabela exclusiva anual da Receita (desde maio/2025), sem INSS
 *
 * É uma ESTIMATIVA: convenções, pensão, faltas, horas extras etc. mudam o holerite real.
 */

export const TABELAS_ANO = 2026;

const INSS_FAIXAS: [teto: number, aliq: number][] = [[1621.0, 0.075], [2902.84, 0.09], [4354.27, 0.12], [8475.55, 0.14]];
const IR_MENSAL: [ate: number, aliq: number, deducao: number][] = [
  [2428.8, 0, 0], [2826.65, 0.075, 182.16], [3751.05, 0.15, 394.16], [4664.68, 0.225, 675.49], [Infinity, 0.275, 908.73],
];
const IR_PLR: [ate: number, aliq: number, deducao: number][] = [
  [8214.4, 0, 0], [9922.28, 0.075, 616.08], [13167.0, 0.15, 1360.25], [16380.38, 0.225, 2347.78], [Infinity, 0.275, 3166.8],
];
const DEPENDENTE = 189.59;
const SIMPLIFICADO = 607.2;
const RED_ISENTO_ATE = 5000.0;
const RED_ATE = 7350.0;
const RED_A = 978.62;
const RED_B = 0.133145;

const cents = (reais: number) => Math.round(reais * 100 + 1e-7); // arredonda meio centavo pra cima, como as folhas
const reais = (c: number) => c / 100;

/** INSS do empregado, progressivo por faixa, limitado ao teto. */
export function inss(brutoC: number): number {
  const b = reais(brutoC);
  let total = 0, piso = 0;
  for (const [teto, aliq] of INSS_FAIXAS) {
    if (b <= piso) break;
    total += (Math.min(b, teto) - piso) * aliq;
    piso = teto;
  }
  return cents(total);
}

const tabela = (base: number, t: typeof IR_MENSAL) => {
  const f = t.find(([ate]) => base <= ate)!;
  return Math.max(0, base * f[1] - f[2]);
};

/** Redução da Lei 15.270/2025, calculada sobre o rendimento tributável BRUTO. */
export function reducao15270(brutoC: number, impostoC: number): number {
  const b = reais(brutoC);
  if (b <= RED_ISENTO_ATE) return impostoC;
  if (b > RED_ATE) return 0;
  return Math.min(impostoC, Math.max(0, cents(RED_A - RED_B * b)));
}

export interface IR { base: number; tabela: number; reducao: number; devido: number; simplificado: boolean }

/**
 * IRRF mensal. `deducoesC` = INSS + dependentes (+ pensão etc.).
 * Usa o desconto simplificado (R$ 607,20) quando for mais vantajoso — como as folhas fazem.
 */
export function irrfMensal(brutoC: number, deducoesC: number, opts: { simplificado?: boolean } = { simplificado: true }): IR {
  const simp = opts.simplificado !== false && cents(SIMPLIFICADO) > deducoesC;
  const base = Math.max(0, brutoC - (simp ? cents(SIMPLIFICADO) : deducoesC));
  const imp = cents(tabela(reais(base), IR_MENSAL));
  const red = reducao15270(brutoC, imp);
  return { base, tabela: imp, reducao: red, devido: imp - red, simplificado: simp };
}

export interface Holerite { bruto: number; inss: number; ir: IR; outros: number; liquido: number }

/** Salário mensal: bruto → INSS → IRRF (com redução) → outros descontos → líquido. */
export function holerite(brutoC: number, dependentes = 0, outrosC = 0): Holerite {
  const i = inss(brutoC);
  const ir = irrfMensal(brutoC, i + cents(DEPENDENTE) * dependentes);
  return { bruto: brutoC, inss: i, ir, outros: outrosC, liquido: brutoC - i - ir.devido - outrosC };
}

/** Bruto mensal que resulta neste líquido (inverso do holerite, por busca binária). Sem bruto informado, é a melhor estimativa. */
export function brutoDoLiquido(liquidoC: number, dependentes = 0): number {
  let lo = liquidoC, hi = liquidoC * 2;
  for (let k = 0; k < 40 && hi - lo > 1; k++) {
    const mid = Math.round((lo + hi) / 2);
    if (holerite(mid, dependentes).liquido < liquidoC) lo = mid; else hi = mid;
  }
  return hi;
}

export interface Decimo { bruto: number; parcela1: number; inss: number; ir: IR; parcela2: number; liquido: number }

/**
 * 13º salário: bruto proporcional aos meses (avos). 1ª parcela = metade, sem descontos.
 * 2ª parcela = resto − INSS e IR sobre o 13º integral (tributação exclusiva, com a redução da Lei 15.270).
 * No 13º não se aplica o desconto simplificado mensal — só deduções legais.
 */
export function decimoTerceiro(salarioBrutoC: number, dependentes = 0, meses = 12): Decimo {
  const bruto = Math.round((salarioBrutoC * Math.min(12, Math.max(0, meses))) / 12);
  const p1 = Math.round(bruto / 2);
  const i = inss(bruto);
  const ir = irrfMensal(bruto, i + cents(DEPENDENTE) * dependentes, { simplificado: false });
  const p2 = bruto - p1 - i - ir.devido;
  return { bruto, parcela1: p1, inss: i, ir, parcela2: p2, liquido: p1 + p2 };
}

/** IR da PLR pela tabela exclusiva anual. `anteriorC` = PLR bruta já recebida no mesmo ano. */
export function irPLR(brutoC: number, anteriorC = 0): number {
  const total = cents(tabela(reais(brutoC + anteriorC), IR_PLR));
  const jaRetido = cents(tabela(reais(anteriorC), IR_PLR));
  return Math.max(0, total - jaRetido);
}

/** Antecipa pagamentos que caem em fim de semana pra sexta (prazos legais do 13º). */
export function diaUtilAntes(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = dt.getDay();
  if (wd === 6) dt.setDate(d - 1);
  if (wd === 0) dt.setDate(d - 2);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
