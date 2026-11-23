import { create } from 'zustand';
import type { ReactNode } from 'react';
import { today } from './lib/dates';
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
  return { ...d, lancamentos };
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
useDataStore.subscribe((s) => {
  try { localStorage.setItem(KEY, JSON.stringify(s.d)); } catch { /* armazenamento cheio/indisponível */ }
});

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
