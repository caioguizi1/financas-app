# Backlog do Fluxo

Ideias e ajustes registrados para as próximas versões. Ao implementar, mover para "Versões" no README.

## 🔧 Ajustes de UX

### Altura da janela de lançamento oscila (registrado em 23/11/2026)
Prints: `design/backlog/2026-11-23-lancamento-saida.png` e `...-entrada.png`.
**Problema:** a janela "Novo lançamento" muda de altura conforme o conteúdo, e o topo dela sobe e desce:
- **Saída** tem "Como pagou" e "À vista / Parcelado"; **Entrada** não tem → ao alternar, a janela encolhe ~400px e o topo "pula".
- Também mexem na altura: a linha "✨ Categoria/Sugestão" (aparece/some ao digitar), o bloco de parcelas e o cronograma do cartão.
- Resultado: botões mudam de lugar sob o dedo e a tela parece instável.

**Direção da correção:**
- Janela com **altura fixa** (ex.: ~92% da tela) nos lançamentos: o topo nunca se move.
- **Teclado numérico e botão Lançar fixos embaixo** (sempre no mesmo lugar, perto do polegar); só a área do meio rola se precisar.
- **Reservar espaço** das linhas que aparecem/somem (dica do dicionário, cronograma) ou animar a altura suavemente, sem empurrar o teclado.
- Em Entrada, ocupar o espaço de "Como pagou" com algo útil (ex.: "Recebimento fixo? / Extra previsto?") em vez de deixar a janela encolher.
- Aplicar a mesma regra às outras janelas (gasto fixo, cartão, renda) para consistência.

## ✨ Funcionalidades

### Carteira de cartões (visual)
- Cartões em carrossel/pilha estilo Apple Wallet; arrastar troca o cartão e tudo abaixo anima (fatura atual, próxima, parcelas, gasto do mês).
- Upload da **imagem do modelo do cartão** (recorte no formato de cartão, comprimida, guardada só no aparelho — IndexedDB). Aviso: não usar foto com número/CVV.
- Sem imagem: cartão gerado com as cores do banco + nome.

### Modo claro
- Opções: **Automático (segue o iPhone) · Claro · Escuro**.
- Versão diurna da identidade Ametista (lilás claro, bordeaux mais fechado, vidro branco) — desenho próprio, não inversão de cores.

### Importar fatura e extrato
- **CSV / OFX** (Nubank exporta fatura em CSV; OFX é padrão de extrato): leitura 100% no aparelho.
- **PDF de fatura**: leitores por banco (Itaú, PicPay…) ou IA (os dados saem do aparelho — decidir).
- Após importar: categoria automática pelo dicionário, detectar "PARC 03/10" e criar parcelas futuras, evitar duplicar o que já foi lançado à mão, resumo da fatura (maiores compras, categorias, assinaturas).
- Futuro: Open Finance via agregador (exige servidor e custo).
- **Pendente do Caio:** separar um arquivo real exportado (CSV, OFX ou PDF) para calibrar o leitor.

## 📅 Manutenção recorrente
- **Janeiro de cada ano:** atualizar tabelas de INSS, IRRF, redução da Lei 15.270 e PLR em `src/lib/folha.ts` (+ testes).
- Acompanhar o alerta moderado do `npm audit` (dependência só de build do PWA).
