import { describe, expect, it } from 'vitest';
import { acharCartao } from './imagens';

function img(W: number, H: number, bg: number[], desenhar: (x: number, y: number) => number[] | null) {
  const px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = desenhar(x, y) ?? bg; px.set([c[0], c[1], c[2], 255], (y * W + x) * 4); }
  return px;
}
const dentro = (c: { x: number; y: number; w: number; h: number }, ref: [number, number, number, number]) =>
  c.x >= ref[0] && c.y >= ref[1] && c.x + c.w <= ref[0] + ref[2] && c.y + c.h <= ref[1] + ref[3] && c.w > ref[2] * 0.9 && c.h > ref[3] * 0.9;

describe('recorte automático do cartão', () => {
  it('cartão laranja num print escuro com texto em volta', () => {
    const px = img(300, 400, [8, 8, 12], (x, y) => {
      if (y > 20 && y < 30 && x > 20 && x < 120) return [240, 240, 240]; // texto acima
      if (x >= 40 && x < 260 && y >= 120 && y < 259) return [255, 90, 0];
      return null;
    });
    expect(dentro(acharCartao(px, 300, 400), [40, 120, 220, 139])).toBe(true);
  });
  it('cartão preto em fundo preto puro (só um pouco mais claro)', () => {
    const px = img(300, 300, [0, 0, 0], (x, y) => (x >= 30 && x < 270 && y >= 80 && y < 231 ? [22, 22, 24] : null));
    expect(dentro(acharCartao(px, 300, 300), [30, 80, 240, 151])).toBe(true);
  });
  it('cartão dentro de uma moldura escura (print do app do banco)', () => {
    const px = img(400, 320, [6, 6, 10], (x, y) => {
      if (x >= 50 && x < 350 && y >= 60 && y < 260) { // moldura
        if (x >= 62 && x < 338 && y >= 72 && y < 248) return [22, 22, 22]; // cartão preto
        return [12, 12, 14];
      }
      return null;
    });
    expect(dentro(acharCartao(px, 400, 320), [62, 72, 276, 176])).toBe(true);
  });
  it('imagem que já é só o cartão fica inteira', () => {
    const px = img(200, 126, [0, 0, 0], () => [30, 200, 100]);
    expect(acharCartao(px, 200, 126)).toEqual({ x: 0, y: 0, w: 200, h: 126 });
  });
});
