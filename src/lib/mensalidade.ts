/**
 * "Provável mensalidade": um gasto que parece se repetir todo mês. O app PERGUNTA, não decide.
 * Tudo isto tem de bater (v2.41):
 *  - mesmo nome;
 *  - UMA cobrança por mês (o Uber cai aqui: aparece várias vezes no mês);
 *  - valor estável (variação de até 10%);
 *  - dia parecido (até 5 dias de diferença de um mês pro outro);
 *  - em 2 meses seguidos, o último sendo este mês ou o passado.
 * Fica de fora o que já é fixo (pelo nome, ou pelo mesmo valor e dia no mesmo cartão/conta)
 * e o que você já respondeu "Não é".
 */
import { addMonths, monthKey, parse } from './dates';
import { bateComFixo } from './recorrencia';
import { normalizar } from './smart';
import { ativaEm } from './versions';
import type { Data, ISODate, Lancamento } from './types';

export interface Provavel { chave: string; meses: string[]; valor: number; dia: number; ultimo: Lancamento }

export const chaveNaoMensal = (chave: string) => `naoMensal:${chave}`;

/** diferença entre dias do mês, dando a volta (30 e 2 = 3 dias) */
const difDia = (a: number, b: number) => { const d = Math.abs(a - b); return Math.min(d, 31 - d); };

export function provaveisMensalidades(D: Data, hoje: ISODate): Provavel[] {
  const mk = monthKey(hoje);
  const janela = new Set([mk, addMonths(mk, -1), addMonths(mk, -2), addMonths(mk, -3)]);
  const dispensados = new Set(D.dispensados ?? []);
  const ativos = D.recorrentes.filter((r) => r.tipo === 'saida' && (!r.fim || r.fim >= mk));
  const nomesFixos = new Set(ativos.map((r) => normalizar(r.desc)));

  const grupos = new Map<string, Lancamento[]>();
  for (const l of D.lancamentos) {
    if (l.tipo !== 'saida' || !l.desc?.trim() || (l.parcelas ?? 1) > 1 || !janela.has(monthKey(l.data))) continue;
    const k = normalizar(l.desc);
    if (!k) continue;
    grupos.set(k, [...(grupos.get(k) ?? []), l]);
  }

  const out: Provavel[] = [];
  for (const [chave, ls] of grupos) {
    if (nomesFixos.has(chave) || dispensados.has(chaveNaoMensal(chave))) continue;
    const porMes = new Map<string, Lancamento[]>();
    for (const l of ls) porMes.set(monthKey(l.data), [...(porMes.get(monthKey(l.data)) ?? []), l]);
    if ([...porMes.values()].some((x) => x.length > 1)) continue; // mais de uma no mês: não é mensalidade
    const meses = [...porMes.keys()].sort();
    const [a, b] = meses.slice(-2);
    if (!a || !b || addMonths(a, 1) !== b || b < addMonths(mk, -1)) continue; // 2 meses seguidos, recentes
    const ordenados = meses.map((m) => porMes.get(m)![0]);
    const valores = ordenados.map((l) => l.valor);
    if (Math.max(...valores) > Math.min(...valores) * 1.1) continue; // valor varia demais
    const dias = ordenados.map((l) => parse(l.data).getDate());
    if (dias.some((d, i) => i > 0 && difDia(d, dias[i - 1]) > 5)) continue; // dia muda demais
    const ultimo = ordenados[ordenados.length - 1];
    // já é fixo com outro nome? (mesmo valor ±1%, dia parecido, mesmo cartão ou conta)
    const jaFixo = ativos.some((r) => ativaEm(r, monthKey(ultimo.data)) && Math.abs(r.valor - ultimo.valor) <= r.valor * 0.01
      && bateComFixo(r, ultimo.data) && (r.cartaoId ?? null) === (ultimo.cartaoId ?? null));
    if (jaFixo) continue;
    out.push({ chave, meses, valor: ultimo.valor, dia: parse(ultimo.data).getDate(), ultimo });
  }
  return out.sort((x, y) => y.valor - x.valor);
}
