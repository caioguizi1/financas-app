/**
 * Histórico de fixos: uma alteração vale "a partir de" um mês.
 * A versão antiga é encerrada no mês anterior e uma nova versão (mesma série) começa no mês escolhido.
 * Nada do passado é reescrito — como numa GMUD, o registro anterior fica.
 */
import { addMonths } from './dates';
import { uid } from './money';
import type { MonthKey, Recorrente } from './types';

/** 'sempre' = corrigir um erro (reescreve todas as versões daquela linha). */
export type Vigencia = 'sempre' | MonthKey;

export const serieDe = (r: Recorrente) => r.serie ?? r.id;
export const versoes = (recs: Recorrente[], serie: string) =>
  recs.filter((r) => serieDe(r) === serie).sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
export const ativaEm = (r: Recorrente, mk: MonthKey) => r.inicio <= mk && (!r.fim || r.fim >= mk);

export function aplicarAlteracao(recs: Recorrente[], id: string, mudancas: Partial<Recorrente>, desde: Vigencia): Recorrente[] {
  const old = recs.find((r) => r.id === id);
  if (!old) return recs;
  const serie = serieDe(old);
  if (desde === 'sempre' || desde <= old.inicio) {
    return recs.map((r) => (r.id === id ? { ...r, ...mudancas, id: r.id, inicio: r.inicio, fim: r.fim, serie } : r));
  }
  const prox = versoes(recs, serie).find((r) => r.inicio > desde);
  const fimNova = prox ? addMonths(prox.inicio, -1) : old.fim && old.fim >= desde ? old.fim : undefined;
  const nova: Recorrente = { ...old, ...mudancas, id: uid(), serie, inicio: desde, fim: fimNova };
  return [...recs.map((r) => (r.id === id ? { ...r, serie, fim: addMonths(desde, -1) } : r)), nova];
}

/** Para de valer a partir de `desde` (some daí pra frente; o passado fica). */
export function encerrar(recs: Recorrente[], id: string, desde: MonthKey): Recorrente[] {
  const old = recs.find((r) => r.id === id);
  if (!old) return recs;
  const serie = serieDe(old);
  return recs
    .filter((r) => !(serieDe(r) === serie && r.inicio >= desde))
    .map((r) => (serieDe(r) === serie && (!r.fim || r.fim >= desde) ? { ...r, fim: addMonths(desde, -1) } : r));
}

export interface NovaRenda { desc: string; valor: number; dia: number }

/** Troca a renda do cadastro (salário/adiantamento) a partir de um mês, mantendo as séries pelo nome. */
export function substituirRenda(recs: Recorrente[], novas: NovaRenda[], desde: Vigencia, mesAtual: MonthKey): Recorrente[] {
  const atuais = recs.filter((r) => r.onb === 'renda' && (!r.fim || r.fim >= (desde === 'sempre' ? '0000-00' : desde)));
  const outros = recs.filter((r) => !atuais.includes(r));
  const inicioSempre = atuais.reduce((a, r) => (r.inicio < a ? r.inicio : a), mesAtual);
  const ini = desde === 'sempre' ? inicioSempre : desde;
  // versões antigas: encerra no mês anterior (ou some, se começariam depois)
  const encerradas = desde === 'sempre' ? [] : atuais
    .filter((r) => r.inicio < ini)
    .map((r) => ({ ...r, fim: addMonths(ini, -1), serie: serieDe(r) }));
  const novos: Recorrente[] = novas.map((n) => {
    const mesma = atuais.find((r) => r.desc === n.desc);
    return { id: uid(), onb: 'renda', tipo: 'entrada', cat: 'salario', desc: n.desc, valor: n.valor, dia: n.dia, inicio: ini, serie: mesma ? serieDe(mesma) : undefined };
  });
  return [...outros, ...encerradas, ...novos];
}
