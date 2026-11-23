/**
 * Imagens dos cartões (só a ARTE do cartão, nunca número/CVV), guardadas no IndexedDB do aparelho.
 * Ficam fora do localStorage pra não pesar no carregamento.
 */
import { useEffect, useState } from 'react';

const DB = 'fluxo-img', ST = 'cartoes';
const cache = new Map<string, string | null>();
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, err) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => err(r.error);
  });
}
async function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((ok, err) => {
    const req = fn(db.transaction(ST, modo).objectStore(ST));
    req.onsuccess = () => ok(req.result);
    req.onerror = () => err(req.error);
  });
}

export async function lerImagem(id: string): Promise<string | null> {
  if (cache.has(id)) return cache.get(id)!;
  try { const v = (await tx<string | undefined>('readonly', (s) => s.get(id))) ?? null; cache.set(id, v); return v; } catch { return null; }
}
export async function salvarImagem(id: string, dataUrl: string | null) {
  cache.set(id, dataUrl);
  avisar();
  try { await tx<unknown>('readwrite', (s) => (dataUrl ? s.put(dataUrl, id) : s.delete(id)) as IDBRequest<unknown>); } catch { /* sem IndexedDB: fica só na sessão */ }
}
export async function todasImagens(): Promise<Record<string, string>> {
  try {
    const db = await abrir();
    return await new Promise((ok) => {
      const out: Record<string, string> = {};
      const cur = db.transaction(ST).objectStore(ST).openCursor();
      cur.onsuccess = () => { const c = cur.result; if (c) { out[String(c.key)] = c.value; c.continue(); } else ok(out); };
      cur.onerror = () => ok(out);
    });
  } catch { return {}; }
}

export function useImagem(id: string) {
  const [v, setV] = useState<string | null>(cache.get(id) ?? null);
  useEffect(() => {
    let vivo = true;
    const f = () => lerImagem(id).then((x) => vivo && setV(x));
    f(); ouvintes.add(f);
    return () => { vivo = false; ouvintes.delete(f); };
  }, [id]);
  return v;
}

/** Recorta no formato de cartão (ISO 7810, 1,586:1), reduz pra ~856×540 e comprime em JPEG. */
export async function prepararImagem(f: File): Promise<string> {
  const bmp = await createImageBitmap(f);
  const R = 1.586, W = 856, H = 540;
  let sw = bmp.width, sh = bmp.height;
  if (sw / sh > R) sw = sh * R; else sh = sw / R;
  // foto em pé (cartão vertical): gira pra deitar
  const vertical = bmp.height > bmp.width * 1.2;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  if (vertical) {
    let vw = bmp.width, vh = bmp.height;
    if (vh / vw > R) vh = vw * R; else vw = vh / R;
    g.translate(W / 2, H / 2); g.rotate(-Math.PI / 2);
    g.drawImage(bmp, (bmp.width - vw) / 2, (bmp.height - vh) / 2, vw, vh, -H / 2, -W / 2, H, W);
  } else g.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, W, H);
  bmp.close();
  return cv.toDataURL('image/jpeg', 0.82);
}

/** Cor da marca pelo nome do cartão (fundo quando não há imagem). */
const MARCAS: [RegExp, string, string][] = [
  [/picpay/, '#2bd46b', '#0d7a3b'], [/ita[uú]/, '#ff8a1f', '#c24e00'], [/nubank|\bnu\b|roxinho/, '#9b3df0', '#5a0fa0'],
  [/inter/, '#ff8c3a', '#d65a00'], [/caixa/, '#1e74c9', '#0b3d75'], [/bradesco/, '#e0284f', '#8a0a26'],
  [/santander/, '#f0302a', '#9a0c08'], [/\bbb\b|brasil|ourocard/, '#f7d236', '#2a4ea0'], [/c6/, '#3a3a3f', '#0d0d10'],
  [/mercado ?pago|\bmp\b/, '#23b5f0', '#0a5fa0'], [/xp/, '#2b2b2b', '#000000'], [/pag ?bank|pagseguro/, '#1fc36b', '#0a6b8a'],
  [/btg/, '#1c3b70', '#0a1530'], [/neon/, '#22d3ee', '#0e6cc4'], [/will/, '#ffd84a', '#d1a300'], [/sicred|sicoob/, '#4dbb5a', '#1b6b2a'],
];
export function corDoCartao(nome: string): [string, string] {
  const n = nome.toLowerCase();
  const m = MARCAS.find(([r]) => r.test(n));
  if (m) return [m[1], m[2]];
  let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return [`hsl(${h} 60% 52%)`, `hsl(${(h + 30) % 360} 65% 26%)`];
}
