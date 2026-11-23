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
              versions.ts = histórico/vigência dos fixos · extras.ts = 13º, PLR, férias…
              faturas.ts = ciclos, conferência e agrupamento de faturas · insights.ts = insights locais · folha.ts = INSS, IRRF (Lei 15.270), 13º e PLR — tabelas 2026, com testes dos exemplos da Receita
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
- **v2.15.2** — cartões de dica no padrão de carrossel: mesma altura na faixa, ícone e título na mesma linha, texto até 3 linhas (toque mostra inteiro), ação presa na base.
- **v2.15.1** — faixas "Pra você" e "Próximos meses": ao deslizar, o cartão assenta na margem (antes colava na borda da tela); cartões de dica com a altura do próprio conteúdo.
- **v2.15** — arrastar o dedo pela barra de abas (como no iOS 26): a bolha segue o dedo, a aba embaixo acende e, ao soltar, abre; toque simples e o ＋ continuam iguais.
- **v2.14.1** — correção: listas das abas pré-montadas (Fixos, Extrato, Ajustes) apareciam em branco; agora nascem prontas e só animam quando a tela está à vista.
- **v2.14** — desempenho: abas pré-montadas no tempo ocioso (1ª visita ~3x mais rápida); cálculos do motor compartilhados por versão dos dados; gestos de deslizar e carrossel sem o sistema de medição de layout; carteira sem medição forçada a cada redesenho; ＋ sem rolagem forçada na abertura; painéis rolam junto com a abertura; janelas fecham em 0,26 s.
- **v2.13.4** — o que se abre aparece sozinho: painéis que expandem (imagem e categorias da carteira, editor de recorte, parcelas e cronograma do lançamento, holerite da renda, troca de categoria na importação) rolam a tela até ficarem inteiros à vista.
- **v2.13.3** — botão "↺ Padrão" na imagem do cartão: volta pro visual gerado (cores do banco + nome), com Desfazer.
- **v2.13.2** — regras fixas de categoria: 99Pay (Pix pelo cartão) → Outros, sem confundir com corrida de 99; Love Suites/motel → Lazer; hospital veterinário → Pets; correção única nos lançamentos já salvos e no que foi aprendido.
- **v2.13.1** — carteira com arrasto próprio: o cartão sempre assenta no centro (distância + impulso do gesto; pontos tocáveis); categorias filtráveis: na carteira, tocar numa categoria abre as compras dela; no Extrato, chips por categoria com total do mês e % do gasto.
- **v2.13** — auditoria do motor (saldo, gráfico, faturas, parcelas, estimativas e resumo dos meses conferidos por invariantes); ao conferir o saldo, o app pergunta se o que estava previsto pra hoje (salário, aluguel…) já caiu; recalcula sozinho quando o dia vira com o app aberto; procura versão nova ao voltar pro app e avisa "Atualizado para vX".
- **v2.12.1** — 13º sem bruto cadastrado: bruto estimado a partir do líquido (inverso do holerite 2026), 1ª parcela = metade do bruto, 2ª com INSS e IR do 13º inteiro; primeira caixa das janelas não fica mais cortada no topo.
- **v2.12** — importação de fatura em PDF calibrada com faturas reais do Itaú e do PicPay (duas colunas, "PARC02/04", seção de próximas faturas ignorada, conferência com o total do banco); cada item fica preso à fatura pelo vencimento impresso: fatura já vencida vira histórico e as parcelas restantes caem nas faturas seguintes; valor informado à mão nas faturas seguintes é descontado das parcelas importadas; corrige dia de fechamento/vencimento do cartão pela fatura; não duplica parcela ao importar o mês seguinte; recorte da imagem do cartão com ajuste manual (arrastar, aproximar, girar).
- **v2.11.1** — imagem do cartão recortada automaticamente (acha o cartão no print/foto, tira moldura e fundo, deita se estiver em pé) com prévia antes de salvar; nada por cima da arte (valor vai abaixo); carteira sempre mostra os dados do cartão em destaque; ícone dos avisos não invade mais o texto.
- **v2.11** — carteira de cartões (arrastar entre cartões, imagem da arte do cartão guardada só no aparelho, status, faturas fechada/aberta com progresso do gasto típico, próximas faturas, parcelas e categorias; vitrine na Início); modo claro "Ametista clara" (Automático · Claro · Escuro); importação **opcional** de fatura e extrato (CSV, OFX e PDF lidos no aparelho): categoria automática, parcelas "03/10" viram as parcelas restantes nos meses seguintes, duplicados/fixos/pagamento da fatura reconhecidos, análise de categorias, compromisso dos próximos 6 meses, assinaturas e gasto típico sugerido.
- **v2.10** — resumo dos meses que fecha a conta (começa com + entra − sai = termina com, encadeado; mês atual a partir do saldo de hoje, só o que ainda falta), resultado do mês em destaque; números com desenho e largura uniformes.
- **v2.9.2** — "Fatura atual" em destaque no formulário do cartão, na criação e na edição (fechada a vencer + aberta, já com o que o app somou; ajusta a diferença ao salvar); gasto típico separado como opcional.
- **v2.9.1** — alerta de saldo negativo calibrado: mostra o primeiro dia negativo, o pior ponto e quando volta ao positivo, no mesmo horizonte de 90 dias do gráfico.
- **v2.9** — forma de pagamento nos fixos (Pix/débito, boleto ou cartão; cartões antes dos fixos no cadastro); pagar fatura em outra data ("Paguei hoje", adiantar/agendar, voltar pro vencimento) mantendo a fatura pelo vencimento original; gasto típico por fatura preenche faturas futuras com estimativa (gráfico, meses e listas, marcada como estimada).
- **v2.8** — faturas de cartão: ciclos com fatura fechada a vencer + aberta, conferência com o valor do banco (ajusta só a diferença), cartão novo pergunta cada fatura, compras agrupadas como "Fatura X" nas listas e no gráfico, migração do valor antigo "já gasto"; janelas com altura fixa (topo, meio rolável, teclado e botão fixos embaixo); atalhos de recebimento fixo/extra em Entrada.
- **v2.7** — formas de pagamento separadas: Pix/débito (sai na hora, sem parcelar), crédito por cartão e boleto (à vista ou parcelado), Pix parcelado (sempre parcelado; 1ª parcela na data ou no mês seguinte); linha de pagamento com altura fixa; ＋ mais rápido (toques por CSS em vez de dezenas de componentes animados, mola de abertura mais firme, sem atraso de toque do iOS).
- **v2.6** — troca de abas instantânea (telas mantidas prontas, sem esperar animação de saída, provedores de animação fora do App, pílulas por CSS); compra à vista/parcelada (cartão com ciclo de fatura explicado, ou Pix/boleto mês a mês; total ou valor da parcela; até 48x); parcelas em aberto; insights locais (gasto por dia até a próxima entrada, dia apertado, categoria acima da média, virar fixo, fatura prevista, parcelas, assinaturas); dicionário ampliado (99, 99Food, Uber Eats, transporte público, centenas de marcas).
- **v2.5** — salário bruto → líquido com INSS e IRRF 2026 (redução da Lei 15.270, dependentes, desconto simplificado, outros descontos); 13º calculado (1ª sem descontos, 2ª com INSS/IR do 13º inteiro, avos, prazo antecipado em fim de semana); PLR pelo bruto com a tabela exclusiva anual (acumula no ano).
- **v2.4** — alterações com vigência ("vale a partir de"), histórico de valores por fixo; tela Minha renda (1x/2x, dias, vigência); recebimentos extras com modelos de 13º (2 parcelas, datas da CLT), PLR, férias (1/3), bônus e restituição do IR; aviso do 13º em nov/dez.
- **v2.3** — identidade *Ametista noturna*: fundo quase preto com aurora índigo/bordeaux e granulado, violeta-índigo como marca, bordeaux nas saídas, menta nas entradas; vidro (Liquid Glass) na barra, janelas e avisos; fonte Geist; novo ícone escuro. Desempenho: motor de animação carregado sob demanda (JS inicial −14%), fonte só com subconjunto latino, sem blur animado.
- **v2.2.1** — novo ícone vetorial (seta de tendência + selo de check), nítido em todos os tamanhos; fonte em `design/icon.svg`.
- **v2.2** — dicionário inteligente: ícone e categoria sugeridos enquanto digita (sinônimos, marcas, plural, erro de digitação), aprendendo com as escolhas do usuário; novas categorias Pets, Beleza e Viagem.
- **v2.1** — deslizar o item pro lado revela Editar/Apagar (arrastar até o fim apaga), com Desfazer; janelas com Cancelar, lixeira no cabeçalho e fechamento arrastando pra baixo de qualquer ponto, sem salvar nada.
- **v2.0.1** — corrige destaque do dia selecionado (não aparecia); dias e valores agora são obrigatórios antes de avançar/salvar, com a seleção escrita abaixo do calendário; gastos fixos já cadastrados ganham ✓.
- **v2.0** — migração para React + TypeScript + Vite; janelas com mola e arrastar pra fechar, transições entre etapas e abas, números animados, gráfico animado; testes automatizados e deploy via Actions.
- **v1.2** — digitação de valores pelo teclado do computador.
- **v1.1** — salário em duas partes (adiantamento + restante / quinzena).
- **v1.0** — primeira versão (HTML único).
