import { describe, expect, it } from 'vitest';
import { ehBruto, nomeLoja } from './lojas';
import { normalizar } from './smart';

describe('nome legível da loja', () => {
  const casos: [string, string][] = [
    ['MLP*NETSHOES-N 4/4', 'Netshoes · 4/4'], ['SHOPEE *Celsin 12/12', 'Shopee · 12/12'], ['99 *99PAYC 3/4', '99Pay · 3/4'],
    ['99PAY *PIX', '99Pay'], ['PG *99 L2L 99 RIDESAO P', '99'], ['AMAZON BRSAO P 8/10', 'Amazon · 8/10'], ['AMAZONPRIMEBR', 'Amazon Prime'],
    ['MP*ALIEXPRESSO 3/3', 'AliExpress · 3/3'], ['DL*UBERRIDES', 'Uber'], ['DL*UberRidesSao PauloBR', 'Uber'], ['UBERPREPAGO', 'Uber'],
    ['LOVE SUITESSAO PAULOBR', 'Love Suites'], ['APPLE.COM/BILLSAO PAULO', 'Apple'], ['MLP*KaBuM KaBu 9/10', 'KaBuM! · 9/10'],
    ['MERCADOLIVRE*O 7/10', 'Mercado Livre · 7/10'], ['MP *MELIMAIS', 'Mercado Livre'], ['RD SAUDE ONLIN 2/2', 'RD Saúde · 2/2'],
    ['HOSPITAL VET T 1/5', 'Hospital Veterinário · 1/5'], ['CARREFOUR STS 244', 'Carrefour'], ['Ingresso.comRIO DE JANE', 'Ingresso.com'],
    ['PIER SEGURADOR 9/12', 'Pier Seguradora · 9/12'], ['VieVerteSAO PAULOBR', 'VieVerte'], ['IFD*12.345.678 LOJA', 'iFood'],
    // genéricos
    ['SOBRINHO LOUNGE LTDASAO', 'Sobrinho Lounge'], ['MULTIPLEX SHOP TABOAO', 'Multiplex Shop'], ['METRO FARMASAO PAULOBR', 'Metro Farma'],
    ['ZIG*PAULISTA 25841 BAR', 'Paulista Bar'], ['MARINKOVIC COQUETELARI', 'Marinkovic Coquetelaria'], ['CASA KEO CONSTRUCAO E', 'Casa Keo Construção'],
    ['Leveros *L 6/12', 'Leveros · 6/12'], ['MERCADAO DE CARNES NO', 'Mercadão de Carnes'], ['RONIN CAFE', 'Ronin Café'],
    ['VIELA PINHEIROS RESTAU', 'Viela Pinheiros Restaurante'], ['CASAR *P 2/3', 'Casar · 2/3'],
    ['IOF DIARIO PARCELADO', 'IOF'], ['CREDITO PULA COMPRA', 'Crédito Pula Compra'], ['PAYGOS o Paulo', 'Paygos'], ['TABOAO DA SERRA', 'Taboão da Serra'],
  ];
  for (const [bruto, esperado] of casos) it(bruto, () => expect(nomeLoja(bruto)).toBe(esperado));
  it('o que o usuário digitou fica igual', () => {
    for (const d of ['Celular novo', 'Aluguel', 'Ajuste fatura Itaú', 'iFood com a Ana', 'Fone 2/3']) expect(nomeLoja(d)).toBe(d);
    expect(ehBruto('Netflix')).toBe(false);
  });
  it('nome corrigido pelo usuário vale pras próximas', () => {
    expect(nomeLoja('CASAR *P 2/3', { [normalizar('CASAR *P')]: 'Casar Presentes' })).toBe('Casar Presentes · 2/3');
  });
});
