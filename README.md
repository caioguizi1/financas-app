# Fluxo

App pessoal de finanças (PWA): controle de gastos e projeção do saldo futuro, dia a dia.

**No ar:** https://caioguizi1.github.io/financas-app/ · no iPhone: Safari → Compartilhar → Adicionar à Tela de Início.

## Stack
- **React 19 + TypeScript** (modo estrito) · **Vite** (build)
- **Motion** (`motion/react`, via `LazyMotion`) — animações com mola, janelas arrastáveis, transições de tela
- **Geist** (OFL) — tipografia, subconjunto latino embutido
- **Zustand** — estado; dados salvos no aparelho (`localStorage`, chave `fluxo.v1`)
- **vite-plugin-pwa / Workbox** — instalável e funciona offline, atualiza sozinho
- **Vitest** — testes do motor financeiro (datas de fatura, parcelas, projeção)

## Estrutura
```
src/
  lib/        motor financeiro puro (tipos, datas, dinheiro, engine + testes)
              smart.ts = dicionário inteligente + aprendizado local (com testes)
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
- **v2.3** — identidade *Ametista noturna*: fundo quase preto com aurora índigo/bordeaux e granulado, violeta-índigo como marca, bordeaux nas saídas, menta nas entradas; vidro (Liquid Glass) na barra, janelas e avisos; fonte Geist; novo ícone escuro. Desempenho: motor de animação carregado sob demanda (JS inicial −14%), fonte só com subconjunto latino, sem blur animado.
- **v2.2.1** — novo ícone vetorial (seta de tendência + selo de check), nítido em todos os tamanhos; fonte em `design/icon.svg`.
- **v2.2** — dicionário inteligente: ícone e categoria sugeridos enquanto digita (sinônimos, marcas, plural, erro de digitação), aprendendo com as escolhas do usuário; novas categorias Pets, Beleza e Viagem.
- **v2.1** — deslizar o item pro lado revela Editar/Apagar (arrastar até o fim apaga), com Desfazer; janelas com Cancelar, lixeira no cabeçalho e fechamento arrastando pra baixo de qualquer ponto, sem salvar nada.
- **v2.0.1** — corrige destaque do dia selecionado (não aparecia); dias e valores agora são obrigatórios antes de avançar/salvar, com a seleção escrita abaixo do calendário; gastos fixos já cadastrados ganham ✓.
- **v2.0** — migração para React + TypeScript + Vite; janelas com mola e arrastar pra fechar, transições entre etapas e abas, números animados, gráfico animado; testes automatizados e deploy via Actions.
- **v1.2** — digitação de valores pelo teclado do computador.
- **v1.1** — salário em duas partes (adiantamento + restante / quinzena).
- **v1.0** — primeira versão (HTML único).
