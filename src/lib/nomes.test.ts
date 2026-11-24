import { describe, expect, it } from 'vitest';
import { nomeVisivel } from './nomes';
import type { Data, Lancamento } from './types';

const l = (desc: string, importado?: boolean): Lancamento => ({ id: desc, tipo: 'saida', valor: 100, cat: 'outros', desc, data: '2026-11-10', criado: 1, ...(importado ? { importado } : {}) });
const D = (ls: Lancamento[], nomes?: Record<string, string>) => ({ v: 1, onboarded: true, perfil: { nome: 'X' }, saldo: { valor: 0, data: '2026-11-10', ts: 1 }, recorrentes: [], cartoes: [], lancamentos: ls, uso: {}, nomes } as unknown as Data);

describe('nome exibido', () => {
  it('o que você digita aparece exatamente como digitou', () => {
    const d = D([l('ITBI - Apartamento'), l('IPTU'), l('CPTM recarga')]);
    expect(nomeVisivel(d, 'ITBI - Apartamento')).toBe('ITBI - Apartamento');
    expect(nomeVisivel(d, 'IPTU')).toBe('IPTU');
    expect(nomeVisivel(d, 'CPTM recarga')).toBe('CPTM recarga');
  });
  it('fixo digitado (não está em lançamento importado) também fica como digitou', () => {
    expect(nomeVisivel(D([]), 'ITBI - Apartamento')).toBe('ITBI - Apartamento');
  });
  it('texto que veio do banco continua limpo', () => {
    const d = D([l('MLP*NETSHOES-N', true), l('PAG*JOSEDASILVA', true)]);
    expect(nomeVisivel(d, 'MLP*NETSHOES-N')).toBe('Netshoes');
    expect(nomeVisivel(d, 'MLP*NETSHOES-N 2/3')).toBe('Netshoes · 2/3');
  });
  it('sua correção sempre vale', () => {
    const d = D([l('PAG*XPTO LTDA', true)], { 'pag xpto ltda': 'Padaria do Zé' });
    expect(nomeVisivel(d, 'PAG*XPTO LTDA')).toBe('Padaria do Zé');
  });
});
