import { nomeLoja } from '../lib/lojas';
import { getData } from '../store';

/** Nome pra exibir (loja legível; o que o usuário corrigiu vale). O texto salvo não muda. */
export const nomeExib = (desc: string) => nomeLoja(desc, getData().nomes);
