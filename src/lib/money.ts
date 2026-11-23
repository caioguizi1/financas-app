const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Formata centavos como R$. `sign` mostra + nos positivos. */
export function brl(c: number, sign = false) {
  const s = nf.format(Math.abs(c) / 100);
  return (c < 0 ? '−' : sign && c > 0 ? '+' : '') + 'R$ ' + s;
}

export const centsToStr = (c: number) => nf.format(c / 100);

export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);
