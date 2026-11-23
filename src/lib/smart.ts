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
  // ======================= SAÍDAS =======================
  // ---- pets ----
  ['saida', 'pets', '🐾', 'pet,pets,petshop,pet shop,petz,cobasi,petlove,petland,racao,racoes,veterinario,veterinaria,vet,clinica veterinaria,banho e tosa,tosa,areia do gato,areia,granulado,cachorro,cao,gato,coleira,vermifugo,antipulgas,petisco,arranhador,hotel pet,creche pet,adestrador'],
  // ---- mercado ----
  ['saida', 'mercado', '🛒', 'mercado,supermercado,mercadinho,minimercado,hipermercado,carrefour,carrefour express,pao de acucar,minuto pao de acucar,extra mercado,mercado extra,assai,atacadao,atacado,makro,sams club,sam s club,oxxo,st marche,mambo,hirota,sonda,dia supermercado,zona sul,guanabara,prezunic,mundial,bh supermercados,condor,angeloni,savegnago,tenda atacado,roldao,spani,compras do mes,feira,feira livre,hortifruti,oba hortifruti,natural da terra,sacolao,quitanda,acougue,peixaria,emporio,daki,shopper,rappi turbo,ifood mercado'],
  // ---- comida ----
  ['saida', 'comida', '🥐', 'padaria,pao,paes,cafe da manha,confeitaria'],
  ['saida', 'comida', '🍕', 'pizza,pizzaria,dominos,pizza hut'],
  ['saida', 'comida', '🍣', 'sushi,japones,temaki,yakisoba,china in box,china'],
  ['saida', 'comida', '🍦', 'sorvete,sorveteria,acai,doceria,doce,doces,bolo,brigadeiro,chocolate,cacau show,kopenhagen,brasil cacau'],
  ['saida', 'comida', '🍺', 'bar,cerveja,chopp,chope,boteco,happy hour,drinks,drink,balada bar,adega,ze delivery,vinho'],
  ['saida', 'comida', '☕', 'cafe,cafeteria,starbucks,coffee,the coffee,cafe expresso,nespresso'],
  ['saida', 'comida', '🍔', 'ifood,99food,99 food,uber eats,ubereats,keeta,aiqfome,rappi,james delivery,lanche,lanchonete,hamburguer,hamburgueria,burger,mcdonalds,mc donalds,mequi,bk,burger king,habibs,giraffas,subway,kfc,popeyes,jeronimo,madero,outback,coco bambu,spoleto,bobs,restaurante,almoco,jantar,janta,marmita,marmitex,delivery,comida,refeicao,quentinha,esfiha,pastel,churrasco,churrascaria,rodizio,self service,por quilo,lanche da tarde,salgado,coxinha,food truck'],
  // ---- transporte ----
  ['saida', 'transporte', '⛽', 'gasolina,combustivel,etanol,alcool,diesel,gnv,posto,posto de gasolina,shell,ipiranga,petrobras,br mania,ale,abastecer,abastecimento,abasteci'],
  ['saida', 'transporte', '🅿️', 'estacionamento,zona azul,valet,estapar,multipark,parking'],
  ['saida', 'transporte', '🚇', 'metro,metro sp,cptm,trem,viamobilidade,viaquatro,linha 4,linha amarela,vlt,supervia,metrorio,bilhete unico,bilhete,recarga bilhete,recarga do bilhete,cartao top,top sp,riocard,bom,cartao bom,transporte publico,integracao'],
  ['saida', 'transporte', '🚌', 'onibus,busao,sptrans,brt,emtu,van,lotacao,fretado,buser,clickbus,rodoviaria'],
  ['saida', 'transporte', '🛴', 'patinete,bike,bicicleta,tembici,bike itau,yellow'],
  ['saida', 'transporte', '🔧', 'oficina,mecanico,revisao,pneu,pneus,troca de oleo,oleo,funilaria,borracharia,alinhamento,balanceamento,bateria do carro,auto center,autopecas'],
  ['saida', 'transporte', '🚗', 'uber,uber x,uber black,99,99pop,99 pop,99taxi,99 taxi,cabify,indriver,in driver,taxi,corrida,pedagio,sem parar,conectcar,veloe,taggy,ipva,licenciamento,detran,multa de transito,multa,seguro do carro,seguro auto,lavagem,lava rapido,lava jato,carro,moto,aluguel de carro,localiza,movida,unidas,blablacar'],
  // ---- casa ----
  ['saida', 'casa', '🏢', 'condominio,taxa condominial'],
  ['saida', 'casa', '🔨', 'reforma,pedreiro,eletricista,encanador,pintor,marceneiro,material de construcao,leroy,leroy merlin,telhanorte,c c,cec,obra,ferragem,ferramenta,tinta'],
  ['saida', 'casa', '🛋️', 'moveis,movel,sofa,cama,mesa,cadeira,armario,ikea,tok stok,tokstok,tok e stok,etna,mobly,westwing,madeira madeira,decoracao,colchao,cortina,tapete,luminaria'],
  ['saida', 'casa', '🧹', 'faxina,diarista,faxineira,limpeza,produtos de limpeza,lavanderia,lava e leva,detergente,sabao'],
  ['saida', 'casa', '🔑', 'chaveiro,mudanca,frete mudanca,cofre'],
  ['saida', 'casa', '🏠', 'aluguel,financiamento,prestacao do apartamento,prestacao da casa,parcela do apartamento,iptu,casa,apartamento,caixa habitacao,habitacao,quintoandar,quinto andar,imobiliaria,seguro residencial,seguro fianca'],
  // ---- contas ----
  ['saida', 'contas', '🔥', 'gas,comgas,naturgy,botijao,ultragaz,liquigas,supergasbras,gas encanado'],
  ['saida', 'contas', '🚿', 'agua,sabesp,copasa,cedae,aguas do rio,sanepar,embasa,compesa,conta de agua'],
  ['saida', 'contas', '📶', 'internet,wifi,wi fi,fibra,banda larga,net,vivo fibra,claro net,oi fibra,tim live,desktop internet,brisanet'],
  ['saida', 'contas', '📱', 'celular,telefone,vivo,claro,tim,recarga,recarga celular,plano de celular,conta de celular,chip'],
  ['saida', 'contas', '💡', 'luz,energia,enel,eletropaulo,cemig,conta de luz,light energia,copel,cpfl,celesc,energisa,coelba,neoenergia,equatorial,elektro'],
  ['saida', 'contas', '🏛️', 'imposto,impostos,darf,mei,irpf,imposto de renda,gnre,taxa,taxas,cartorio,documento,passaporte,rg,cnh,renovacao cnh'],
  ['saida', 'contas', '🛡️', 'seguro,seguro de vida,previdencia privada,pgbl,vgbl,porto seguro,sulamerica seguro,bradesco seguros'],
  ['saida', 'contas', '🏦', 'tarifa,tarifa bancaria,anuidade,juros,iof,mora,multa atraso,taxa bancaria,cesta de servicos,emprestimo,parcela emprestimo,consignado,cheque especial,rotativo,fatura atrasada,ted,doc'],
  // ---- saúde ----
  ['saida', 'saude', '🦷', 'dentista,ortodontista,aparelho dental,odonto,odontoprev,limpeza dental,clareamento'],
  ['saida', 'saude', '🏋️', 'academia,smartfit,smart fit,bluefit,bodytech,selfit,gympass,wellhub,totalpass,total pass,crossfit,personal,personal trainer,pilates,musculacao,natacao,yoga,funcional,luta,jiu jitsu,muay thai'],
  ['saida', 'saude', '👓', 'oculos,lente,lentes de contato,otica,oftalmologista'],
  ['saida', 'saude', '🩺', 'medico,medica,consulta,exame,exames,hospital,pronto socorro,plano de saude,convenio,unimed,amil,sulamerica saude,bradesco saude,hapvida,notredame,notre dame,porto saude,prevent senior,laboratorio,fleury,delboni,lavoisier,dasa,a mais,sabin,hermes pardini,clinica,dermatologista,ginecologista,fisioterapia,fisio,nutricionista,vacina'],
  ['saida', 'saude', '🧠', 'terapia,psicologo,psicologa,psiquiatra,psicanalista'],
  ['saida', 'saude', '💊', 'farmacia,drogasil,droga raia,raia,drogaria sao paulo,drogaria,pague menos,pacheco,panvel,onofre,ultrafarma,drogao,nissei,remedio,remedios,medicamento,vitamina,suplemento,whey,creatina'],
  // ---- beleza ----
  ['saida', 'beleza', '💈', 'barbeiro,barbearia,corte de cabelo,corte,barba'],
  ['saida', 'beleza', '💅', 'manicure,unha,unhas,pedicure,esmalte,alongamento de unha'],
  ['saida', 'beleza', '💇', 'cabelo,salao,salao de beleza,cabeleireiro,escova,progressiva,coloracao,estetica,depilacao,sobrancelha,cilios,perfume,perfumaria,cosmeticos,maquiagem,boticario,o boticario,natura,avon,eudora,sephora,quem disse berenice,skincare,protetor solar,shampoo,creme'],
  // ---- viagem ----
  ['saida', 'viagem', '🏨', 'hotel,pousada,airbnb,hospedagem,booking,hostel,resort,hurb'],
  ['saida', 'viagem', '✈️', 'viagem,passagem,passagem aerea,aviao,voo,latam,gol linhas aereas,voo gol,azul linhas aereas,voo azul,decolar,123milhas,maxmilhas,cvc,aeroporto,mala,seguro viagem,cambio,dolar,euro,milhas,smiles,latam pass,tudoazul'],
  // ---- lazer ----
  ['saida', 'lazer', '🎬', 'cinema,filme,cinemark,uci,kinoplex,cinepolis,ingresso com,pipoca'],
  ['saida', 'lazer', '🎤', 'show,shows,festival,ingresso,ingressos,sympla,eventim,ticketmaster,ticket 360,teatro,stand up,balada,festa,boate,camarote,rock in rio,lollapalooza'],
  ['saida', 'lazer', '🎮', 'jogo,game,games,steam,epic games,playstation,psn,ps5,xbox,game pass,nintendo,switch,skin,robux,free fire'],
  ['saida', 'lazer', '⚽', 'futebol,quadra,society,ingresso jogo,estadio,socio torcedor,camisa do time'],
  ['saida', 'lazer', '🎳', 'boliche,karaoke,parque de diversao,hopi hari,beto carrero,escape room,museu,exposicao,zoologico,aquario'],
  ['saida', 'lazer', '🎉', 'lazer,passeio,parque,role,rolezinho,diversao,hobby'],
  // ---- assinaturas ----
  ['saida', 'assinaturas', '🎵', 'spotify,deezer,apple music,youtube music,tidal,amazon music'],
  ['saida', 'assinaturas', '☁️', 'icloud,icloud mais,google one,dropbox,onedrive,armazenamento'],
  ['saida', 'assinaturas', '🤖', 'chatgpt,chat gpt,claude,openai,anthropic,copilot,midjourney,gemini,perplexity,cursor'],
  ['saida', 'assinaturas', '💻', 'microsoft 365,office 365,office,adobe,canva,notion,figma,linkedin premium,duolingo,kindle unlimited,audible,apple one,vpn,nordvpn,antivirus'],
  ['saida', 'assinaturas', '📺', 'netflix,prime video,amazon prime,prime,disney,disney plus,star plus,hbo,hbo max,globoplay,paramount,youtube premium,apple tv,crunchyroll,telecine,mubi,pluto,streaming,assinatura,mensalidade app,ps plus,xbox game pass'],
  // ---- educação ----
  ['saida', 'educacao', '📚', 'faculdade,universidade,mensalidade faculdade,curso,cursos,escola,colegio,creche,material escolar,livro,livros,apostila,udemy,alura,coursera,dio,rocketseat,fiap,senac,senai,anhanguera,unip,uninove,mackenzie,fgv,insper,estacio,cruzeiro do sul,ingles,idiomas,wizard,ccaa,fisk,open english,cambly,certificacao,prova,cisa,cissp,cisp,isaca,iso 27001,pos graduacao,mba,especializacao'],
  // ---- compras ----
  ['saida', 'compras', '🎁', 'presente,presentes,aniversario,amigo secreto,natal,dia das maes,dia dos pais,dia dos namorados,lembrancinha'],
  ['saida', 'compras', '👟', 'tenis,sapato,sandalia,chinelo,havaianas,bota,nike,adidas,puma,mizuno,olympikus,centauro,netshoes,decathlon,artwalk'],
  ['saida', 'compras', '👕', 'roupa,roupas,camisa,camiseta,calca,bermuda,jaqueta,casaco,vestido,cueca,meia,renner,riachuelo,cea,c a,zara,hering,marisa,shein,reserva,youcom,levis,lacoste,farm,insider'],
  ['saida', 'compras', '📦', 'amazon,amazon br,mercado livre,mercadolivre,meli,shopee,aliexpress,ali express,temu,magalu,magazine luiza,americanas,submarino,casas bahia,ponto frio,carrefour online,encomenda,correios,frete,sedex,importacao,taxa importacao,remessa conforme'],
  ['saida', 'compras', '💻', 'notebook,computador,pc,eletronico,eletronicos,fone,fone de ouvido,airpods,headset,teclado,mouse,monitor,iphone,celular novo,smartphone,samsung,xiaomi,motorola,apple store,carregador,cabo,capinha,pelicula,kabum,pichau,terabyte,terabyteshop,fast shop,tv,televisao,videogame,console,smartwatch,apple watch,tablet,ipad'],
  ['saida', 'compras', '🧺', 'eletrodomestico,geladeira,fogao,microondas,maquina de lavar,air fryer,airfryer,liquidificador,aspirador,ventilador,ar condicionado,utensilios,panela'],
  ['saida', 'compras', '🛍️', 'shopping,compras,loja,lojas,comprinhas,miudezas,papelaria,kalunga,daiso,lojas americanas'],
  // ---- outros comuns ----
  ['saida', 'outros', '🤝', 'doacao,dizimo,oferta,vaquinha,caridade,ong'],
  ['saida', 'outros', '💸', 'pix,transferencia,emprestei,emprestimo pra,devolvi,saque,saquei,dinheiro vivo,mesada,pensao'],
  // ======================= ENTRADAS =======================
  ['entrada', 'salario', '💼', 'salario,adiantamento,vale,pagamento,holerite,folha,plr,ppr,participacao nos lucros,decimo terceiro,13o,13,13 salario,ferias,bonus,premio,comissao,hora extra,horas extras,rescisao,fgts,seguro desemprego'],
  ['entrada', 'extra', '💻', 'freela,freelance,job,projeto,consultoria,bico,servico,trampo,aula particular,mentoria'],
  ['entrada', 'extra', '🏷️', 'venda,vendi,olx,enjoei,mercado livre venda,shopee venda,brecho'],
  ['entrada', 'extra', '📈', 'rendimento,rendimentos,dividendos,proventos,jcp,juros recebidos,cdb,lci,lca,tesouro,tesouro direto,investimento,resgate,cashback,fii,fiis'],
  ['entrada', 'extra', '🦁', 'restituicao,restituicao ir,restituicao do ir'],
  ['entrada', 'reembolso', '↩️', 'reembolso,estorno,devolucao,me pagou,me devolveu,acerto,pix de volta,ressarcimento,rachou,dividiu'],
];

