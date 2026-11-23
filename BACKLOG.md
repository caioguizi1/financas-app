# Backlog do Fluxo

Ideias e ajustes registrados para as próximas versões. Ao implementar, mover para "Versões" no README.

> ✅ **Status (23/11/2026):** as três funcionalidades foram liberadas pelo Caio e entregues na v2.11. Importação é **funcionalidade, não requisito**: tudo continua funcionando lançando à mão.

## 🔜 Próximos passos
- **Calibrar leitores de PDF** com uma fatura real de cada banco (Itaú, PicPay) — o leitor genérico cobre o formato "dd/mm descrição valor".
- Extrato: conferência automática do saldo com o saldo final do arquivo.
- Futuro: Open Finance via agregador (exige servidor e custo).

## ✅ Concluído a partir do backlog / testes do Caio
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
