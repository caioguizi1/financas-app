/**
 * Avisos com nível de gravidade (padrão "opção 3", decidido em 23/11/2026):
 * ícone Lucide na cor do nível, dentro de um círculo tingido. Só `grave` ganha a
 * versão forte (círculo cheio, borda forte) — reservada ao saldo projetado negativo,
 * pra não gerar fadiga de alerta. O positivo fica discreto de propósito.
 */
import type { ReactNode } from 'react';
import { CircleAlert, Lightbulb, Lock, TriangleAlert, type LucideIcon } from 'lucide-react';

export type NivelAviso = 'grave' | 'atencao' | 'bom' | 'info';

const ICONE: Record<NivelAviso, LucideIcon> = { grave: TriangleAlert, atencao: CircleAlert, bom: Lightbulb, info: Lock };

export function Aviso({ nivel, children, style }: { nivel: NivelAviso; children: ReactNode; style?: React.CSSProperties }) {
  const I = ICONE[nivel];
  return (
    <div className={`alert av ${nivel}${nivel === 'grave' ? ' forte' : ''}`} role={nivel === 'grave' ? 'alert' : 'status'} style={style}>
      <span className="ic"><I size={18} strokeWidth={2.2} aria-hidden /></span>
      <div>{children}</div>
    </div>
  );
}
