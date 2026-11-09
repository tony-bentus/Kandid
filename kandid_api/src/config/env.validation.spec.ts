import { validateEnv } from './env.validation.js';

const baseConfig = {
  NODE_ENV: 'test',
  JWT_SECRET: 'a'.repeat(32),
  PORT: '3000',
  DB_HOST: 'localhost',
  DB_PORT: '3306',
  DB_USERNAME: 'kandid',
  DB_PASSWORD: 'kandid',
  DB_DATABASE: 'kandid',
};

describe('validateEnv', () => {
  it('accepts a valid configuration', () => {
    expect(() => validateEnv(baseConfig)).not.toThrow();
  });

  it('rejects a missing or short JWT_SECRET', () => {
    expect(() => validateEnv({ ...baseConfig, JWT_SECRET: undefined })).toThrow(
      /JWT_SECRET/,
    );
    expect(() => validateEnv({ ...baseConfig, JWT_SECRET: 'short' })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ ...baseConfig, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('rejects an invalid PORT', () => {
    expect(() => validateEnv({ ...baseConfig, PORT: '70000' })).toThrow(
      /PORT/,
    );
  });

  it('does not require DB_* variables when DATABASE_URL is set', () => {
    const config = {
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(32),
      PORT: '3000',
      DATABASE_URL: 'mysql://user:pass@host:3306/db',
    };

    expect(() => validateEnv(config)).not.toThrow();
  });

  it('requires DB_* variables when DATABASE_URL is absent', () => {
    const config = { ...baseConfig, DB_DATABASE: undefined };

    expect(() => validateEnv(config)).toThrow(/DB_DATABASE/);
  });

  it('rejects the example JWT_SECRET in production', () => {
    const config = {
      ...baseConfig,
      NODE_ENV: 'production',
      JWT_SECRET: 'change-me-to-a-long-random-secret',
    };

    expect(() => validateEnv(config)).toThrow(/JWT_SECRET/);
  });

  it('allows the example JWT_SECRET outside production', () => {
    const config = {
      ...baseConfig,
      NODE_ENV: 'development',
      JWT_SECRET: 'change-me-to-a-long-random-secret',
    };

    expect(() => validateEnv(config)).not.toThrow();
  });
});