const STOP = new Set(['de', 'do', 'da', 'dos', 'das', 'pra', 'pro', 'para', 'com', 'no', 'na', 'nos', 'nas', 'e', 'o', 'a', 'os', 'as', 'em', 'um', 'uma', 'meu', 'minha', 'que', 'por', 'ao', 'mais', 'r', 'rs']);

/** minúsculas, sem acento, sem pontuação, espaços simples. */
export function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
export const tokens = (s: string) => normalizar(s).split(' ').filter((t) => t.length >= 2 && !STOP.has(t));

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

/**
 * Regras fixas: casos em que uma palavra solta engana o dicionário.
 * - 99Pay é pagamento (Pix pelo cartão), não corrida de 99.
 * - Love Suites / motel é lazer, não hospedagem de viagem.
 * - Hospital veterinário é Pets, não Saúde (a palavra "hospital" enganava).
 */
export const REGRAS_FIXAS: { re: RegExp; tipo: Tipo; cat: string; ico: string }[] = [
  { re: /99 ?pay/, tipo: 'saida', cat: 'outros', ico: '💸' },
  { re: /\bmotel|\blove ?suite|\bdrive in\b/, tipo: 'saida', cat: 'lazer', ico: '🏩' },
  { re: /\bhospital vet|\bclinica vet|\bhosp vet/, tipo: 'saida', cat: 'pets', ico: '🐾' },
];
export const regraFixa = (desc: string, tipo: Tipo) => {
  const n = normalizar(desc);
  return REGRAS_FIXAS.find((r) => r.tipo === tipo && r.re.test(n));
};

