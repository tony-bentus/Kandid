import { normalizeText } from './normalize.js';

describe('normalizeText', () => {
  it('trims, lowercases and strips accents', () => {
    expect(normalizeText('  Inglês  ')).toBe('ingles');
    expect(normalizeText('São Paulo')).toBe('sao paulo');
  });

  it('makes accented and unaccented names equal', () => {
    expect(normalizeText('Inglês')).toBe(normalizeText('ingles'));
    expect(normalizeText('Currículo')).toBe(normalizeText('curriculo'));
  });

  it('preserves symbols such as the plus sign in C++', () => {
    expect(normalizeText('C++')).toBe('c++');
    expect(normalizeText('C#')).toBe('c#');
  });

  it('leaves already normalized text unchanged', () => {
    expect(normalizeText('node')).toBe('node');
    expect(normalizeText('tdd')).toBe('tdd');
  });
});
