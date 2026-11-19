import { formatSnapshotDate } from './format-date.js';

describe('formatSnapshotDate', () => {
  it('converte YYYY-MM para MM/YYYY', () => {
    expect(formatSnapshotDate('2021-03')).toBe('03/2021');
    expect(formatSnapshotDate('2019-12')).toBe('12/2019');
  });

  it('converte YYYY-MM-DD para DD/MM/YYYY', () => {
    expect(formatSnapshotDate('2015-02-01')).toBe('01/02/2015');
    expect(formatSnapshotDate('2019-12-31')).toBe('31/12/2019');
  });

  it('omite ausentes, inválidos e formatos diferentes sem lançar', () => {
    expect(formatSnapshotDate(null)).toBeNull();
    expect(formatSnapshotDate(undefined)).toBeNull();
    expect(formatSnapshotDate('')).toBeNull();
    expect(formatSnapshotDate('2021/03')).toBeNull();
    expect(formatSnapshotDate('2021-13')).toBeNull();
    expect(formatSnapshotDate('2021-00-10')).toBeNull();
    expect(formatSnapshotDate('2021-03-99')).toBeNull();
    expect(formatSnapshotDate('Atual')).toBeNull();
  });
});
