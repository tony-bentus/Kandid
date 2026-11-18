import { bigintCentsToNumber, numberToBigintCents } from './money.js';

describe('bigintCentsToNumber', () => {
  it('returns null when there is no value', () => {
    expect(bigintCentsToNumber(null)).toBeNull();
  });

  it.each([
    ['0', 0],
    ['1500000', 1500000],
    [String(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
  ])('converts %s to a number', (raw, expected) => {
    expect(bigintCentsToNumber(raw)).toBe(expected);
  });

  it('rejects negative values', () => {
    expect(() => bigintCentsToNumber('-1')).toThrow(RangeError);
  });

  it('rejects values above the safe integer range', () => {
    expect(() =>
      bigintCentsToNumber(String(Number.MAX_SAFE_INTEGER + 1)),
    ).toThrow(RangeError);
  });
});

describe('numberToBigintCents', () => {
  it('returns null when there is no value', () => {
    expect(numberToBigintCents(null)).toBeNull();
  });

  it.each([
    [0, '0'],
    [1500000, '1500000'],
    [Number.MAX_SAFE_INTEGER, String(Number.MAX_SAFE_INTEGER)],
  ])('converts %s to a string', (value, expected) => {
    expect(numberToBigintCents(value)).toBe(expected);
  });

  it.each([
    ['a negative value', -1],
    ['a fractional value', 1.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a value above the safe integer range', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects %s', (_label, value) => {
    expect(() => numberToBigintCents(value)).toThrow(RangeError);
  });
});
