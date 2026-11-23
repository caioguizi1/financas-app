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

export interface Caixa { x: number; y: number; w: number; h: number }

/** Um nível de busca: o maior bloco "cheio" que difere do fundo (borda) dentro de `r`. */
function bloco(px: Uint8ClampedArray, W: number, r: Caixa): Caixa | null {
  const at = (x: number, y: number) => (y * W + x) * 4;
  const borda: number[][] = [];
  const dx = Math.max(1, Math.round(r.w * 0.015)), dy = Math.max(1, Math.round(r.h * 0.015));
  for (let x = r.x + Math.round(r.w * 0.2); x < r.x + r.w * 0.8; x++) for (const y of [r.y + dy, r.y + r.h - 1 - dy]) borda.push([px[at(x, y)], px[at(x, y) + 1], px[at(x, y) + 2]]);
  for (let y = r.y + Math.round(r.h * 0.2); y < r.y + r.h * 0.8; y++) for (const x of [r.x + dx, r.x + r.w - 1 - dx]) borda.push([px[at(x, y)], px[at(x, y) + 1], px[at(x, y) + 2]]);
  const med = (k: number) => borda.map((c) => c[k]).sort((a, b) => a - b)[borda.length >> 1];
  const bg = [med(0), med(1), med(2)];
  const dif = (c: number[]) => Math.max(Math.abs(c[0] - bg[0]), Math.abs(c[1] - bg[1]), Math.abs(c[2] - bg[2]));
  // sensibilidade pelo ruído do fundo: print liso → bem sensível (cartão preto em fundo preto); foto → menos
  const ruido = borda.map(dif).sort((a, b) => a - b)[borda.length >> 1]; // mediana: uma ponta do cartão encostando na borda não estraga
  const lim = Math.max(6, ruido * 2 + 4);
  const fg = (x: number, y: number) => dif([px[at(x, y)], px[at(x, y) + 1], px[at(x, y) + 2]]) > lim;
  const trecho = (ini: number, n: number, cheio: (i: number) => boolean, folga: number) => {
    let best = [0, -1], a0 = -1, ult = -1;
    for (let i = ini; i < ini + n; i++) {
      if (!cheio(i)) continue;
      if (a0 < 0 || i - ult > folga) a0 = i;
      ult = i;
      if (ult - a0 > best[1] - best[0]) best = [a0, ult];
    }
    return best;
  };
  const linha = (y: number) => { let c = 0; for (let x = r.x; x < r.x + r.w; x++) c += +fg(x, y); return c / r.w; };
  const [y0, y1] = trecho(r.y, r.h, (y) => linha(y) >= 0.3, Math.max(2, r.h * 0.04));
  if (y1 - y0 < r.h * 0.12) return null;
  const col = (x: number) => { let c = 0; for (let y = y0; y <= y1; y++) c += +fg(x, y); return c / (y1 - y0 + 1); };
  const [x0, x1] = trecho(r.x, r.w, (x) => col(x) >= 0.3, Math.max(2, r.w * 0.04));
  if (x1 - x0 < r.w * 0.12) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

const quaseCartao = (c: Caixa) => { const q = c.w / c.h; return (q > 1.35 && q < 1.85) || (1 / q > 1.35 && 1 / q < 1.85); };

/**
 * Acha o cartão dentro da imagem (print do app do banco, foto, cartão com moldura).
 * Procura o bloco que difere do fundo e repete por dentro dele — tira molduras
 * e sombras em volta até chegar no cartão.
 */
export function acharCartao(px: Uint8ClampedArray, W: number, H: number): Caixa {
  const tudo = { x: 0, y: 0, w: W, h: H };
  let atual = tudo;
  for (let nivel = 0; nivel < 4; nivel++) {
    const b = bloco(px, W, atual);
    if (!b || b.w < 12 || b.h < 12) break;
    const area = (b.w * b.h) / (atual.w * atual.h);
    if (area > 0.96) break; // nada a tirar
    // por dentro de uma moldura: só aceita se ainda parecer um cartão e não for um detalhe (logo, texto)
    if (nivel > 0 && (area < 0.45 || !quaseCartao(b))) break;
    atual = b;
  }
  if (atual === tudo) return tudo;
  const ins = Math.round(Math.min(atual.w, atual.h) * 0.03); // borda arredondada / antisserrilhado / sombra
  return { x: atual.x + ins, y: atual.y + ins, w: atual.w - 2 * ins, h: atual.h - 2 * ins };
}

export const PROP = 1.586;

/** Fonte do recorte: a imagem já deitada (se o cartão estava em pé) e o enquadramento inicial automático. */
export interface FonteRecorte { url: string; w: number; h: number; caixa: Caixa }

function detectar(img: CanvasImageSource, W: number, H: number): Caixa {
  const k = Math.min(1, 360 / Math.max(W, H));
  const aw = Math.max(8, Math.round(W * k)), ah = Math.max(8, Math.round(H * k));
  const ac = document.createElement('canvas'); ac.width = aw; ac.height = ah;
  const ag = ac.getContext('2d', { willReadFrequently: true })!;
  ag.drawImage(img, 0, 0, aw, ah);
  const c = acharCartao(ag.getImageData(0, 0, aw, ah).data, aw, ah);
  return { x: c.x / k, y: c.y / k, w: c.w / k, h: c.h / k };
}

/** Na proporção de cartão, dentro da imagem, cobrindo a caixa detectada pelo centro. */
export function enquadrar(c: Caixa, W: number, H: number): Caixa {
  let { x, y, w, h } = c;
  if (w / h > PROP) { const n = h * PROP; x += (w - n) / 2; w = n; } else { const n = w / PROP; y += (h - n) / 2; h = n; }
  w = Math.min(w, W, H * PROP); h = w / PROP;
  return { x: Math.max(0, Math.min(W - w, x)), y: Math.max(0, Math.min(H - h, y)), w, h };
}

async function paraCanvas(src: CanvasImageSource, W: number, H: number, girar: boolean) {
  const MAX = 2000;
  const k = Math.min(1, MAX / Math.max(W, H));
  const w = Math.round(W * k), h = Math.round(H * k);
  const cv = document.createElement('canvas');
  cv.width = girar ? h : w; cv.height = girar ? w : h;
  const g = cv.getContext('2d')!;
  if (girar) { g.translate(cv.width / 2, cv.height / 2); g.rotate(-Math.PI / 2); g.drawImage(src, -w / 2, -h / 2, w, h); }
  else g.drawImage(src, 0, 0, w, h);
  return cv;
}

/** Lê a imagem, deita o cartão se estiver em pé e acha o enquadramento automático. */
export async function abrirImagem(f: File | HTMLCanvasElement, girar = false): Promise<FonteRecorte & { canvas: HTMLCanvasElement }> {
  const bmp = f instanceof HTMLCanvasElement ? f : await createImageBitmap(f);
  let cv = await paraCanvas(bmp, bmp.width, bmp.height, girar);
  if ('close' in bmp) bmp.close();
  let caixa = detectar(cv, cv.width, cv.height);
  if (!girar && caixa.h > caixa.w * 1.2) { // cartão em pé: deita
    cv = await paraCanvas(cv, cv.width, cv.height, true);
    caixa = detectar(cv, cv.width, cv.height);
  }
  const url = cv.toDataURL('image/jpeg', 0.9);
  return { url, w: cv.width, h: cv.height, caixa: enquadrar(caixa, cv.width, cv.height), canvas: cv };
}

/** Gera a imagem final (~856×540, JPEG) a partir do enquadramento escolhido. */
export function recortar(cv: HTMLCanvasElement, c: Caixa): string {
  const out = document.createElement('canvas'); out.width = 856; out.height = 540;
  const g = out.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(cv, c.x, c.y, c.w, c.h, 0, 0, 856, 540);
  return out.toDataURL('image/jpeg', 0.85);
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
