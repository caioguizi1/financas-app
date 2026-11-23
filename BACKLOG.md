# Backlog do Fluxo

Ideias e ajustes registrados para as próximas versões. Ao implementar, mover para "Versões" no README.

## 🔧 Ajustes de UX

### ✅ Altura das janelas — resolvido na v2.8
Janelas com topo fixo, meio rolável e teclado/botão fixos embaixo (prints originais em `design/backlog/`).

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
