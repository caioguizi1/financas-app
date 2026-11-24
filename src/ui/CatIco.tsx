/**
 * Figura de categoria. Estilo padrão: ícone Lucide na cor da categoria, em círculo tingido
 * (decidido em 23/11/2026, "Estilo B"). Opcional: o emoji de antes (Ajustes › Aparência).
 * O emoji continua sendo o dado salvo; aqui ele só é traduzido para o ícone equivalente.
 */
import { useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import {
  Banknote, Beer, Bike, BookOpen, Bot, Brain, BriefcaseBusiness, Brush, Building2, BusFront, CarFront, Clapperboard, Cloud, Coffee,
  CreditCard, Croissant, Droplet, Dumbbell, Ellipsis, FileText, Fish, Flame, Footprints, Fuel, Gamepad2, Gift, Glasses, Hammer,
  Handshake, Heart, Hotel, House, IceCreamCone, KeyRound, Landmark, Laptop, Lightbulb, Mic, Music, Package, PartyPopper, PawPrint,
  Pill, Pizza, Plane, ReceiptText, Scissors, ShieldCheck, Shirt, ShoppingBag, ShoppingCart, Smartphone, Smile, Sofa, Sparkles,
  SquareParking, Star, Stethoscope, Tag, Ticket, TramFront, TreePalm, TrendingUp, Trophy, Tv, Undo2, Utensils, Volleyball,
  WashingMachine, Wifi, Wrench, type LucideIcon,
} from 'lucide-react';
import { catE } from '../lib/categories';
import { assinarEstiloIco, getEstiloIco } from '../lib/estiloIco';

/** Cor de cada categoria (entradas todas no verde da renda). */
export const COR_CAT: Record<string, string> = {
  salario: '#5fe3b3', extra: '#5fe3b3', reembolso: '#5fe3b3', outros_in: '#5fe3b3',
  mercado: '#9fd65a', comida: '#ff9a6b', transporte: '#6aa9ff', casa: '#f2a65b', contas: '#58c4dc', saude: '#ff7a9c',
  lazer: '#c792ea', compras: '#f78fb3', assinaturas: '#a497ff', educacao: '#f2c94c', pets: '#e3b071', beleza: '#ff9ad5',
  viagem: '#4fd1c5', outros: '#9d97b8', fatura: '#9a8cff',
};
const ICO_CAT: Record<string, LucideIcon> = {
  salario: BriefcaseBusiness, extra: Laptop, reembolso: Undo2, outros_in: Sparkles, mercado: ShoppingCart, comida: Utensils,
  transporte: CarFront, casa: House, contas: Lightbulb, saude: Pill, lazer: PartyPopper, compras: ShoppingBag, assinaturas: Tv,
  educacao: BookOpen, pets: PawPrint, beleza: Scissors, viagem: Plane, outros: Ellipsis, fatura: CreditCard,
};
/** Emoji salvo → ícone equivalente (o que não estiver aqui usa o ícone da categoria). */
const ICO_EMOJI: Record<string, LucideIcon> = {
  '🛒': ShoppingCart, '🍔': Utensils, '🥐': Croissant, '🍕': Pizza, '🍣': Fish, '🍦': IceCreamCone, '🍺': Beer, '☕': Coffee,
  '🚗': CarFront, '⛽': Fuel, '🅿️': SquareParking, '🚇': TramFront, '🚌': BusFront, '🛴': Bike, '🔧': Wrench,
  '🏠': House, '🏢': Building2, '🔨': Hammer, '🛋️': Sofa, '🧹': Brush, '🔑': KeyRound,
  '💡': Lightbulb, '🔥': Flame, '🚿': Droplet, '📶': Wifi, '📱': Smartphone, '🏛️': FileText, '🛡️': ShieldCheck, '🏦': Landmark,
  '💊': Pill, '🩺': Stethoscope, '🦷': Smile, '🏋️': Dumbbell, '👓': Glasses, '🧠': Brain,
  '🎉': PartyPopper, '🎬': Clapperboard, '🎤': Mic, '🎮': Gamepad2, '⚽': Volleyball, '🎳': Ticket, '🏩': Heart,
  '🛍️': ShoppingBag, '🎁': Gift, '👟': Footprints, '👕': Shirt, '📦': Package, '🧺': WashingMachine, '💻': Laptop,
  '📺': Tv, '🎵': Music, '☁️': Cloud, '🤖': Bot, '📚': BookOpen, '🐾': PawPrint, '💇': Scissors, '💈': Scissors, '💅': Sparkles,
  '✈️': Plane, '🏨': Hotel, '🏖️': TreePalm, '💼': BriefcaseBusiness, '🎄': Gift, '🏆': Trophy, '⭐': Star, '🦁': ReceiptText,
  '✨': Sparkles, '🏷️': Tag, '📈': TrendingUp, '↩️': Undo2, '🤝': Handshake, '💸': Banknote, '•': Ellipsis, '💳': CreditCard,
};

export const useEstiloIco = () => useSyncExternalStore(assinarEstiloIco, getEstiloIco, getEstiloIco);
const corDe = (cat: string) => COR_CAT[cat] ?? COR_CAT.outros;
const icoDe = (cat: string, ico?: string) => (ico && ICO_EMOJI[ico]) || ICO_CAT[cat] || Ellipsis;

/** Figura em linha (chips, listas compactas, sugestão): emoji ou ícone colorido. */
export function CatGlyph({ cat, ico, size = 16 }: { cat: string; ico?: string; size?: number }) {
  const estilo = useEstiloIco();
  if (estilo === 'emoji') return <span className="emo" aria-hidden>{ico || catE(cat)}</span>;
  const I = icoDe(cat, ico);
  return <I size={size} strokeWidth={2} className="cat-g" style={{ ['--c' as string]: corDe(cat) } as CSSProperties} aria-hidden />;
}

/** Quadradinho/círculo das listas (extrato, fixos, parcelas, importação). */
export function CatTile({ cat, ico, onClick, children }: { cat: string; ico?: string; onClick?: () => void; children?: ReactNode }) {
  const estilo = useEstiloIco();
  const Tag = onClick ? 'button' : 'div';
  if (children) return <Tag className="ico" onClick={onClick}>{children}</Tag>;
  if (estilo === 'emoji') return <Tag className="ico" onClick={onClick}>{ico || catE(cat)}</Tag>;
  const I = icoDe(cat, ico);
  return <Tag className="ico cat" style={{ ['--c' as string]: corDe(cat) } as CSSProperties} onClick={onClick}><I size={19} strokeWidth={2} aria-hidden /></Tag>;
}

/** Texto com a figura na frente, para toasts e títulos (só emoji no modo emoji). */
export const comFigura = (ico: string, texto: string) => (getEstiloIco() === 'emoji' ? `${ico} ${texto}` : texto);
