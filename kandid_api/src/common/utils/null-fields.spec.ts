import { BadRequestException } from '@nestjs/common';
import { assertNoForcedNull, hasField } from './null-fields.js';

describe('hasField', () => {
  it('detects own properties with a value, including explicit null', () => {
    expect(hasField({ headline: 'Backend Developer' }, 'headline')).toBe(true);
    expect(hasField({ headline: null }, 'headline')).toBe(true);
  });

  it('ignores undefined properties materialized by class-transformer', () => {
    expect(hasField({ headline: undefined }, 'headline')).toBe(false);
  });

  it('ignores missing and inherited properties', () => {
    expect(hasField({}, 'headline')).toBe(false);
    expect(hasField({}, 'toString')).toBe(false);
  });
});

describe('assertNoForcedNull', () => {
  it('accepts absent fields', () => {
    expect(() => assertNoForcedNull({}, ['currency', 'headline'])).not.toThrow();
  });

  it('accepts fields present with a value or undefined', () => {
    expect(() =>
      assertNoForcedNull({ currency: 'BRL', headline: undefined }, [
        'currency',
        'headline',
      ]),
    ).not.toThrow();
  });

  it('rejects an explicit null with a message naming the field', () => {
    expect(() =>
      assertNoForcedNull({ currency: null }, ['currency']),
    ).toThrow(BadRequestException);
    expect(() =>
      assertNoForcedNull({ currency: null }, ['currency']),
    ).toThrow('currency');
  });

  it('ignores null in a field outside the provided list', () => {
    expect(() =>
      assertNoForcedNull({ summary: null }, ['currency']),
    ).not.toThrow();
  });
});
