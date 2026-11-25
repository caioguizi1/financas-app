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
- **Playwright Test** — testes de ponta a ponta no app de verdade (navegador), com prints como evidência

## Estrutura
```
src/
  lib/        motor financeiro puro, sem interface (tudo com testes)
              engine.ts      eventos e projeção do saldo (memoizados por versão dos dados)
              dates.ts · money.ts · types.ts · categories.ts · tema.ts
              faturas.ts     ciclos, faturas atuais e anteriores, ajustes, compras no cartão do mês
              analiseFatura.ts  de que a fatura é feita, comparação, o que continua, categorias
              insights.ts · insightsFatura.ts   dicas do Início e da fatura; parcelas mês a mês
              importar.ts · pdfTexto.ts · importacoes.ts   leitura de CSV/OFX/PDF (Itaú, PicPay), duplicados, histórico
              lojas.ts · nomes.ts   nome legível de loja (só do que veio do banco) e correções suas
              smart.ts       dicionário inteligente + aprendizado local
              versions.ts    vigência dos fixos · recorrencia.ts todo mês/semana/ano · extras.ts 13º, PLR, férias
              folha.ts INSS/IRRF/Lei 15.270 · backupInfo.ts lembrete de backup
              imagens.ts     imagem do cartão (recorte automático) · estiloIco.ts ícone x emoji
  store.ts    dados persistidos (+ migrações únicas) e estado de interface (abas, janelas, toasts)
  ui/         componentes base: Sheet, teclado (Money), controles, SwipeRow, Aviso, CatIco (figura de
              categoria), Filtros (ordenar/categoria), Insights, gráfico, useAosPoucos (listas longas)
  sheets/     janelas: lançamento (QuickAdd), fixos (EditRec), renda, extras, carteira, faturas,
              fatura completa (FaturaPassada), parcelas, importação, cartão, saldo
  screens/    cadastro inicial, Início, Extrato, Fixos, Ajustes
legacy/       v1 (HTML único), mantida só como referência
e2e/          testes de ponta a ponta (Playwright) com dados fictícios · dados.ts · util.ts
docs/evidencias/  resumo dos testes E2E de cada versão (GMUD)
```

## Controle de mudanças
Todo push na `main` passa pelo GitHub Actions: **checagem de tipos → testes unitários → build → testes E2E →
publicação**. Se qualquer etapa falhar, nada é publicado e a versão anterior continua no ar.

- **Cada versão é uma GMUD**: commit `GMUD vX.Y — título` com *o que muda*, *evidência* (testes) e *rollback*.
- **Tags e releases automáticas**: o workflow *Versões* (`scripts/versoes.mjs`) cria a tag `vX.Y.Z` no commit
  que publicou cada versão e a release no GitHub com a nota da lista abaixo. É idempotente (pula o que já
  existe; `DRY=1` mostra o plano). As v1.x são da versão antiga em HTML único (`legacy/`), sem tag.
- **Versão**: `package.json` + a linha em *Versões* abaixo, no mesmo commit.
- **Antes de publicar**: testes unitários (Vitest), regressão de ponta a ponta (Playwright, inclusive com
  faturas reais que **não** são versionadas) e auditoria de espaçamento ícone↔texto.

### Evidências dos testes
- **No repositório (permanente):** `docs/evidencias/vX.Y.Z.md`, um resumo por versão com cada teste, resultado,
  tempo, quantidade de prints e cobertura. Gerado por `node scripts/resumo-e2e.mjs` e incluído no commit da GMUD.
- **No GitHub Actions (cada execução):** o resumo aparece no *Summary* da execução de "Testar e publicar", e o
  relatório HTML completo, com **print de cada etapa** e o *trace* (passo a passo) de qualquer falha, fica no
  artefato `evidencias-e2e` por 90 dias (o máximo do GitHub para repositório público).
- **Dados dos testes:** sempre fictícios (`e2e/dados.ts`), com data fixa (25/11/2026) para a evidência ser
  reproduzível. Faturas reais nunca entram no repositório.

