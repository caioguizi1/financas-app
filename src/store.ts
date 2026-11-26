import { create } from 'zustand';
import type { Simulacao } from './lib/simulador';
import type { ReactNode } from 'react';
import { today } from './lib/dates';
import { regraFixa } from './lib/smart';
import { inferir as inferirImportacoes } from './lib/importacoes';
import { diaDoCiclo } from './lib/faturas';
import type { Data } from './lib/types';

/* ---------- dados (persistidos no aparelho) ---------- */
// Mesma chave da v1: quem já usa o app não perde nada na migração.
const KEY = 'fluxo.v1';

export const blank = (): Data => ({
  v: 1, onboarded: false, perfil: { nome: '' },
  saldo: { valor: 0, data: today(), ts: Date.now() },
  recorrentes: [], cartoes: [], lancamentos: [], uso: {}, aprendido: {},
});

/** Atualiza dados de versões antigas sem perder nada. */
function migrar(d: Data): Data {
  const lancamentos = d.lancamentos.map((l) => {
    if (l.cartaoId || l.cat !== 'fatura' || !l.desc.endsWith('(já gasto)')) return l;
    const c = d.cartoes.find((x) => l.desc === `Fatura ${x.nome} (já gasto)`);
    return c ? { ...l, cartaoId: c.id, meio: 'credito' as const, data: diaDoCiclo(c, l.data), ico: '💳' } : l;
  });
  return faturaDoPulo(marcarImportados(historicoImportacoes(corrigirCategorias({ ...d, lancamentos }))));
}

/**
 * Uma vez (v2.26): compras puladas (FIN) marcadas antes de o app guardar EM QUAL fatura o FIN apareceu.
 * Usa a importação que trouxe a marca (a fatura reimportada). Sem ela, a marca vale em todas as parcelas, como antes.
 */
function faturaDoPulo(d: Data): Data {
  const ID = 'fatura-do-pulo';
  if (d.migracoes?.includes(ID)) return d;
  const vencDe = new Map<string, string>();
  for (const r of d.importacoes ?? []) if (r.venc) for (const id of r.ids) if (!vencDe.has(id) || r.venc > vencDe.get(id)!) vencDe.set(id, r.venc);
  const lancamentos = d.lancamentos.map((l) => (l.adiado && !l.adiadoEm && vencDe.has(l.id) ? { ...l, adiadoEm: vencDe.get(l.id)! } : l));
  return { ...d, lancamentos, migracoes: [...(d.migracoes ?? []), ID] };
}

/**
 * Uma vez (v2.23): marca o que veio de importação, pra só esses terem o nome do banco limpo.
 * Importado = está no histórico de importações, tem a âncora de fatura (só a importação grava)
 * ou nasceu no mesmo instante que outros lançamentos (lote importado de uma vez).
 */
function marcarImportados(d: Data): Data {
  const ID = 'marcar-importados';
  if (d.migracoes?.includes(ID)) return d;
  const ids = new Set((d.importacoes ?? []).flatMap((x) => x.ids));
  const lote = new Map<number, number>();
  for (const l of d.lancamentos) lote.set(l.criado, (lote.get(l.criado) ?? 0) + 1);
  const lancamentos = d.lancamentos.map((l) =>
    l.importado || ids.has(l.id) || (l.fatura && l.cat !== 'fatura') || (lote.get(l.criado) ?? 0) >= 3 ? { ...l, importado: true } : l);
  return { ...d, lancamentos, migracoes: [...(d.migracoes ?? []), ID] };
}

/** Uma vez (v2.17): reconstrói o histórico das faturas importadas antes de ele existir. */
function historicoImportacoes(d: Data): Data {
  const ID = 'historico-importacoes';
  if (d.migracoes?.includes(ID)) return d;
  return { ...d, importacoes: [...(d.importacoes ?? []), ...inferirImportacoes(d)], migracoes: [...(d.migracoes ?? []), ID] };
}

