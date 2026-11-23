/**
 * "Dicionário inteligente": sugere ícone e categoria a partir da descrição.
 * Ordem de confiança: o que VOCÊ ensinou > frase do dicionário > palavra do dicionário > palavra parecida.
 * Tudo roda no aparelho; nada sai do celular.
 */
import type { Tipo } from './types';

export interface Sugestao {
  cat: string;
  ico: string;
  fonte: 'aprendido' | 'dicionario';
  termo: string;
}
export interface Aprendido { cat: string; ico?: string; n: number }
export type Memoria = Record<string, Aprendido>;

type Regra = [tipo: Tipo, cat: string, ico: string, termos: string];

// termos separados por vírgula; podem ter várias palavras ("banho e tosa")
const REGRAS: Regra[] = [
  // ---- saídas ----
  ['saida', 'pets', '🐾', 'pet,pets,petshop,pet shop,petz,cobasi,petlove,racao,veterinario,veterinaria,vet,banho e tosa,tosa,areia do gato,cachorro,gato,coleira,vermifugo'],
  ['saida', 'mercado', '🛒', 'mercado,supermercado,carrefour,pao de acucar,assai,atacadao,atacado,dia,oxxo,minuto pa,feira,hortifruti,sacolao,quitanda,compras do mes,mercadinho,st marche,zona sul,sonda,hirota'],
  ['saida', 'comida', '🥐', 'padaria,pao,cafe da manha'],
  ['saida', 'comida', '🍕', 'pizza,pizzaria'],
  ['saida', 'comida', '🍣', 'sushi,japones,temaki'],
  ['saida', 'comida', '🍦', 'sorvete,acai,doceria,doce,bolo'],
  ['saida', 'comida', '🍺', 'bar,cerveja,chopp,boteco,happy hour,drinks,drink'],
  ['saida', 'comida', '☕', 'cafe,cafeteria,starbucks,coffee'],
  ['saida', 'comida', '🍔', 'ifood,rappi,lanche,lanchonete,hamburguer,burger,mcdonalds,mc donalds,bk,burger king,habibs,restaurante,almoco,jantar,marmita,delivery,comida,refeicao,quentinha,esfiha,pastel,churrasco'],
  ['saida', 'transporte', '⛽', 'gasolina,combustivel,etanol,alcool,posto,shell,ipiranga,abastecer,abastecimento'],
  ['saida', 'transporte', '🅿️', 'estacionamento,zona azul,valet'],
  ['saida', 'transporte', '🚇', 'metro,cptm,trem,bilhete unico,top,recarga bilhete'],
  ['saida', 'transporte', '🚌', 'onibus,brt'],
  ['saida', 'transporte', '🔧', 'oficina,mecanico,revisao,pneu,troca de oleo,funilaria'],
  ['saida', 'transporte', '🚗', 'uber,99,99pop,cabify,taxi,pedagio,sem parar,conectcar,veloe,ipva,licenciamento,multa,seguro do carro,lavagem,lava rapido,carro'],
  ['saida', 'casa', '🏢', 'condominio'],
  ['saida', 'casa', '🔨', 'reforma,pedreiro,eletricista,encanador,material de construcao,leroy,leroy merlin,telhanorte,obra'],
  ['saida', 'casa', '🛋️', 'moveis,movel,sofa,ikea,tok stok,tokstok,etna,decoracao,colchao'],
  ['saida', 'casa', '🧹', 'faxina,diarista,limpeza,produtos de limpeza,lavanderia'],
  ['saida', 'casa', '🏠', 'aluguel,financiamento,prestacao do apartamento,iptu,casa,apartamento,caixa habitacao'],
  ['saida', 'contas', '🔥', 'gas,comgas,botijao,ultragaz'],
  ['saida', 'contas', '🚿', 'agua,sabesp,conta de agua'],
  ['saida', 'contas', '📶', 'internet,wifi,fibra,net,vivo fibra,claro net'],
  ['saida', 'contas', '📱', 'celular,telefone,vivo,claro,tim,oi,recarga,plano de celular'],
  ['saida', 'contas', '💡', 'luz,energia,enel,eletropaulo,cemig,conta de luz,light,copel'],
  ['saida', 'contas', '🏦', 'tarifa,anuidade,juros,iof,taxa bancaria,cesta de servicos,emprestimo,parcela emprestimo'],
  ['saida', 'saude', '🦷', 'dentista,ortodontista,aparelho dental,odonto'],
  ['saida', 'saude', '🏋️', 'academia,smartfit,smart fit,bluefit,bodytech,gympass,wellhub,totalpass,crossfit,personal,pilates,musculacao'],
  ['saida', 'saude', '🩺', 'medico,consulta,exame,hospital,plano de saude,unimed,amil,sulamerica,bradesco saude,laboratorio,fleury,clinica'],
  ['saida', 'saude', '🧠', 'terapia,psicologo,psicologa,psiquiatra'],
  ['saida', 'saude', '💊', 'farmacia,drogasil,droga raia,raia,pague menos,drogaria,remedio,remedios,vitamina,suplemento,whey'],
  ['saida', 'beleza', '💈', 'barbeiro,barbearia,corte de cabelo,barba'],
  ['saida', 'beleza', '💅', 'manicure,unha,pedicure,esmalte'],
  ['saida', 'beleza', '💇', 'cabelo,salao,cabeleireiro,estetica,depilacao,sobrancelha,perfume,cosmeticos,maquiagem,boticario,natura,sephora,skincare'],
  ['saida', 'viagem', '🏨', 'hotel,pousada,airbnb,hospedagem,booking,hostel'],
  ['saida', 'viagem', '✈️', 'viagem,passagem,aviao,voo,latam,gol,azul,decolar,123milhas,aeroporto,rodoviaria,mala'],
  ['saida', 'lazer', '🎬', 'cinema,filme,cinemark,uci'],
  ['saida', 'lazer', '🎤', 'show,festival,ingresso,ingressos,sympla,eventim,teatro,balada,festa'],
  ['saida', 'lazer', '🎮', 'jogo,game,games,steam,playstation,psn,xbox,nintendo'],
  ['saida', 'lazer', '⚽', 'futebol,quadra,ingresso jogo,estadio,socio torcedor'],
  ['saida', 'lazer', '🎉', 'lazer,passeio,parque,museu,role'],
  ['saida', 'assinaturas', '🎵', 'spotify,deezer,apple music,youtube music,tidal'],
  ['saida', 'assinaturas', '☁️', 'icloud,google one,dropbox,onedrive'],
  ['saida', 'assinaturas', '🤖', 'chatgpt,claude,openai,anthropic,copilot,midjourney,gemini'],
  ['saida', 'assinaturas', '📺', 'netflix,prime video,amazon prime,disney,disney plus,hbo,max,globoplay,paramount,youtube premium,apple tv,crunchyroll,streaming,assinatura'],
  ['saida', 'educacao', '📚', 'faculdade,curso,escola,livro,livros,udemy,alura,coursera,ingles,idiomas,mensalidade,material escolar,certificacao,cisa,cissp,pos graduacao,mba'],
  ['saida', 'compras', '🎁', 'presente,presentes,aniversario,amigo secreto,natal'],
  ['saida', 'compras', '👟', 'tenis,sapato,sandalia,chinelo,nike,adidas,centauro,netshoes'],
  ['saida', 'compras', '👕', 'roupa,roupas,camisa,camiseta,calca,jaqueta,renner,riachuelo,cea,zara,hering,shein,reserva'],
  ['saida', 'compras', '📦', 'amazon,mercado livre,mercadolivre,shopee,aliexpress,magalu,magazine luiza,americanas,casas bahia,kabum,encomenda'],
  ['saida', 'compras', '💻', 'notebook,computador,eletronico,eletronicos,fone,headset,teclado,mouse,monitor,iphone,carregador'],
  ['saida', 'compras', '🛍️', 'shopping,compras,loja'],
  // ---- entradas ----
  ['entrada', 'salario', '💼', 'salario,adiantamento,vale,pagamento,holerite,plr,decimo terceiro,13o,ferias,bonus'],
  ['entrada', 'extra', '💻', 'freela,freelance,job,projeto,consultoria,bico'],
  ['entrada', 'extra', '🏷️', 'venda,vendi,olx,enjoei,mercado livre venda'],
  ['entrada', 'extra', '📈', 'rendimento,rendimentos,dividendos,juros recebidos,cdb,tesouro,investimento,cashback'],
  ['entrada', 'reembolso', '↩️', 'reembolso,estorno,devolucao,me pagou,acerto,pix de volta'],
];