```bash
npm install
npm run dev        # desenvolvimento
npm test           # testes unitários
npm run e2e        # testes de ponta a ponta (sobe o build com vite preview; relatório em relatorio-e2e/)
npm run build      # build de produção
```

## Desempenho
Regras que mantêm as janelas leves (medidas com CPU 4x mais lenta, mediana de 5 aberturas):
- Abrir/fechar janela **não re-renderiza as telas de fundo**: o botão ＋ é isolado e os `AnimatePresence`
  usam `presenceAffectsLayout={false}` (sem isso, cada linha animada de todas as telas re-renderizava).
- Animações pequenas (pulso do valor, pulo do ícone) em **CSS**, não em componentes animados.
- Listas longas em janelas montam **aos poucos** (`useAosPoucos`): as primeiras linhas com a janela,
  o resto em lotes nos momentos livres.
- Cálculos pesados memoizados por versão dos dados (`eventosEntre`, `projecao`, `analisarFatura`,
  `nomeVisivel`); histórico de faturas calculado numa passada só.
- Conteúdo da janela chega junto com ela (sem cascata de entrada na abertura).

## Versões
- **v2.37.0** — fixos que se repetem **toda semana** ou **todo ano** (além de todo mês), no ＋ e em Fixos, com a média mensal nos totais; aviso quando já existe um fixo com o mesmo nome; **lembrete de backup** (Ajustes e Início) quando nunca fez ou faz mais de 30 dias; nota quando boa parte da projeção é **estimativa** dos cartões; cadastro sem a piscada em branco entre etapas (317 → 66 ms). **Testes E2E no repositório** (Playwright, dados fictícios) rodando no GitHub antes de publicar, com evidência em `docs/evidencias/`.
- **v2.36.0** — "Repete todo mês" no ＋: transforma o lançamento (saída ou entrada) em fixo no dia da data escolhida, com a mesma forma de pagamento (Pix/débito, cartão ou boleto), a partir daquele mês. Também converte um lançamento seu já salvo (sem contar duas vezes). Dicionário: "Assinatura"/IPTV vai para Assinaturas, mesmo com "TV" no nome.
- **v2.35.0** — dicionário ampliado: utensílios de cozinha, iluminação e casa inteligente (lâmpadas, LED, Alexa), cama/mesa/banho, limpeza, ferramentas, móveis e plantas vão para Casa; itens de mercado (arroz, leite, água mineral, óleo de soja…) e de higiene (desodorante, fio dental…) também. Correção: "Lâmpadas Smart" caía em Saúde porque "smart" era lido como começo de "Smart Fit".
- **v2.34.0** — tela do ＋ mais leve: o teclado numérico só aparece quando você toca no valor (também no lançamento novo) e some ao tocar fora ou no OK; miniaturas dos cartões viram imagens pequenas pré-carregadas em segundo plano (antes cada chip carregava a foto inteira); animação do botão ＋ em CSS. Medido com CPU 4x: travada ao abrir 89 → 57 ms, tarefa longa 76 → 0 ms.
- **v2.33.1** — tags e releases automáticas: o workflow "Versões" cria, a cada push na `main`, a tag `vX.Y.Z` e a release no GitHub de toda versão desta lista que ainda não tem (na 1ª execução, todas as antigas desde a v2.0).
- **v2.33** — desempenho: abrir/fechar janelas não re-renderiza mais as telas de fundo (antes, cada linha animada de todas as telas era refeita); trocar de aba ficou ~10x mais leve. Menus abrem 40–60% mais rápido (Novo lançamento 148→67 ms, Editar fixo 133→45 ms, Fatura completa 184→105 ms, com CPU 4x mais lenta). Histórico de faturas numa passada só; análise da fatura e nomes de loja memoizados; listas longas montam aos poucos; conteúdo chega junto com a janela (sem cascata); a fileira de categorias já abre posicionada. README com estrutura, desempenho e controle de mudanças atualizados; tags e releases de todas as versões.
- **v2.32** — extrato: compras no cartão em bloco próprio no dia ("No cartão · sai na fatura"), com deslizar para editar/apagar e nome da categoria quando a compra não tem nome. Edição: trocar o nome aplica a sugestão do nome novo, e a dica "Sugestão" ganhou o botão Usar. O teclado numérico fecha depois do toque, sem deslocar a tela.
- **v2.31** — extrato: compras lançadas no cartão aparecem no dia da compra, marcadas "no cartão" e com a fatura em que caem. Não entram nos totais (o dinheiro sai no vencimento da fatura) e tocar abre a edição. As compras importadas continuam só na fatura, pra não lotar o extrato.
- **v2.30.1** — filtros: o valor em destaque de cada parcela acompanha a ordenação ("Maior parcela" mostra o valor por mês; as outras mostram o restante, com o prazo ou a data da compra embaixo); na fatura, "maior/menor valor" ordena pelo tamanho do valor (créditos não vão mais pro topo).
- **v2.30** — ordenar e filtrar: na lista de parcelas (termina antes/depois, valor restante, maior parcela, data da compra) e na fatura completa (data, valor), com filtro por categoria e soma do que está filtrado.
- **v2.29** — parcelas mês a mês: "Ver parcelas" mostra, para cada mês, quanto sai de parcelas (todos os cartões + boleto/Pix), dividido por cartão, e quanto isso representa do que entra na conta no mês. A dica de parcelas diz o prazo final e quanto sai no próximo mês.
- **v2.28** — análise da fatura: barra mostrando de que o valor é feito (compras do mês, novas parceladas, parcelas antigas, puladas, fixos, não lançadas, créditos), cada parte filtra a lista. Mostra também a comparação com a fatura anterior (só se as duas estiverem completas e fechadas), a maior compra, quanto as parceladas ainda cobram nas próximas faturas e onde foi o dinheiro. Também vale para a fatura aberta ("Ver análise e fatura completa").
- **v2.27** — histórico de faturas: em Faturas, "Faturas anteriores" lista todas as faturas que já venceram (importadas ou lançadas à mão). Cada uma abre a lista completa, com filtros Puladas, Parcelas e Créditos, e volta para Faturas. Tocar numa importação também abre a fatura. "Ajuste fatura" passa a aparecer como "Compras não lançadas".
- **v2.26** — "FIN" do PicPay = compra pulada (Pula Compra): etiqueta PULADA só na fatura em que o FIN aparece; nas parcelas seguintes de uma compra pulada e parcelada no app, ela é parcela normal. Migração preenche em qual fatura o FIN apareceu, a partir da importação.
- **v2.25.1** — correção de texto: o que veio da fatura anterior ("FIN", parcelada/adiada) não é mais chamado de Pula Compra; o Pula Compra continua sendo só o crédito.
- **v2.25** — etiqueta das compras do Pula Compra passa a ser FATURA ANTERIOR, numa linha própria, sem cortar o nome. O histórico de faturas importadas mostra o valor líquido (o mesmo do extrato), com compras e créditos embaixo. As dicas da fatura deixam essas compras fora da comparação com o normal e explicam quanto veio da fatura anterior.
- **v2.24** — compras adiadas do PicPay ("FIN"/Pula Compra) ganham a etiqueta ADIADA na prévia da importação, nas faturas, na carteira e no extrato; reimportar a mesma fatura recupera a marca das compras antigas sem duplicar nada (e créditos passam a ser reconhecidos como duplicados). Títulos dos cartões "Pra você" usam até duas linhas, com o valor sempre inteiro.
- **v2.23** — nomes aparecem exatamente como você digita ("ITBI - Apartamento"); só o texto que veio do banco é limpo (marcação `importado` + migração dos antigos). Na edição, o teclado numérico só abre ao tocar no valor, fecha ao tocar fora ou em OK, e o primeiro dígito começa um valor novo. Seletor "Figuras das categorias" mostra sempre o ícone em Ícones e o emoji em Emoji.
- **v2.22** — revisão visual: todo ícone de interface já nasce com respiro antes do texto (nada encostado), emoji idem no modo emoji; ícones em botões primários ficam brancos; quadros informativos com o ícone na cor de destaque; Minha renda e Recebimentos extras nos Ajustes no mesmo formato da lista. Auditoria automática mede o espaço ícone↔texto em ~25 telas, nos dois modos.
- **v2.21** — categorias com ícone na cor da categoria, em círculo tingido (extrato, fixos, parcelas, faturas, importação, filtros e lançamento); emoji continua disponível em Ajustes › Aparência › Figuras das categorias. Faturas mantêm a miniatura do próprio cartão, incluindo a imagem personalizada.
- **v2.20** — seletor de tema com ícone e texto alinhados (Auto, Claro, Escuro); salário e 13º com a mesma figura do extrato no menu, nos Fixos e no aviso do 13º.
- **v2.19** — avisos por gravidade (opção 3): ícone na cor do nível (vermelho grave, âmbar atenção, verde positivo, roxo informativo); só o saldo projetado negativo ganha a versão reforçada. Ver "Decisões de design".
- **v2.18** — interface sem emoji em menus e botões (ícones Lucide; emoji só nas categorias e nos avisos); miniatura do próprio cartão no lugar do 💳; nomes de loja legíveis ("MLP*NETSHOES-N" → "Netshoes", ~60 marcas + limpeza de maquininha/cidade/caixa alta), com o original guardado e correções do usuário aprendidas.
- **v2.17** — carteira com atalhos em ícone (Faturas, Importar, Imagem, Editar) logo abaixo da fatura; histórico de faturas importadas por cartão (conferência com o banco, desfazer importação; as antigas reconstruídas); leitura da fatura (categoria acima do normal, concentração, peso das parcelas, compras novas parceladas, acima/abaixo do típico, comprometido nas próximas); pagamento redesenhado (Paguei hoje / Outra data / Alterar data / Desfazer).
- **v2.16** — carteira: os meses de "Próximas faturas" são tocáveis e mostram as compras daquela fatura por categoria (com parcela x/n), mais o que é previsão (gasto típico ainda não lançado e valor informado à mão); atualiza a cada lançamento/importação.
- **v2.15.3** — painéis que se expandem (categorias da carteira, imagem, parcelas, holerite…) abrem e fecham com curva suave em vez de mola: sem ultrapassar e sem a demora no fim; categorias não selecionadas apagam com transição.
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

