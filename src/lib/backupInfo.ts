import { today } from './dates';

/** Dias desde o último backup (null = nunca fez). */
export function diasSemBackup(backupEm: string | undefined, hoje = today()): number | null {
  if (!backupEm) return null;
  return Math.round((new Date(hoje + 'T12:00').getTime() - new Date(backupEm + 'T12:00').getTime()) / 86400000);
}

/** Hora de lembrar: nunca fez (e já tem uso de verdade) ou faz mais de 30 dias. */
export function lembrarBackup(D: { backupEm?: string; lancamentos: unknown[]; recorrentes: unknown[] }, hoje = today()): boolean {
  const n = diasSemBackup(D.backupEm, hoje);
  if (n === null) return D.lancamentos.length + D.recorrentes.length >= 10;
  return n > 30;
}
