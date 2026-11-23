/**
 * Extrai o texto de um PDF no próprio aparelho (pdf.js), reconstruindo as linhas pela posição.
 * Faturas costumam ter DUAS colunas de lançamentos: quando, na mesma altura, aparece uma
 * nova data (dd/mm) longe do texto anterior, ela começa outra linha.
 * Carregado só quando o usuário importa um PDF — não pesa no app.
 */
export interface ItemPDF { str: string; x: number; y: number; w: number }

export function linhasDosItens(itens: ItemPDF[]): string[] {
  const porY = new Map<number, ItemPDF[]>();
  for (const it of itens) {
    if (!it.str?.trim()) continue;
    const y = Math.round(it.y / 3) * 3; // agrupa itens na mesma altura
    porY.set(y, [...(porY.get(y) ?? []), it]);
  }
  const out: string[] = [];
  [...porY.entries()].sort((a, b) => b[0] - a[0]).forEach(([, its]) => {
    its.sort((a, b) => a.x - b.x);
    let atual = '';
    let fim = -Infinity;
    for (const it of its) {
      const t = it.str.trim();
      const novaColuna = atual && /^\d{2}\/\d{2}(\s|$)/.test(t) && it.x - fim > 14;
      if (novaColuna) { out.push(atual); atual = ''; }
      // pedaços colados (o pdf.js quebra letras acentuadas: "Lan" "ç" "amentos") juntam sem espaço
      atual = !atual ? t : it.x - fim < 1.5 && !/\s$/.test(it.str) ? `${atual}${t}` : `${atual} ${t}`;
      fim = it.x + it.w;
    }
    if (atual) out.push(atual);
  });
  return out;
}

export async function textoDoPDF(arquivo: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  const linhas: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const itens = (tc.items as { str: string; transform: number[]; width: number }[]).map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width }));
    linhas.push(...linhasDosItens(itens));
  }
  return linhas.join('\n');
}
