/**
 * Nome legível da loja a partir do descritor que o banco manda ("MLP*NETSHOES-N" → "Netshoes").
 * Só para EXIBIR: o texto original continua salvo (deduplicação de importação, busca, detalhe).
 * O que o usuário digitou (letras minúsculas, sem código de maquininha) fica como está.
 */
import { normalizar } from './smart';

const MARCAS: [RegExp, string][] = [
  [/99 ?pay/, '99Pay'], [/^pg \*?99\b|\b99 ?(ride|pop|taxi)\b|99app/, '99'], [/99 ?food/, '99Food'],
  [/uber ?rides|^dl ?\*? ?uber|uberprepago|^uber\b/, 'Uber'], [/uber ?eats/, 'Uber Eats'],
  [/shopee/, 'Shopee'], [/amazon ?prime|amazonprime|prime ?video/, 'Amazon Prime'], [/amazon|amzn/, 'Amazon'],
  [/mercado ?livre|mercadolivre|^mercado mercad|melimais|meli ?\+/, 'Mercado Livre'], [/mercado ?pago/, 'Mercado Pago'],
  [/aliexpress/, 'AliExpress'], [/netshoes/, 'Netshoes'], [/kabum/, 'KaBuM!'], [/magalu|magazine ?luiza/, 'Magalu'],
  [/americanas/, 'Americanas'], [/shein/, 'Shein'], [/temu\b/, 'Temu'], [/casas ?bahia/, 'Casas Bahia'],
  [/airbnb/, 'Airbnb'], [/booking/, 'Booking'], [/decolar/, 'Decolar'], [/latam/, 'Latam'], [/smiles/, 'Smiles'],
  [/apple\.com|itunes|^apple\b/, 'Apple'], [/google|youtube/, 'Google'], [/netflix/, 'Netflix'], [/spotify/, 'Spotify'],
  [/disney/, 'Disney+'], [/\bhbo|\bmax\.com/, 'Max'], [/globoplay/, 'Globoplay'], [/deezer/, 'Deezer'],
  [/ingresso\.?com/, 'Ingresso.com'], [/sympla/, 'Sympla'], [/cinemark/, 'Cinemark'],
  [/ifood|^ifd\b/, 'iFood'], [/rappi/, 'Rappi'], [/mc ?donald/, "McDonald's"], [/burger ?king/, 'Burger King'],
  [/\bkfc\b/, 'KFC'], [/starbucks/, 'Starbucks'], [/cacau ?show/, 'Cacau Show'], [/oxxo/, 'Oxxo'],
  [/carrefour/, 'Carrefour'], [/pao ?de ?acucar/, 'Pão de Açúcar'], [/assai/, 'Assaí'], [/atacadao/, 'Atacadão'],
  [/drogasil|droga ?raia|^raia\b/, 'Droga Raia'], [/rd ?saude/, 'RD Saúde'], [/pague ?menos/, 'Pague Menos'],
  [/petlove/, 'Petlove'], [/\bpetz\b/, 'Petz'], [/cobasi/, 'Cobasi'],
  [/renner/, 'Renner'], [/riachuelo/, 'Riachuelo'], [/^c ?& ?a\b|^cea\b/, 'C&A'], [/\bzara\b/, 'Zara'],
  [/centauro/, 'Centauro'], [/decathlon/, 'Decathlon'], [/leroy/, 'Leroy Merlin'],
  [/smart ?fit/, 'Smart Fit'], [/wellhub|gympass/, 'Wellhub'], [/love ?suite/, 'Love Suites'],
  [/\bclaro\b/, 'Claro'], [/\bvivo\b/, 'Vivo'], [/\btim\b/, 'TIM'], [/sem ?parar/, 'Sem Parar'], [/veloe/, 'Veloe'],
  [/\bshell\b/, 'Shell'], [/ipiranga/, 'Ipiranga'], [/pier ?segurador/, 'Pier Seguradora'],
  [/hospital ?vet|hosp ?vet/, 'Hospital Veterinário'], [/vie ?verte/, 'VieVerte'], [/zig ?pay/, 'ZigPay'],
  [/^iof\b/, 'IOF'], [/picpay/, 'PicPay'], [/nubank|nu ?pagamentos/, 'Nubank'], [/paypal/, 'PayPal'],
];

