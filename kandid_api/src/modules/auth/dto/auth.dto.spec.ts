import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { LoginDto } from './login.dto.js';
import { RegisterDto } from './register.dto.js';

const invalidProperties = (errors: ValidationError[]): string[] =>
  errors.map((error) => error.property);

describe('RegisterDto', () => {
  const validPayload = {
    name: 'Ana Souza',
    email: 'ana.souza@example.com',
    password: 'senha-segura-123',
  };

  const build = (overrides: Partial<typeof validPayload> = {}): RegisterDto =>
    plainToInstance(RegisterDto, { ...validPayload, ...overrides });

  it('trims and lowercases the e-mail before validation', async () => {
    const dto = build({ email: '  USER@Example.COM ' });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.email).toBe('user@example.com');
  });

  it('accepts the minimum and maximum password lengths', async () => {
    await expect(
      validate(build({ password: 'a'.repeat(8) })),
    ).resolves.toHaveLength(0);
    await expect(
      validate(build({ password: 'a'.repeat(128) })),
    ).resolves.toHaveLength(0);
  });

  it.each([
    {
      label: 'a name with a single character',
      overrides: { name: 'A' },
      property: 'name',
    },
    {
      label: 'a missing name',
      overrides: { name: undefined },
      property: 'name',
    },
    {
      label: 'a password with 7 characters',
      overrides: { password: 'a'.repeat(7) },
      property: 'password',
    },
    {
      label: 'a password with 129 characters',
      overrides: { password: 'a'.repeat(129) },
      property: 'password',
    },
    {
      label: 'a malformed e-mail',
      overrides: { email: 'not-an-email' },
      property: 'email',
    },
    {
      label: 'a missing e-mail',
      overrides: { email: undefined },
      property: 'email',
    },
  ])('rejects $label', async ({ overrides, property }) => {
    const errors = await validate(build(overrides));

    expect(invalidProperties(errors)).toContain(property);
  });
});

describe('LoginDto', () => {
  const validPayload = {
    email: 'ana.souza@example.com',
    password: 'senha-segura-123',
  };

  const build = (overrides: Partial<typeof validPayload> = {}): LoginDto =>
    plainToInstance(LoginDto, { ...validPayload, ...overrides });

  it('trims and lowercases the e-mail before validation', async () => {
    const dto = build({ email: '  USER@Example.COM ' });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.email).toBe('user@example.com');
  });

  it.each([
    {
      label: 'a missing e-mail',
      overrides: { email: undefined },
      property: 'email',
    },
    {
      label: 'a malformed e-mail',
      overrides: { email: 'not-an-email' },
      property: 'email',
    },
    {
      label: 'a missing password',
      overrides: { password: undefined },
      property: 'password',
    },
    {
      label: 'an empty password',
      overrides: { password: '' },
      property: 'password',
    },
  ])('rejects $label', async ({ overrides, property }) => {
    const errors = await validate(build(overrides));

    expect(invalidProperties(errors)).toContain(property);
  });
});
