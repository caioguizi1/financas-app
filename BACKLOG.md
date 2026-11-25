# Backlog do Fluxo

Ideias e ajustes registrados para as próximas versões. Ao implementar, mover para "Versões" no README.

> ✅ **Status (25/11/2026, v2.33):** importação de faturas Itaú e PicPay calibrada com faturas reais; análise de fatura, histórico, parcelas mês a mês e filtros entregues; auditoria de desempenho feita.

## 🔜 Próximos passos (ideias ofertadas, aguardando decisão do Caio)
- **Nomes de loja "como no banco"**: opção nos Ajustes para ver o texto original da fatura em vez do nome limpo (o original continua salvo em cada compra).
- Extrato: conferência automática do saldo com o saldo final do arquivo.
- Futuro: Open Finance via agregador (exige servidor e custo).

## ✅ Concluído a partir do backlog / testes do Caio
- **Leitores de PDF calibrados** com faturas reais do Itaú e do PicPay; compras puladas (FIN) do PicPay marcadas como PULADA só na fatura do FIN (v2.13–v2.26).
- **Ver faturas antigas** — histórico de todas as faturas vencidas, com a fatura completa (v2.27) e a análise de que ela é feita (v2.28).
- **Parcelas: conta parecia não bater** — total confere; ganhou divisão mês a mês com % do que entra (v2.29); ordenar/filtrar (v2.30).
- **Compra no cartão sumia do extrato** — aparece no dia da compra, sem entrar nos totais (v2.31–v2.32).
- **Menus lentos / animação travada** — auditoria de desempenho; janelas 40–60% mais rápidas (v2.33).
- **Carteira de cartões**, **modo claro** e **importação opcional de fatura/extrato** com análise dos meses seguintes (v2.11). Pedido original: "jogo a fatura… você já faz toda a análise"; "ela é uma funcionalidade e não um requisito".
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
