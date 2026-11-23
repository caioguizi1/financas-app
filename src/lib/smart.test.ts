import { describe, expect, it } from 'vitest';
import { aprender, normalizar, sugerir } from './smart';

describe('dicionário', () => {
  it('ignora acento e maiúscula', () => {
    expect(normalizar('Ração do PÉT!')).toBe('racao do pet');
    expect(sugerir('Ração', 'saida')).toMatchObject({ cat: 'pets', ico: '🐾' });
  });
  it('reconhece palavras e frases comuns', () => {
    expect(sugerir('pet', 'saida')?.ico).toBe('🐾');
    expect(sugerir('banho e tosa do Thor', 'saida')?.cat).toBe('pets');
    expect(sugerir('Uber pra casa', 'saida')?.cat).toBe('transporte');
    expect(sugerir('Pão de Açúcar', 'saida')?.cat).toBe('mercado');
    expect(sugerir('iFood', 'saida')?.ico).toBe('🍔');
    expect(sugerir('Smart Fit', 'saida')?.ico).toBe('🏋️');
  });
  it('tolera plural e erro de digitação', () => {
    expect(sugerir('remedios', 'saida')?.cat).toBe('saude');
    expect(sugerir('netflx', 'saida')?.cat).toBe('assinaturas');
    expect(sugerir('gasolna', 'saida')?.ico).toBe('⛽');
  });
  it('separa entrada de saída', () => {
    expect(sugerir('freela site', 'entrada')?.cat).toBe('extra');
    expect(sugerir('ifood', 'entrada')).toBeNull();
  });
  it('não inventa quando não sabe', () => {
    expect(sugerir('xpto qwerty', 'saida')).toBeNull();
    expect(sugerir('a', 'saida')).toBeNull();
  });
});

describe('aprendizado', () => {
  it('o que o usuário ensinou vence o dicionário', () => {
    let mem = {};
    expect(sugerir('Thor', 'saida')).toBeNull();
    mem = aprender(mem, 'Ração do Thor', 'saida', 'pets', '🐾');
    expect(sugerir('thor', 'saida', mem)).toMatchObject({ cat: 'pets', fonte: 'aprendido' });
    // usuário corrige "uber" pra outra categoria: passa a valer a escolha dele
    mem = aprender(mem, 'Uber', 'saida', 'lazer', '🎉');
    expect(sugerir('uber', 'saida', mem)).toMatchObject({ cat: 'lazer', fonte: 'aprendido' });
  });
  it('conta repetições', () => {
    let mem = aprender({}, 'Feira', 'saida', 'mercado');
    mem = aprender(mem, 'feira', 'saida', 'mercado');
    expect(mem['saida|feira'].n).toBe(2);
  });
});