## Decisões de design
- **Avisos (23/11/2026) — opção 3 escolhida.** Comparadas: (1) emoji como antes, ⚠️ amarelo pra tudo; (2) ícone Lucide na cor da gravidade, em círculo tingido; (3) a 2 com o aviso grave reforçado (círculo cheio, borda forte). Motivo: segue o padrão de design systems (Carbon, Atlassian, Material), com uma intensidade discreta pro dia a dia e uma forte só pro crítico. O positivo fica discreto de propósito, pra evitar fadiga de alerta. Se precisar rever, a opção 2 é só tirar a classe `forte` em `src/ui/Aviso.tsx`; prévias das três opções ficam fora do repositório.
- **Emoji × ícone (23/11/2026).** Uma *coisa* do extrato (categoria, salário, 13º, extras) usa a mesma figura em todo lugar, via `CatTile`/`CatGlyph` (`src/ui/CatIco.tsx`). *Ação* ou *ajuste* usa ícone Lucide neutro (`src/ui/Ico.tsx`).
- **Figuras das categorias (23/11/2026) — Estilo B escolhido.** Padrão: ícone Lucide na cor da categoria, em círculo tingido (padrão de banco: Nubank, Revolut, Monzo). Emoji fica como opção em Ajustes, salva só no aparelho. O emoji continua sendo o dado salvo e é só traduzido para o ícone, então trocar de estilo não altera nenhum lançamento. Faturas sempre mostram a miniatura do cartão (cor da marca ou imagem personalizada). Custo: ~7 KB compactado.
