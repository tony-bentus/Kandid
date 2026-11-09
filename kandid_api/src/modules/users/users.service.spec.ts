import type { FindOneOptions, Repository } from 'typeorm';
import { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';

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

describe('UsersService', () => {
  const repository = {
    findOne: vi.fn<(options: FindOneOptions<User>) => Promise<User | null>>(),
    create: vi.fn<(input: Partial<User>) => User>(),
    save: vi.fn<(user: User) => Promise<User>>(),
  };

  let service: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UsersService(repository as unknown as Repository<User>);
  });

  describe('findByEmail', () => {
    it('normalizes the e-mail before querying', async () => {
      const user = makeUser();
      repository.findOne.mockResolvedValueOnce(user);

      const result = await service.findByEmail('  Jane.Doe@Example.COM ');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: 'jane.doe@example.com' },
      });
      expect(result).toBe(user);
    });

    it('returns null when the e-mail is not registered', async () => {
      repository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findByEmail('missing@example.com'),
      ).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('normalizes the e-mail before persisting', async () => {
      repository.create.mockImplementation((input) => makeUser(input));
      repository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await service.create({
        name: 'Jane Doe',
        email: '  Jane.Doe@Example.COM ',
        passwordHash: 'hashed-password',
      });

      expect(repository.create).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        passwordHash: 'hashed-password',
      });
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(result.email).toBe('jane.doe@example.com');
    });
  });

  describe('findById', () => {
    it('queries by the given id', async () => {
      const user = makeUser();
      repository.findOne.mockResolvedValueOnce(user);

      const result = await service.findById(user.id);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: user.id },
      });
      expect(result).toBe(user);
    });
  });
});
