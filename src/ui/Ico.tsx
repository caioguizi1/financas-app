/**
 * Ícones de interface (menus, botões, dicas) — Lucide, mesmo traço da barra de abas.
 * Emoji fica só onde identifica CATEGORIA de gasto e nos avisos (⚠️ 🔒 💡).
 */
import {
  Banknote, Barcode, BriefcaseBusiness, CalendarClock, CalendarDays, Camera, Coins, CreditCard, Download, FileDown,
  FileUp, Gift, Info, Landmark, LoaderCircle, Lock, Moon, PenLine, Receipt, RefreshCw, Repeat, RotateCcw, RotateCw,
  Sparkles, Sun, Tv, TrendingUp, TriangleAlert, Upload, UserRound, WalletCards, Zap, type LucideIcon,
} from 'lucide-react';
import type { Cartao } from '../lib/types';
import { corDoCartao, useImagem } from '../lib/imagens';

export const ICONES = {
  nome: UserRound, carteira: WalletCards, importar: FileDown, saldo: Landmark, renda: BriefcaseBusiness, extras: Gift,
  exportar: Upload, restaurar: Download, sol: Sun, lua: Moon,
  pix: Zap, boleto: Barcode, pixparc: Repeat, cartao: CreditCard, data: CalendarDays, cronograma: CalendarClock,
  fixo: Repeat, camera: Camera, padrao: RotateCcw, girar: RotateCw, mao: PenLine, previsto: Sparkles, sugerido: Sparkles,
  arquivo: FileUp, carregando: LoaderCircle, privado: Lock, parcelas: Receipt, semDuplicar: RefreshCw, assinatura: Tv,
  info: Info, porDia: Coins, alerta: TriangleAlert, alta: TrendingUp, dinheiro: Banknote,
} satisfies Record<string, LucideIcon>;
export type NomeIcone = keyof typeof ICONES;

export function Ico({ n, size = 18, className }: { n: NomeIcone; size?: number; className?: string }) {
  const C = ICONES[n];
  return <C size={size} strokeWidth={2} absoluteStrokeWidth={false} className={className} aria-hidden />;
}

/** Miniatura do cartão (cor da marca ou a arte enviada) — no lugar do 💳 genérico. */
export function CartaoMini({ c }: { c: Cartao }) {
  const img = useImagem(c.id);
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
