# Fluxo

App pessoal de finanças (PWA): controle de gastos e projeção do saldo futuro, dia a dia.

**No ar:** https://caioguizi1.github.io/financas-app/ · no iPhone: Safari → Compartilhar → Adicionar à Tela de Início.

## Stack
- **React 19 + TypeScript** (modo estrito) · **Vite** (build)
- **Motion** (`motion/react`) — animações com mola, janelas arrastáveis, transições de tela
- **Zustand** — estado; dados salvos no aparelho (`localStorage`, chave `fluxo.v1`)
- **vite-plugin-pwa / Workbox** — instalável e funciona offline, atualiza sozinho
- **Vitest** — testes do motor financeiro (datas de fatura, parcelas, projeção)

## Estrutura
```
src/
  lib/        motor financeiro puro (tipos, datas, dinheiro, engine + testes)
  store.ts    dados persistidos + estado de interface (abas, janelas, toasts)
  ui/         componentes base (Sheet, teclado numérico, controles, gráfico)
  sheets/     janelas: lançamento rápido, fixos, cartões, ajuste de saldo
  screens/    cadastro inicial, Início, Extrato, Fixos, Ajustes
legacy/       v1 (HTML único), mantida só como referência
```

## Controle de mudanças
Todo push na `main` passa pelo GitHub Actions: **checagem de tipos → testes → build → publicação**.
Se qualquer etapa falhar, nada é publicado e a versão anterior continua no ar.

```bash
npm install
npm run dev        # desenvolvimento
npm test           # testes
npm run build      # build de produção
```

## Versões
- **v2.0** — migração para React + TypeScript + Vite; janelas com mola e arrastar pra fechar, transições entre etapas e abas, números animados, gráfico animado; testes automatizados e deploy via Actions.
- **v1.2** — digitação de valores pelo teclado do computador.
- **v1.1** — salário em duas partes (adiantamento + restante / quinzena).
- **v1.0** — primeira versão (HTML único).
