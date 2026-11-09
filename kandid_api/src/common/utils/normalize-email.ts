export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

export const normalizeEmailValue = (value: unknown): unknown =>
  typeof value === 'string' ? normalizeEmail(value) : value;
