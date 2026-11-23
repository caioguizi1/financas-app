/**
 * Extrai o texto de um PDF no próprio aparelho (pdf.js), reconstruindo as linhas pela posição.
 * Carregado só quando o usuário importa um PDF — não pesa no app.
 */
export async function textoDoPDF(arquivo: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  const linhas: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const porY = new Map<number, { x: number; s: string }[]>();
    for (const it of tc.items as { str: string; transform: number[] }[]) {
      if (!it.str?.trim()) continue;
      const y = Math.round(it.transform[5] / 3) * 3; // agrupa itens na mesma altura
      porY.set(y, [...(porY.get(y) ?? []), { x: it.transform[4], s: it.str }]);
    }
    [...porY.entries()].sort((a, b) => b[0] - a[0]).forEach(([, its]) => linhas.push(its.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ')));
  }
  return linhas.join('\n');
}
