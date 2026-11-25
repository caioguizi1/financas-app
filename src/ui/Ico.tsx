/**
 * Ícones de interface (menus, botões, dicas) — Lucide, mesmo traço da barra de abas.
 * Regra: o que é uma COISA do extrato (categoria, salário, 13º, extras) usa o mesmo emoji em todo lugar;
 * o que é AÇÃO ou AJUSTE usa ícone Lucide. Avisos usam <Aviso> (ui/Aviso.tsx).
 */
import {
  ArrowUpDown, Banknote, Barcode, BriefcaseBusiness, CalendarClock, CalendarDays, Camera, Coins, CreditCard, Download, FileDown, FileUp, Gift, Info, Landmark, ListFilter, LoaderCircle, Lock, Moon, PenLine, Receipt, RefreshCw, Repeat, RotateCcw, RotateCw, Sparkles, Sun, SunMoon, TrendingUp, TriangleAlert, Tv, Upload, UserRound, WalletCards, Zap, type LucideIcon,
} from 'lucide-react';
import type { Cartao } from '../lib/types';
import { corDoCartao, useImagemUrl } from '../lib/imagens';

export const ICONES = {
  nome: UserRound, carteira: WalletCards, importar: FileDown, saldo: Landmark, renda: BriefcaseBusiness, extras: Gift,
  exportar: Upload, restaurar: Download, sol: Sun, lua: Moon, auto: SunMoon,
  ordenar: ArrowUpDown, filtro: ListFilter,
  pix: Zap, boleto: Barcode, pixparc: Repeat, cartao: CreditCard, data: CalendarDays, cronograma: CalendarClock,
  fixo: Repeat, camera: Camera, padrao: RotateCcw, girar: RotateCw, mao: PenLine, previsto: Sparkles, sugerido: Sparkles,
  arquivo: FileUp, carregando: LoaderCircle, privado: Lock, parcelas: Receipt, semDuplicar: RefreshCw, assinatura: Tv,
  info: Info, porDia: Coins, alerta: TriangleAlert, alta: TrendingUp, dinheiro: Banknote,
} satisfies Record<string, LucideIcon>;
export type NomeIcone = keyof typeof ICONES;

/** Ícone de interface. Por padrão já vem com respiro à direita (ícone antes de texto);
 *  onde ele fica sozinho (quadradinho, círculo) ou o container usa `gap`, o CSS zera o respiro. */
export function Ico({ n, size = 18, className }: { n: NomeIcone; size?: number; className?: string }) {
  const C = ICONES[n];
  return <C size={size} strokeWidth={2} absoluteStrokeWidth={false} className={`ic-l${className ? ` ${className}` : ''}`} aria-hidden />;
}

/** Miniatura do cartão (cor da marca ou a arte enviada) — no lugar do 💳 genérico. */
export function CartaoMini({ c }: { c: Cartao }) {
  const img = useImagemUrl(c.id, true);
  const [a, b] = corDoCartao(c.nome);
  return <span className="cmini" style={img ? { backgroundImage: `url(${img})` } : { background: `linear-gradient(135deg, ${a}, ${b})` }} aria-hidden />;
}

/** Ícone das dicas "Pra você" pelo tipo da dica. */
export function icoDaDica(id: string): NomeIcone {
  if (id === 'dia') return 'porDia';
  if (id === 'aperto') return 'alerta';
  if (id.startsWith('cat-')) return 'alta';
  if (id.startsWith('rec-')) return 'fixo';
  if (id.startsWith('fat-')) return 'cartao';
  if (id === 'parc') return 'parcelas';
  if (id === 'ass') return 'assinatura';
  return 'info';
}
