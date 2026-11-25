/**
 * Tags e releases a partir do histórico do README ("## Versões").
 * Para cada versão listada: acha o commit em que o package.json passou a ter essa versão,
 * cria a tag vX.Y.Z (anotada) e a release no GitHub com a nota do README.
 * Idempotente: o que já existe é pulado. DRY=1 só mostra o plano.
 * Roda no GitHub Actions (workflow "Versões") a cada push na main.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const DRY = process.env.DRY === '1';
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
const tenta = (cmd, args) => { try { return sh(cmd, args); } catch { return ''; } };

const readme = readFileSync('README.md', 'utf8');
const bloco = readme.split('## Versões')[1]?.split('\n## ')[0] ?? '';
const versoes = [...bloco.matchAll(/^- \*\*v(\d+\.\d+(?:\.\d+)?)\*\* — (.*)$/gm)].map(([, v, nota]) => ({ v, nota }));
const norm = (v) => (v.split('.').length === 2 ? `${v}.0` : v);
const cmp = (a, b) => { const x = norm(a).split('.').map(Number), y = norm(b).split('.').map(Number); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
versoes.sort((a, b) => cmp(a.v, b.v));

const commitDe = (v) => {
  for (const cand of [norm(v), v]) {
    const c = tenta('git', ['log', '--reverse', '--format=%H', `-S"version": "${cand}"`, '--', 'package.json']).split('\n')[0];
    if (c) return c;
  }
  return '';
};

const ultima = versoes.at(-1)?.v;
let tags = 0, rels = 0, puladas = [];
for (const { v, nota } of versoes) {
  const tag = `v${norm(v)}`;
  const c = commitDe(v);
  if (!c) { puladas.push(v); continue; } // anterior a este repositório (legacy/)
  const temTag = !!tenta('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`]);
  if (!temTag) {
    console.log(`tag ${tag} → ${c.slice(0, 7)}`);
    if (!DRY) {
      sh('git', ['tag', '-a', tag, c, '-m', `Fluxo ${tag}\n\n${nota}`]);
      sh('git', ['push', 'origin', `refs/tags/${tag}`]);
    }
    tags++;
  }
  const temRel = !!tenta('gh', ['release', 'view', tag, '--json', 'tagName']);
  if (!temRel) {
    console.log(`release ${tag}`);
    if (!DRY) sh('gh', ['release', 'create', tag, '--verify-tag', '--title', `Fluxo ${tag}`, '--notes', nota, `--latest=${v === ultima}`]);
    rels++;
  }
}
console.log(`\n${tags} tags e ${rels} releases ${DRY ? 'a criar' : 'criadas'}.${puladas.length ? ` Sem commit no repositório (anteriores, legacy/): ${puladas.join(', ')}.` : ''}`);
