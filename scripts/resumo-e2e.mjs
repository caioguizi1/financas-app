// Resumo dos testes E2E em Markdown (evidência da GMUD).
// Uso: node scripts/resumo-e2e.mjs [versão] > arquivo.md
// No GitHub Actions vai pro "Summary" da execução; localmente vira docs/evidencias/vX.Y.Z.md.
import { readFileSync } from 'node:fs';

const r = JSON.parse(readFileSync('relatorio-e2e/resultado.json', 'utf8'));
const versao = process.argv[2] ?? JSON.parse(readFileSync('package.json', 'utf8')).version;
const linhas = [];
const walk = (s, grupo = '') => {
  for (const x of s.suites ?? []) walk(x, x.title && !x.title.endsWith('.ts') ? x.title : grupo);
  for (const sp of s.specs ?? []) for (const t of sp.tests) {
    const res = t.results.at(-1);
    const prints = res.attachments.filter((a) => a.contentType === 'image/png').length;
    const nota = t.annotations.filter((a) => a.type === 'cobertura').map((a) => a.description).join('');
    const status = res.status === 'passed' ? (t.results.length > 1 ? '⚠️ passou na 2ª' : '✅') : '❌';
    linhas.push({ nav: t.projectName === 'safari' ? 'Safari (WebKit)' : 'Chromium', grupo: grupo || sp.file.replace(/\.spec\.ts$/, ''), nome: sp.title, status, seg: (res.duration / 1000).toFixed(1), prints, nota, ok: res.status === 'passed' });
  }
};
walk(r);
const ok = linhas.filter((l) => l.ok).length;
const inicio = r.stats?.startTime ? new Date(r.stats.startTime) : new Date();
const quando = inicio.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

console.log(`# Evidência E2E · v${versao}\n`);
console.log(`- **Resultado:** ${ok}/${linhas.length} testes passaram ${ok === linhas.length ? '✅' : '❌'}`);
console.log(`- **Quando:** ${quando} (horário de Brasília) · duração ${((r.stats?.duration ?? 0) / 1000).toFixed(0)} s`);
const navs = [...new Set(linhas.map((l) => l.nav))].join(' e ');
console.log(`- **Ambiente:** ${navs} (Playwright ${r.config?.version ?? ''}), tela de iPhone 390×844 (+ 375×667 e 320×640 na varredura), dados fictícios, data fixa 25/11/2026`);
console.log(`- **Prints de cada etapa:** relatório HTML no artefato \`evidencias-e2e\` da execução no GitHub Actions\n`);
console.log('| | Teste | Navegador | Grupo | Tempo | Prints | Cobertura |');
console.log('|---|---|---|---|---|---|---|');
for (const l of linhas) console.log(`| ${l.status} | ${l.nome} | ${l.nav} | ${l.grupo} | ${l.seg} s | ${l.prints} | ${l.nota} |`);
if (ok !== linhas.length) process.exitCode = 1;
