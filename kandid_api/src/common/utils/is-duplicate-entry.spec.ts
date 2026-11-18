import { QueryFailedError } from 'typeorm';
import { isDuplicateEntry } from './is-duplicate-entry.js';

const queryFailed = (driverError: unknown): QueryFailedError =>
  new QueryFailedError('INSERT INTO profile_skills', [], driverError as Error);

const duplicateDriverError = (details: {
  code?: unknown;
  sqlMessage?: unknown;
  constraint?: unknown;
}): Error =>
  Object.assign(new Error('Duplicate entry'), details);

describe('isDuplicateEntry', () => {
  it('matches ER_DUP_ENTRY when the sqlMessage contains the fragment', () => {
    const error = queryFailed(
      duplicateDriverError({
        code: 'ER_DUP_ENTRY',
        sqlMessage:
          "Duplicate entry 'a-1' for key 'UQ_profile_skills_profile_skill'",
      }),
    );

    expect(isDuplicateEntry(error, 'UQ_profile_skills_profile_skill')).toBe(
      true,
    );
  });

  it('falls back to the constraint when sqlMessage is missing', () => {
    const error = queryFailed(
      duplicateDriverError({
        code: 'ER_DUP_ENTRY',
        constraint: 'UQ_profile_skills_profile_skill',
      }),
    );

    expect(isDuplicateEntry(error, 'profile_skills')).toBe(true);
  });

  it('rejects a duplicate from a different constraint', () => {
    const error = queryFailed(
      duplicateDriverError({
        code: 'ER_DUP_ENTRY',
        sqlMessage: "Duplicate entry 'x' for key 'UQ_users_email'",
      }),
    );

    expect(isDuplicateEntry(error, 'profile_skills')).toBe(false);
  });

  it('rejects QueryFailedError with another driver code', () => {
    const error = queryFailed(
      duplicateDriverError({
        code: 'ER_BAD_FIELD_ERROR',
        sqlMessage: "Unknown column 'profile_skills' in 'field list'",
      }),
    );

    expect(isDuplicateEntry(error, 'profile_skills')).toBe(false);
  });

  it.each([
    ['a plain Error', new Error('ER_DUP_ENTRY profile_skills')],
    ['an object', { code: 'ER_DUP_ENTRY' }],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'ER_DUP_ENTRY'],
  ])('rejects %s', (_label, error) => {
    expect(isDuplicateEntry(error, 'profile_skills')).toBe(false);
  });

  it('rejects a QueryFailedError without ER_DUP_ENTRY details', () => {
    expect(
      isDuplicateEntry(queryFailed(new Error('query failed')), 'profile_skills'),
    ).toBe(false);
  });
});
