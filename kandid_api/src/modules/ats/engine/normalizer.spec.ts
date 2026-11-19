import { normalize } from './normalizer.js';

describe('normalize', () => {
  it('lowercases the whole input', () => {
    expect(normalize('NODE.JS')).toBe('nodejs');
    expect(normalize('TypeScript')).toBe('typescript');
  });

  it('removes accents (NFD + diacritic marks)', () => {
    expect(normalize('Análise de Currículo')).toBe('analise de curriculo');
    expect(normalize('Inglês Avançado')).toBe('ingles avancado');
    expect(normalize('São Paulo')).toBe('sao paulo');
  });

  it('collapses repeated whitespace and trims the ends', () => {
    expect(normalize('  Node   JS  ')).toBe('node js');
    expect(normalize('a\t\n b')).toBe('a b');
  });

  it('canonicalizes symbols before tokenizing', () => {
    expect(normalize('C++')).toBe('cpp');
    expect(normalize('C#')).toBe('csharp');
    expect(normalize('.NET')).toBe('dotnet');
    expect(normalize('Node.js')).toBe('nodejs');
    expect(normalize('CI/CD')).toBe('cicd');
  });

  it('normalizes the ADR example to "nodejs cpp cicd"', () => {
    expect(normalize('Node.JS  c++  CI/CD')).toBe('nodejs cpp cicd');
  });

  it('preserves digits used for years of experience', () => {
    expect(normalize('5+ anos')).toContain('5');
    expect(normalize('10 anos')).toBe('10 anos');
    expect(normalize('3 years')).toBe('3 years');
    expect(normalize('Node.js 12 anos')).toContain('12');
  });

  it('makes accented and unaccented input equal', () => {
    expect(normalize('Sênior')).toBe(normalize('senior'));
    expect(normalize('Inglês')).toBe(normalize('Ingles'));
  });

  it('is idempotent', () => {
    const input = 'Node.JS  C++  CI/CD - 5+ anos';
    expect(normalize(normalize(input))).toBe(normalize(input));
  });
});
