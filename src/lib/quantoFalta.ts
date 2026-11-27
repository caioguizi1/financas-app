/**
 * "Pra não ficar negativo" (v2.47): quanto precisa entrar (ou ser cortado) e até quando,
 * pra que nenhum dia dos próximos 90 fique abaixo de zero.
 *
 * A conta: somar X a partir do 1º dia negativo levanta todos os dias seguintes em X. Então basta
 * X = |ponto mais baixo| entrando até o 1º dia negativo. Se o saldo cai mês a mês (o buraco volta),
 * uma entrada única só adia — isso é sinalizado à parte.
 */
import type { Ponto } from './engine';
import type { ISODate } from './types';

export interface Trecho { inicio: Ponto; pior: Ponto; volta?: Ponto }
export interface QuantoFalta {
  /** quanto precisa entrar (ou ser cortado), em centavos */
  falta: number;
  /** até quando: o 1º dia no negativo */
  ate: ISODate;
  /** o ponto mais baixo dos 90 dias */
  pior: Ponto;
  /** dias com saldo negativo */
  dias: number;
  /** trechos negativos separados (sai do negativo e volta a ficar) */
  trechos: Trecho[];
  /** o saldo cai em média isso por mês (só quando cai) */
  quedaMes: number;
  /** o buraco volta: mais de um trecho negativo E o saldo cai mês a mês */
  repete: boolean;
}

export function trechosNegativos(pts: Ponto[]): Trecho[] {
  const out: Trecho[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].v >= 0) continue;
    let pior = pts[i], j = i;
    for (; j < pts.length && pts[j].v < 0; j++) if (pts[j].v < pior.v) pior = pts[j];
    out.push({ inicio: pts[i], pior, volta: pts[j] });
    i = j;
  }
  return out;
}

/** `fut`: projeção diária a partir de hoje (hoje incluído). `null` quando nenhum dia fica negativo. */
export function quantoFalta(fut: Ponto[]): QuantoFalta | null {
  const trechos = trechosNegativos(fut);
  if (!trechos.length) return null;
  const pior = trechos.reduce((a, t) => (t.pior.v < a.v ? t.pior : a), trechos[0].pior);
  const queda = fut.length > 1 ? ((fut[0].v - fut[fut.length - 1].v) / (fut.length - 1)) * 30 : 0;
  const quedaMes = queda > 0 ? Math.round(queda) : 0;
  return {
    falta: -pior.v,
    ate: trechos[0].inicio.d,
    pior,
    dias: fut.filter((p) => p.v < 0).length,
    trechos,
    quedaMes,
    repete: trechos.length > 1 && quedaMes > 0,
  };
}

/** abaixo disso (R$ 500), mesmo sem ficar negativo, a folga é "apertada" e o Início avisa em âmbar */
export const LIMITE_FOLGA = 50_000;

export interface FolgaApertada {
  /** o saldo no dia mais apertado (≥ 0) */
  folga: number;
  /** o dia mais apertado dos 90 */
  dia: ISODate;
}

/** Sem dia negativo, mas com o dia mais apertado abaixo de `limite`. `null` quando fica negativo ou está tranquilo. */
export function folgaApertada(fut: Ponto[], limite = LIMITE_FOLGA): FolgaApertada | null {
  if (!fut.length || fut.some((p) => p.v < 0)) return null;
  const min = fut.reduce((a, p) => (p.v < a.v ? p : a), fut[0]);
  return min.v < limite ? { folga: min.v, dia: min.d } : null;
}
