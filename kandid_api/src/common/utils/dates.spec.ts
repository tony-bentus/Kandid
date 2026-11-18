import { BadRequestException } from '@nestjs/common';
import { assertDateOrder, dateOnlyToUtcMs } from './dates.js';

describe('dateOnlyToUtcMs', () => {
  it('uses UTC components, independent of the local timezone', () => {
    expect(dateOnlyToUtcMs('2026-11-18')).toBe(Date.UTC(2026, 10, 18));
    expect(dateOnlyToUtcMs('2026-01-01')).toBe(Date.UTC(2026, 0, 1));
  });

  it('handles leap days', () => {
    expect(dateOnlyToUtcMs('2024-02-29')).toBe(Date.UTC(2024, 1, 29));
  });

  it('returns NaN for a malformed value (DTO validation rejects it)', () => {
    expect(Number.isNaN(dateOnlyToUtcMs('not-a-date'))).toBe(true);
  });
});

describe('assertDateOrder', () => {
  it('accepts a null end date', () => {
    expect(() => assertDateOrder('2026-01-01', null, 'startDate')).not.toThrow();
  });

  it('accepts equal dates', () => {
    expect(() =>
      assertDateOrder('2026-01-01', '2026-01-01', 'startDate'),
    ).not.toThrow();
  });

  it('accepts an end date after the start date', () => {
    expect(() =>
      assertDateOrder('2025-12-31', '2026-01-01', 'startDate'),
    ).not.toThrow();
  });

  it('rejects an end date before the start date with a clear message', () => {
    expect(() =>
      assertDateOrder('2026-01-01', '2025-12-31', 'startDate'),
    ).toThrow(BadRequestException);
    expect(() =>
      assertDateOrder('2026-01-01', '2025-12-31', 'startDate'),
    ).toThrow('endDate must be greater than or equal to startDate');
  });

  it('mentions the field used as the start reference', () => {
    expect(() =>
      assertDateOrder('2026-03-10', '2026-03-09', 'issueDate'),
    ).toThrow('issueDate');
  });

  it('accepts a custom end field for certification dates', () => {
    expect(() =>
      assertDateOrder('2026-03-10', '2026-03-09', 'issueDate', 'expiryDate'),
    ).toThrow('expiryDate must be greater than or equal to issueDate');
  });
});
