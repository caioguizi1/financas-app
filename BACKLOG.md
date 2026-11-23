# Backlog do Fluxo

Ideias e ajustes registrados para as próximas versões. Ao implementar, mover para "Versões" no README.

> ⏸️ **Status (23/11/2026):** aguardando os testes do Caio na v2.10. **Não implementar os itens de "Próximas funcionalidades" antes da liberação dele.**

## ✨ Próximas funcionalidades

### 1. Carteira de cartões (visual)
**Pedido:** cadastrar o cartão (ex.: PicPay), subir a imagem do **modelo** do cartão (não foto com número) e, arrastando o dedo, trocar para o Itaú e ver como está cada cartão. Mais visual e bonito.

- Cartões em carrossel/pilha estilo Apple Wallet; arrastar troca o cartão e tudo abaixo anima.
- Upload da **imagem do modelo do cartão** (recorte no formato de cartão, comprimida, guardada só no aparelho — IndexedDB). Aviso na hora: não usar foto com número/CVV.
- Sem imagem: cartão gerado com as cores do banco + nome.
- **Já existe e será reaproveitado:** faturas fechada/aberta por cartão (`faturasAtuais`), data de pagamento/adiantamento, gasto típico (estimativa), parcelas em aberto, conferência com o banco (v2.8–v2.9.2).
- Conteúdo de cada cartão: fatura fechada a vencer, fatura aberta (com progresso até o fechamento), próximas faturas estimadas, parcelas em aberto, gasto do mês por categoria.

### 2. Modo claro
**Pedido:** além do noturno (que já atende), ter o modo claro.

- Opções: **Automático (segue o iPhone) · Claro · Escuro**.
- Versão diurna da identidade Ametista (lilás claro, bordeaux mais fechado, vidro branco) — desenho próprio, não inversão de cores.
- Base pronta: cores centralizadas em tokens no `styles.css` (v2.3).

### 3. Importar fatura do cartão e extrato do banco
**Pedido:** jogar a fatura/extrato e o app já analisar, organizar, identificar o que é parcelado e gerar métricas.

- **CSV / OFX** (Nubank exporta fatura em CSV; OFX é padrão de extrato): leitura 100% no aparelho.
- **PDF de fatura**: leitores por banco (Itaú, PicPay…) ou IA (os dados saem do aparelho — decidir).
- Após importar: categoria automática pelo dicionário, detectar "PARC 03/10" e criar as parcelas futuras, evitar duplicar o que já foi lançado à mão, resumo da fatura (maiores compras, categorias, assinaturas).
- Extrato do banco: análise de entradas/saídas e conferência automática do saldo.
- **Já existe e será reaproveitado:** motor de parcelas no cartão e fora dele, ajuste de fatura pela diferença, dicionário com ~600 termos + aprendizado, insights locais.
- Futuro: Open Finance via agregador (exige servidor e custo).
- **Pendente do Caio:** separar um arquivo real exportado (CSV, OFX ou PDF) de cada banco para calibrar o leitor.

### Pedido original (23/11/2026)
> "Eu pensei em a gente colocar ali mais coisas visuais… eu vou colocar cartão PicPay. Aí eu posso fazer um upload da foto que eu quero do meu cartão. E aí eu posso, arrastando o dedo, trocar pro Itaú e ver como as coisas estão no Itaú… quando eu digo foto, é o modelo do cartão, não a foto com número nem nada… Além disso, pensei no modo noturno do app, também no modo claro… E também… eu jogo o extrato do meu cartão, eu jogo ali a fatura, e aí você já faz toda a análise e já organiza como tá a fatura. Então, a fatura tem alguma coisa parcelada, você já vai… e faz suas métricas ali dentro. Também de extrato de banco, fazer uma análise."

## ✅ Concluído a partir do backlog / testes do Caio
- **Altura das janelas** — topo fixo, meio rolável, teclado/botão fixos (v2.8; prints em `design/backlog/`).
- **Troca de telas pesada** — telas mantidas prontas, sem animação de saída bloqueando (v2.6).
- **＋ lento** — toques por CSS, mola mais firme, sem atraso de toque do iOS (v2.7).
- **Parcelado só onde faz sentido** — Pix/débito sem parcelar; crédito, boleto e Pix parcelado (v2.7).
- **Faturas não descontavam** — fatura fechada + aberta, conferência com o banco (v2.8); valor atual no formulário do cartão (v2.9.2).
- **Forma de pagamento nos fixos** e **pagar fatura em outra data** (v2.9).
- **Faturas futuras zeradas** — gasto típico por fatura (v2.9).
- **Alerta de saldo negativo descalibrado** — primeiro dia negativo, pior ponto e volta (v2.9.1).
- **Resumo do mês confuso** e **tamanho dos números** — começa + entra − sai = termina; algarismos uniformes (v2.10).

## 📅 Manutenção recorrente
- **Janeiro de cada ano:** atualizar tabelas de INSS, IRRF, redução da Lei 15.270 e PLR em `src/lib/folha.ts` (+ testes).
- Acompanhar o alerta moderado do `npm audit` (dependência só de build do PWA).
