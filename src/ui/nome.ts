import { nomeVisivel } from '../lib/nomes';
import { getData } from '../store';

/** Nome pra exibir: como você digitou; só o que veio do banco é limpo (ver lib/nomes). */
export const nomeExib = (desc: string) => nomeVisivel(getData(), desc);
