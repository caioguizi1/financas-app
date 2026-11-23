/**
 * Recebimentos extras típicos do mercado de trabalho brasileiro.
 * Valores e datas são sugestões editáveis — cada empresa/acordo tem suas regras.
 */
import { dateOf } from './dates';
import { diaUtilAntes } from './folha';

export interface ParcelaModelo { label: string; pct: number; data: (hoje: string) => string }
export interface ExtraModelo {
  k: string; nome: string; ico: string; cat: 'salario' | 'extra';
  /** % calculado sobre a renda mensal (líquida) cadastrada. */
  parcelas: ParcelaModelo[];
  /** Permite escolher 1 ou 2 parcelas. */
  divisivel?: boolean;
  nota: string;
}

/** Próxima ocorrência de dia/mês a partir de hoje (este ano ou o próximo). */
export function proxData(hoje: string, mes: number, dia: number) {
  const y = +hoje.slice(0, 4);
  const d = dateOf(y, mes, dia);
  return d >= hoje ? d : dateOf(y + 1, mes, dia);
}
const emDias = (hoje: string, n: number) => { const d = new Date(+hoje.slice(0, 4), +hoje.slice(5, 7) - 1, +hoje.slice(8, 10) + n); return dateOf(d.getFullYear(), d.getMonth(), d.getDate()); };

/** Ano do 13º: segue o ciclo nov/dez; depois de 20/12 vira o do ano seguinte. */
export function ano13(hoje: string) {
  const y = +hoje.slice(0, 4);
  return hoje > `${y}-12-20` ? y + 1 : y;
}

export const EXTRAS: ExtraModelo[] = [
  {
    k: '13', nome: '13º salário', ico: '🎄', cat: 'salario',
    parcelas: [
      { label: '1ª parcela', pct: 0.5, data: (h) => diaUtilAntes(dateOf(ano13(h), 10, 30)) },
      { label: '2ª parcela', pct: 0.5, data: (h) => diaUtilAntes(dateOf(ano13(h), 11, 20)) },
    ],
    nota: 'Pela CLT, a 1ª parcela sai até 30/nov, sem descontos; a 2ª até 20/dez (antes, se cair no fim de semana), com INSS e IR do 13º inteiro — por isso é menor.',
  },
  {
    k: 'plr', nome: 'PLR', ico: '🏆', cat: 'extra', divisivel: true,
    parcelas: [
      { label: '1ª parcela', pct: 0, data: (h) => proxData(h, 1, 28) },
      { label: '2ª parcela', pct: 0, data: (h) => proxData(h, 7, 30) },
    ],
    nota: 'Informe o valor BRUTO: o app desconta o IR pela tabela exclusiva da PLR (sem INSS; isenta até R$ 8.214,40 no ano). Datas dependem do acordo da sua empresa.',
  },
  {
    k: 'ferias', nome: 'Férias (1/3)', ico: '🏖️', cat: 'salario',
    parcelas: [{ label: 'Adicional de 1/3', pct: 1 / 3, data: (h) => emDias(h, 30) }],
    nota: 'O 1/3 é o que entra a mais. O salário das férias é pago até 2 dias antes de sair — e o salário do mês seguinte costuma vir menor.',
  },
  {
    k: 'bonus', nome: 'Bônus', ico: '⭐', cat: 'extra', divisivel: true,
    parcelas: [
      { label: '1ª parcela', pct: 0, data: (h) => emDias(h, 30) },
      { label: '2ª parcela', pct: 0, data: (h) => emDias(h, 60) },
    ],
    nota: 'Bônus por meta, de contratação ou retenção.',
  },
  {
    k: 'ir', nome: 'Restituição do IR', ico: '🦁', cat: 'extra',
    parcelas: [{ label: 'Restituição', pct: 0, data: (h) => proxData(h, 4, 31) }],
    nota: 'A Receita paga em lotes, geralmente de maio a setembro.',
  },
  {
    k: 'outro', nome: 'Outro extra', ico: '✨', cat: 'extra', divisivel: true,
    parcelas: [
      { label: '1ª parcela', pct: 0, data: (h) => emDias(h, 30) },
      { label: '2ª parcela', pct: 0, data: (h) => emDias(h, 60) },
    ],
    nota: 'Qualquer dinheiro previsto: venda, acerto, prêmio…',
  },
];