const STOP = new Set(['de', 'do', 'da', 'dos', 'das', 'pra', 'pro', 'para', 'com', 'no', 'na', 'nos', 'nas', 'e', 'o', 'a', 'os', 'as', 'em', 'um', 'uma', 'meu', 'minha', 'que', 'por', 'ao', 'mais', 'r', 'rs']);

/** minúsculas, sem acento, sem pontuação, espaços simples. */
export function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
export const tokens = (s: string) => normalizar(s).split(' ').filter((t) => t.length >= 2 && !STOP.has(t) && !/^\d+$/.test(t));

/** Distância de edição limitada (para erros de digitação como "netflx"). */
function dist(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

interface Termo { tipo: Tipo; cat: string; ico: string; termo: string; frase: boolean }
const TERMOS: Termo[] = REGRAS.flatMap(([tipo, cat, ico, lista]) =>
  lista.split(',').map((t) => normalizar(t)).filter(Boolean).map((termo) => ({ tipo, cat, ico, termo, frase: termo.includes(' ') })),
);
const PALAVRA = new Map<string, Termo>();
for (const t of TERMOS) if (!t.frase) {
  const k = `${t.tipo}|${t.termo}`;
  if (!PALAVRA.has(k)) PALAVRA.set(k, t);
}

export function sugerir(desc: string, tipo: Tipo, mem: Memoria = {}): Sugestao | null {
  const norm = normalizar(desc);
  if (norm.length < 2) return null;
  const toks = tokens(desc);

  // 1) aprendido com você: frase inteira, depois a palavra mais usada
  const frase = mem[`${tipo}|${norm}`];
  if (frase) return { cat: frase.cat, ico: frase.ico ?? '', fonte: 'aprendido', termo: norm };
  let melhor: { a: Aprendido; t: string } | null = null;
  for (const t of toks) {
    const a = mem[`${tipo}|${t}`];
    if (a && (!melhor || a.n > melhor.a.n)) melhor = { a, t };
  }
  if (melhor) return { cat: melhor.a.cat, ico: melhor.a.ico ?? '', fonte: 'aprendido', termo: melhor.t };

  // 2) frases do dicionário ("banho e tosa", "pao de acucar")
  const padded = ` ${norm} `;
  const fraseDic = TERMOS.filter((t) => t.tipo === tipo && t.frase && padded.includes(` ${t.termo} `)).sort((a, b) => b.termo.length - a.termo.length)[0];
  if (fraseDic) return { cat: fraseDic.cat, ico: fraseDic.ico, fonte: 'dicionario', termo: fraseDic.termo };

  // 3) palavra exata; 4) plural/prefixo; 5) erro de digitação
  for (const t of toks) { const m = PALAVRA.get(`${tipo}|${t}`); if (m) return { cat: m.cat, ico: m.ico, fonte: 'dicionario', termo: t }; }
  for (const t of toks) {
    if (t.length < 4) continue;
    const m = TERMOS.find((x) => x.tipo === tipo && !x.frase && x.termo.length >= 4 && (t.startsWith(x.termo) || (x.termo.startsWith(t) && t.length >= 5)));
    if (m) return { cat: m.cat, ico: m.ico, fonte: 'dicionario', termo: m.termo };
  }
  for (const t of toks) {
    if (t.length < 5) continue;
    const m = TERMOS.find((x) => x.tipo === tipo && !x.frase && x.termo.length >= 5 && dist(t, x.termo, 1) <= 1);
    if (m) return { cat: m.cat, ico: m.ico, fonte: 'dicionario', termo: m.termo };
  }
  return null;
}

/** Registra a escolha do usuário: a frase inteira e cada palavra relevante. */
export function aprender(mem: Memoria, desc: string, tipo: Tipo, cat: string, ico?: string): Memoria {
  const norm = normalizar(desc);
  if (norm.length < 2) return mem;
  const next = { ...mem };
  const put = (k: string) => {
    const old = next[k];
    next[k] = old && old.cat === cat ? { cat, ico: ico ?? old.ico, n: old.n + 1 } : { cat, ico, n: 1 };
  };
  const chaves = new Set([norm, ...tokens(desc).filter((t) => t.length >= 3)]);
  chaves.forEach((k) => put(`${tipo}|${k}`));
  // limite de tamanho: mantém os 600 termos mais usados
  const keys = Object.keys(next);
  if (keys.length > 600) keys.sort((a, b) => next[a].n - next[b].n).slice(0, keys.length - 600).forEach((k) => delete next[k]);
  return next;
}
