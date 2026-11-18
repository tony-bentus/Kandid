import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { User } from '../users/entities/user.entity.js';
import { type CreateUserInput, UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

const PASSWORD_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12',
  name: 'Jane Doe',
  email: 'jane.doe@example.com',
  passwordHash: 'hashed-password',
  createdAt: new Date('2026-11-09T12:00:00.000Z'),
  updatedAt: new Date('2026-11-09T12:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

describe('AuthService', () => {
  const password = 'S3curePass!';
  const usersService = {
    findByEmail: vi.fn<(email: string) => Promise<User | null>>(),
    findById: vi.fn<(id: string) => Promise<User | null>>(),
    create: vi.fn<(input: CreateUserInput) => Promise<User>>(),
  };
  const jwtService = {
    signAsync:
      vi.fn<(payload: { sub: string; email: string }) => Promise<string>>(),
  };

  let service: AuthService;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await argon2.hash(password, PASSWORD_HASH_OPTIONS);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
    );
  });

  describe('register', () => {
    it('creates the user, hashes the password and returns a token', async () => {
      usersService.findByEmail.mockResolvedValueOnce(null);
      usersService.create.mockImplementationOnce((input) =>
        Promise.resolve(makeUser(input)),
      );
      jwtService.signAsync.mockResolvedValueOnce('signed-token');

      const result = await service.register({
        name: 'Jane Doe',
        email: '  New.User@Example.COM ',
        password,
      });

      expect(usersService.findByEmail).toHaveBeenCalledWith(
        'new.user@example.com',
      );

      const createInput = usersService.create.mock.calls[0]?.[0];

      if (!createInput) {
        throw new Error('UsersService.create was not called');
      }

      expect(createInput.email).toBe('new.user@example.com');
      expect(createInput.passwordHash).not.toBe(password);
      expect(createInput.passwordHash).toMatch(
        /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/,
      );
      await expect(
        argon2.verify(createInput.passwordHash, password),
      ).resolves.toBe(true);

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user.email).toBe('new.user@example.com');
      expect(result.accessToken).toBe('signed-token');
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: result.user.id,
        email: 'new.user@example.com',
      });
    });

    it('rejects an already registered e-mail with 409', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());

      const registration = service.register({
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        password,
      });

      await expect(registration).rejects.toBeInstanceOf(ConflictException);
      await expect(registration).rejects.toThrow('Email already registered');
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('maps a concurrent unique violation to 409', async () => {
      usersService.findByEmail.mockResolvedValueOnce(null);
      usersService.create.mockRejectedValueOnce(
        Object.assign(new Error('Duplicate entry'), {
          driverError: { code: 'ER_DUP_ENTRY' },
        }),
      );

      const registration = service.register({
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        password,
      });

      await expect(registration).rejects.toBeInstanceOf(ConflictException);
      await expect(registration).rejects.toThrow('Email already registered');
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a token for valid credentials', async () => {
      const user = makeUser({ passwordHash });
      usersService.findByEmail.mockResolvedValueOnce(user);
      jwtService.signAsync.mockResolvedValueOnce('signed-token');

      const result = await service.login({
        email: 'Jane.Doe@Example.COM',
        password,
      });

      expect(result.user.id).toBe(user.id);
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.accessToken).toBe('signed-token');
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
      });
    });

    it('rejects a wrong password with a generic message', async () => {
      usersService.findByEmail.mockResolvedValueOnce(
        makeUser({ passwordHash }),
      );

      const error = await service
        .login({ email: 'jane.doe@example.com', password: 'wrong-password' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).toBe(
        'Invalid email or password',
      );
    });

    it('rejects an unknown e-mail with the same generic message', async () => {
      usersService.findByEmail.mockResolvedValueOnce(null);

      const missingUserError = await service
        .login({ email: 'missing@example.com', password })
        .catch((caught: unknown) => caught);

      usersService.findByEmail.mockResolvedValueOnce(
        makeUser({ passwordHash }),
      );
      const wrongPasswordError = await service
        .login({ email: 'jane.doe@example.com', password: 'wrong-password' })
        .catch((caught: unknown) => caught);

      expect(missingUserError).toBeInstanceOf(UnauthorizedException);
      expect(wrongPasswordError).toBeInstanceOf(UnauthorizedException);
      expect((missingUserError as UnauthorizedException).message).toBe(
        'Invalid email or password',
      );
      expect((missingUserError as UnauthorizedException).message).toBe(
        (wrongPasswordError as UnauthorizedException).message,
      );
    });
  });

  describe('getCurrentUser', () => {
    it('returns the public user when the token subject still exists', async () => {
      const user = makeUser();
      usersService.findById.mockResolvedValueOnce(user);

      const result = await service.getCurrentUser(user.id);

      expect(result).toEqual({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('rejects when the token subject no longer exists', async () => {
      usersService.findById.mockResolvedValueOnce(null);

      await expect(
        service.getCurrentUser('deleted-user'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
