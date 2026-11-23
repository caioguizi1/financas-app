import type { ISODate, MonthKey } from './types';

export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date): ISODate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: ISODate) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const today = (): ISODate => ymd(new Date());
/** Dias no mês (m começa em 0; aceita meses fora de 0–11). */
export const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** Data do dia `day` no mês (y, m), limitada ao último dia do mês. m pode transbordar. */
export function dateOf(y: number, m: number, day: number): ISODate {
  const b = new Date(y, m, 1);
  const yy = b.getFullYear();
  const mm = b.getMonth();
  return ymd(new Date(yy, mm, Math.min(day, daysInMonth(yy, mm))));
}
export const addDays = (s: ISODate, n: number): ISODate => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const monthKey = (s: ISODate): MonthKey => s.slice(0, 7);

export const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MESL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const DSEM = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export const dm = (s: ISODate) => {
  const d = parse(s);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

export function diaLabel(s: ISODate, hoje: ISODate = today()) {
  if (s === hoje) return 'Hoje';
  if (s === addDays(hoje, 1)) return 'Amanhã';
  if (s === addDays(hoje, -1)) return 'Ontem';
  const d = parse(s);
  return `${DSEM[d.getDay()]}, ${d.getDate()} ${MES[d.getMonth()]}`;
}

export function saudacao(h = new Date().getHours()) {
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

/** Soma meses a um YYYY-MM. */
export const addMonths = (mk: MonthKey, n: number): MonthKey => {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
/** "dez/26" */
export const mesCurto = (mk: MonthKey) => `${MES[+mk.slice(5) - 1]}/${mk.slice(2, 4)}`;
