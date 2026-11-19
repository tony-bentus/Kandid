import { BadRequestException } from '@nestjs/common';
import { assertNoQueryParams } from './assert-no-query-params.js';

const thrown = (query: Record<string, unknown>): BadRequestException => {
  try {
    assertNoQueryParams(query);
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return error as BadRequestException;
  }
  throw new Error('Expected assertNoQueryParams to throw');
};

describe('assertNoQueryParams', () => {
  it('accepts an empty query object', () => {
    expect(() => assertNoQueryParams({})).not.toThrow();
  });

  it('rejects one key with the contract message', () => {
    expect(thrown({ _noQueryParams: '' }).message).toBe(
      'Unsupported query parameters: _noQueryParams. Supported: none',
    );
  });

  it('lists both keys in order when two are present', () => {
    expect(thrown({ currency: 'BRL', page: '1' }).message).toBe(
      'Unsupported query parameters: currency, page. Supported: none',
    );
  });
});