/** Correção única de categorias (v2.13.2): 99Pay → Outros; Love Suites/motel → Lazer; hospital veterinário → Pets — nos lançamentos e no que foi aprendido. */
function corrigirCategorias(d: Data): Data {
  const ID = 'cat-99pay-motel-vet';
  if (d.migracoes?.includes(ID)) return d;
  const lancamentos = d.lancamentos.map((l) => {
    const r = regraFixa(l.desc, l.tipo);
    return r && l.cat !== r.cat ? { ...l, cat: r.cat, ico: r.ico } : l;
  });
  const aprendido = Object.fromEntries(Object.entries(d.aprendido ?? {}).filter(([k]) => !regraFixa(k.split('|')[1] ?? '', 'saida') || k.startsWith('entrada|')));
  return { ...d, lancamentos, aprendido, migracoes: [...(d.migracoes ?? []), ID] };
}

function load(): Data {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s && s.v) return migrar({ ...blank(), ...s });
  } catch { /* sem dados ou corrompido */ }
  return blank();
}

interface DataStore { d: Data; set: (fn: (d: Data) => Data) => void; replace: (d: Data) => void }
export const useDataStore = create<DataStore>((set) => ({
  d: load(),
  set: (fn) => set((s) => ({ d: fn(s.d) })),
  replace: (d) => set({ d }),
}));
const salvar = (d: Data) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* armazenamento cheio/indisponível */ } };
useDataStore.subscribe((s) => salvar(s.d));
salvar(useDataStore.getState().d); // grava já as correções feitas ao abrir (migrações)

export const useData = () => useDataStore((s) => s.d);
export const getData = () => useDataStore.getState().d;
/** Recalcula as telas sem mudar os dados (ex.: virou o dia com o app aberto). */
export const recalcular = () => useDataStore.setState((s) => ({ d: { ...s.d } }));
export const mutate = (fn: (d: Data) => Data) => useDataStore.getState().set(fn);
export const restore = (d: Data) => useDataStore.getState().replace(d);
export const resetData = () => {
  try { localStorage.removeItem(KEY); } catch { /* ok */ }
  restore(blank());
};

/* ---------- interface (não persistida) ---------- */
export type Tab = 'home' | 'extrato' | 'fixos' | 'ajustes';
export interface Toast { id: number; msg: string; undo?: () => void }

interface UIStore {
  tab: Tab;
  setTab: (t: Tab) => void;
  sheet: { key: number; node: ReactNode } | null;
  openSheet: (node: ReactNode) => void;
  closeSheet: () => void;
  /** compra simulada mostrada no gráfico do Início (só na tela, nunca salva) */
  sim: Simulacao | null;
  setSim: (s: Simulacao | null) => void;
  /** Início: "Visão futura" (gráfico de saldo) ou "Para onde foi" (gastos por categoria) */
  visao: 'futuro' | 'mes';
  setVisao: (v: 'futuro' | 'mes') => void;
  /** abrir o Extrato já filtrado (vindo de "Para onde foi") */
  extratoPedido: { cat: string; mk: string } | null;
  pedirExtrato: (p: { cat: string; mk: string } | null) => void;
  toasts: Toast[];
  toast: (msg: string, undo?: () => void) => void;
  dismissToast: (id: number) => void;
}

let seq = 0;
export const useUI = create<UIStore>((set, get) => ({
  tab: 'home',
  setTab: (tab) => set({ tab }),
  sheet: null,
  openSheet: (node) => set({ sheet: { key: ++seq, node } }),
  closeSheet: () => set({ sheet: null }),
  sim: null,
  setSim: (sim) => set({ sim }),
  visao: 'futuro',
  setVisao: (visao) => set({ visao }),
  extratoPedido: null,
  pedirExtrato: (extratoPedido) => set({ extratoPedido }),
  toasts: [],
  toast: (msg, undo) => {
    const id = ++seq;
    set({ toasts: [{ id, msg, undo }] });
    setTimeout(() => get().dismissToast(id), 3400);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const openSheet = (n: ReactNode) => useUI.getState().openSheet(n);
export const closeSheet = () => useUI.getState().closeSheet();
export const toast = (m: string, undo?: () => void) => useUI.getState().toast(m, undo);

/** Executa uma mudança e oferece "Desfazer" no toast. */
export function withUndo(msg: string, fn: (d: Data) => Data) {
  const before = getData();
  mutate(fn);
  toast(msg, () => restore(before));
}