/** Códigos de maquininha/intermediador que vêm antes do "*". */
const ADQUIRENTES = new Set(['mlp', 'mp', 'pg', 'dl', 'ifd', 'jim.com', 'jim', 'zig', 'pag', 'ec', 'ebn', 'pp', 'hna', 'iz', 'sumup', 'apmp', 'nupay', 'pagseguro', 'stone', 'cielo', 'getnet', 'ton', 'inf', 'paypal', 'sq', 'sqp']);
const CIDADE = /(\s|)(sao ?paulo?\s?br|sao ?paulo|sao(?: ?pa?u?l?o?)?|o paulo|s paulo|rio de jane(iro)?|jundiai|osasco|barueri|taboao( da serra)?|campinas|santos|guarulhos|curitiba|belo horizon(te)?|brasilia)(\s?br)?$/i;
const SUFIXO_EMPRESA = /\s(ltda|eireli|me|epp|s\.?a\.?|sa)$/i;
const ACENTOS: Record<string, string> = {
  saude: 'saúde', farmacia: 'farmácia', pao: 'pão', acucar: 'açúcar', sao: 'são', cafe: 'café', acougue: 'açougue',
  conveniencia: 'conveniência', veterinaria: 'veterinária', clinica: 'clínica', otica: 'ótica', eletronicos: 'eletrônicos',
  servicos: 'serviços', comercio: 'comércio', construcao: 'construção', mercadao: 'mercadão', restau: 'restaurante',
  coquetelari: 'coquetelaria', credito: 'crédito', debito: 'débito', diario: 'diário', taboao: 'taboão', jundiai: 'jundiaí', padaria: 'padaria', lanchonete: 'lanchonete', estacionamento: 'estacionamento',
};
const MINUSC = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'em', 'na', 'no']);

/** O texto parece ter vindo do banco (e não digitado)? */
export function ehBruto(desc: string) {
  const letras = desc.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (!letras) return false;
  const maiusc = letras.replace(/[^A-ZÀ-Þ]/g, '').length / letras.length;
  // "PAYGOS o Paulo": começa com palavra toda em maiúsculas (descritor de maquininha com a cidade cortada)
  return desc.includes('*') || maiusc > 0.7 || /[a-z][A-Z]{3,}/.test(desc) || /^[A-Z]{4,}\s/.test(desc);
}

function titulo(s: string) {
  return s.toLowerCase().split(/\s+/).filter(Boolean).map((w, i) => {
    const sem = normalizar(w);
    const acento = ACENTOS[sem];
    const base = acento && w.length === sem.length ? acento : w;
    if (i > 0 && MINUSC.has(base)) return base;
    return base.charAt(0).toUpperCase() + base.slice(1);
  }).join(' ');
}

/** "99 *99PayCAIOG" → "99Pay"; "MLP*NETSHOES-N 4/4" → "Netshoes · 4/4"; "Celular novo" → "Celular novo". */
export function nomeLoja(desc: string, nomes?: Record<string, string>): string {
  if (!desc) return desc;
  const m = desc.match(/^(.*?)\s+(\d{1,2}\/\d{1,2})$/); // sufixo de parcela que o app acrescenta
  const base = m ? m[1] : desc;
  const parc = m ? ` · ${m[2]}` : '';
  const aprendido = nomes?.[normalizar(base)];
  if (aprendido) return aprendido + parc;
  if (!ehBruto(base)) return desc;
  const n = normalizar(base);
  for (const [re, nome] of MARCAS) if (re.test(n)) return nome + parc;
  return limpar(base) + parc;
}

function limpar(bruto: string): string {
  let s = bruto.trim();
  // "PREFIXO*Loja" (maquininha) → Loja; "Loja *X" (filial/vendedor) → Loja
  if (s.includes('*')) {
    const [esq, ...resto] = s.split('*');
    const dir = resto.join(' ').trim();
    s = ADQUIRENTES.has(normalizar(esq).trim()) && dir.length >= 3 ? dir : esq.trim().length >= 3 ? esq : dir;
  }
  s = s.replace(/^[\d.\s/-]{6,}/, ''); // CNPJ/código no começo
  s = s.replace(/\b\d{3,}\b/g, ' '); // números de loja/terminal
  s = s.replace(/([a-z])([A-Z]{3,})/g, '$1 $2'); // "VieVerteSAO" → "VieVerte SAO"
  for (let k = 0; k < 2; k++) s = s.replace(CIDADE, '').replace(SUFIXO_EMPRESA, '').trim();
  s = s.replace(/[_*#]+/g, ' ').replace(/\s-\s?$/, '').replace(/-[A-Z]$/, '').replace(/\s{2,}/g, ' ').trim();
  // palavra cortada no fim ("VET T", "BORGES E G") e conectivo sobrando
  s = s.replace(/\s[A-Za-z]$/, '').replace(/\s(e|de|da|do|no|na)$/i, '').trim();
  return s.length >= 2 ? titulo(s) : titulo(bruto);
}