export function sugerir(desc: string, tipo: Tipo, mem: Memoria = {}): Sugestao | null {
  const norm = normalizar(desc);
  if (norm.length < 2) return null;
  const toks = tokens(desc);

  // 1) aprendido com você: frase inteira, depois a palavra mais usada
  const frase = mem[`${tipo}|${norm}`];
  if (frase) return { cat: frase.cat, ico: frase.ico ?? '', fonte: 'aprendido', termo: norm };
  const regra = regraFixa(desc, tipo); // vale acima de palavras soltas aprendidas ("99" → corrida)
  if (regra) return { cat: regra.cat, ico: regra.ico, fonte: 'dicionario', termo: norm };
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
    if (t.length < 4 || /^\d+$/.test(t)) continue;
    const m = TERMOS.find((x) => x.tipo === tipo && !x.frase && x.termo.length >= 4 && (t.startsWith(x.termo) || (x.termo.startsWith(t) && t.length >= 5)));
    if (m) return { cat: m.cat, ico: m.ico, fonte: 'dicionario', termo: m.termo };
  }
  for (const t of toks) {
    if (t.length < 5 || /^\d+$/.test(t)) continue;
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
  const chaves = new Set([norm, ...tokens(desc).filter((t) => t.length >= 3 && !/^\d+$/.test(t))]);
  chaves.forEach((k) => put(`${tipo}|${k}`));
  // limite de tamanho: mantém os 600 termos mais usados
  const keys = Object.keys(next);
  if (keys.length > 600) keys.sort((a, b) => next[a].n - next[b].n).slice(0, keys.length - 600).forEach((k) => delete next[k]);
  return next;
}
