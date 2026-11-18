import { decimalToNumber, numberToDecimal } from './decimal.js';

describe('decimalToNumber', () => {
  it('returns null when there is no value', () => {
    expect(decimalToNumber(null)).toBeNull();
  });

  it.each([
    ['0.0', 0],
    ['5.5', 5.5],
    ['99.9', 99.9],
  ])('converts %s to a number', (raw, expected) => {
    expect(decimalToNumber(raw)).toBe(expected);
  });

  it.each(['not-a-number', 'Infinity'])('rejects %s', (raw) => {
    expect(() => decimalToNumber(raw)).toThrow(RangeError);
  });
});

describe('numberToDecimal', () => {
  it('returns null when there is no value', () => {
    expect(numberToDecimal(null)).toBeNull();
  });

  it.each([
    [0, '0.0'],
    [5.5, '5.5'],
    [8.7, '8.7'],
    [99.9, '99.9'],
  ])('formats %s as %s', (value, expected) => {
    expect(numberToDecimal(value)).toBe(expected);
  });

  it.each([
    ['a negative value', -1],
    ['a value above the limit', 1000],
    ['more than one decimal place', 5.55],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('rejects %s', (_label, value) => {
    expect(() => numberToDecimal(value)).toThrow(RangeError);
  });
});
