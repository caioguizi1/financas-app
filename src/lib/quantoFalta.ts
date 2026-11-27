/**
 * "Pra não ficar negativo": quanto precisa entrar (ou ser cortado) e ATÉ QUANDO, pra que nenhum dia dos
 * próximos 90 fique abaixo de zero.
 *
 * De onde vêm os números: a projeção diária do Início (engine.projecao) — saldo informado + o que entra e
 * sai em cada dia: fixos, lançamentos futuros, parcelas, faturas dos cartões e a estimativa do gasto típico
 * dos cartões ainda não lançado.
 *
 * A conta (v2.49): o saldo fica negativo em "vezes" (trechos). Em cada vez, o que precisa estar na conta é o
 * quanto ela fica abaixo de zero no pior dia DAQUELA vez — e precisa estar lá quando a vez começa (dali até o
 * pior dia o saldo só piora). Dinheiro que entra fica: o que cobriu uma vez continua cobrindo as seguintes.
 * Então o cronograma é o máximo acumulado: vez a vez, entra só a diferença para a vez mais funda até ali.
 * O total é o pior dia dos 90; o prazo do total é o começo da vez mais funda (antes, v2.47–2.48, o total
 * inteiro era cobrado até o 1º dia negativo, mesmo quando esse 1º buraco era pequeno).
 */
import type { Ponto } from './engine';
import type { ISODate } from './types';

export interface Trecho { inicio: Ponto; pior: Ponto; volta?: Ponto }
/** uma parcela do que falta: quanto entrar (a mais) até o começo de uma vez no negativo */
export interface Etapa { ate: ISODate; valor: number; acumulado: number; trecho: number }
export interface QuantoFalta {
  /** quanto precisa entrar (ou ser cortado) no total, em centavos: |pior dia dos 90| */
  falta: number;
  /** até quando o total precisa estar na conta: o começo da vez mais funda */
  ate: ISODate;
  /** o 1º dia no negativo */
  primeiroNeg: ISODate;
  /** cronograma: quanto entrar até o começo de cada vez (só as que pedem dinheiro a mais) */
  etapas: Etapa[];
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
  const etapas: Etapa[] = [];
  let acc = 0;
  trechos.forEach((t, k) => {
    const precisa = -t.pior.v;
    if (precisa > acc) { etapas.push({ ate: t.inicio.d, valor: precisa - acc, acumulado: precisa, trecho: k }); acc = precisa; }
  });
  return {
    falta: -pior.v,
    ate: etapas[etapas.length - 1].ate,
    primeiroNeg: trechos[0].inicio.d,
    etapas,
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
