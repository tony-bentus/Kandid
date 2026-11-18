import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  QueryFailedError,
  type FindManyOptions,
  type FindOneOptions,
  type FindOptionsWhere,
  type Repository,
} from 'typeorm';
import { SkillCategory } from '../../common/enums/skill-category.enum.js';
import { SkillLevel } from '../../common/enums/skill-level.enum.js';
import { Profile } from '../profiles/entities/profile.entity.js';
import { UpdateProfileSkillDto } from './dto/update-profile-skill.dto.js';
import { ProfileSkill } from './entities/profile-skill.entity.js';
import { Skill } from './entities/skill.entity.js';
import { SkillsService } from './skills.service.js';

const USER_ID = '6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33';
const PROFILE_ID = '5b0f2a8e-4f3c-4f9a-9c1e-2d7a6b8e0f12';
const SKILL_ID = '3c4f9a9c-1e2d-4f12-8e4f-6b8e5b0f2a8e';
const LINK_ID = 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a';
const CURRENT_YEAR = new Date().getUTCFullYear();

const makeSkill = (overrides: Partial<Skill> = {}): Skill => ({
  id: SKILL_ID,
  name: 'Node.js',
  slug: 'node-js',
  category: SkillCategory.FRAMEWORK,
  aliases: ['Node', 'NodeJS'],
  createdAt: new Date('2026-11-09T12:00:00.000Z'),
  updatedAt: new Date('2026-11-09T12:00:00.000Z'),
  ...overrides,
});

const makeProfile = (overrides: Partial<Profile> = {}): Profile =>
  ({ id: PROFILE_ID, userId: USER_ID, ...overrides }) as unknown as Profile;

const makeProfileSkill = (overrides: Partial<ProfileSkill> = {}): ProfileSkill => ({
  id: LINK_ID,
  profileId: PROFILE_ID,
  skillId: SKILL_ID,
  level: SkillLevel.ADVANCED,
  yearsExperience: '5.5',
  lastUsedYear: CURRENT_YEAR,
  skill: makeSkill(),
  createdAt: new Date('2026-11-09T12:00:00.000Z'),
  updatedAt: new Date('2026-11-09T12:00:00.000Z'),
  ...overrides,
}) as unknown as ProfileSkill;

const duplicateError = (constraint: string): QueryFailedError =>
  new QueryFailedError(
    'INSERT INTO profile_skills',
    [],
    Object.assign(new Error('Duplicate entry'), {
      code: 'ER_DUP_ENTRY',
      sqlMessage: `Duplicate entry 'x' for key '${constraint}'`,
    }),
  );

describe('SkillsService', () => {
  const skillsRepository = {
    find: vi.fn<(options: FindManyOptions<Skill>) => Promise<Skill[]>>(),
    existsBy: vi.fn<(where: FindOptionsWhere<Skill>) => Promise<boolean>>(),
    delete: vi.fn<() => Promise<unknown>>(),
  };
  const profileSkillsRepository = {
    find: vi.fn<
      (options: FindManyOptions<ProfileSkill>) => Promise<ProfileSkill[]>
    >(),
    findOne: vi.fn<
      (options: FindOneOptions<ProfileSkill>) => Promise<ProfileSkill | null>
    >(),
    existsBy: vi.fn<(where: FindOptionsWhere<ProfileSkill>) => Promise<boolean>>(),
    create: vi.fn<(input: Partial<ProfileSkill>) => ProfileSkill>(),
    save: vi.fn<(link: ProfileSkill) => Promise<ProfileSkill>>(),
    remove: vi.fn<(link: ProfileSkill) => Promise<ProfileSkill>>(),
  };
  const profilesRepository = {
    findOne: vi.fn<(options: FindOneOptions<Profile>) => Promise<Profile | null>>(),
  };

  let service: SkillsService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new SkillsService(
      skillsRepository as unknown as Repository<Skill>,
      profileSkillsRepository as unknown as Repository<ProfileSkill>,
      profilesRepository as unknown as Repository<Profile>,
    );
  });

  const mockProfile = (): void => {
    profilesRepository.findOne.mockResolvedValue(makeProfile());
  };

  const mockWritableLink = (): void => {
    profileSkillsRepository.create.mockImplementation((input) =>
      makeProfileSkill(input),
    );
    profileSkillsRepository.save.mockImplementation((link) =>
      Promise.resolve(link),
    );
    profileSkillsRepository.findOne.mockResolvedValue(makeProfileSkill());
  };

  const validCreateDto = {
    skillId: SKILL_ID,
    level: SkillLevel.ADVANCED,
    yearsExperience: 5.5,
    lastUsedYear: CURRENT_YEAR,
  };

  describe('search', () => {
    it('busca por nome e alias normalizando caixa, espaços e acentos', async () => {
      skillsRepository.find.mockResolvedValue([
        makeSkill({ id: 'node', name: 'Node.js', aliases: ['Node', 'NodeJS'] }),
        makeSkill({
          id: 'pg',
          name: 'PostgreSQL',
          aliases: ['Postgres'],
        }),
        makeSkill({ id: 'k8s', name: 'Kubernetes', aliases: ['K8s'] }),
        makeSkill({
          id: 'comm',
          name: 'Comunicação',
          aliases: ['Comunicação'],
        }),
      ]);

      await expect(service.search({ q: ' NODE ' })).resolves.toMatchObject([
        { id: 'node' },
      ]);
      await expect(service.search({ q: 'postgres' })).resolves.toMatchObject([
        { id: 'pg' },
      ]);
      await expect(service.search({ q: 'K8S' })).resolves.toMatchObject([
        { id: 'k8s' },
      ]);
      await expect(service.search({ q: 'comunicacao' })).resolves.toMatchObject([
        { id: 'comm' },
      ]);
      expect(skillsRepository.find).toHaveBeenCalledWith({
        order: { name: 'ASC' },
      });
    });

    it('ordena match exato antes de prefixo e contém', async () => {
      skillsRepository.find.mockResolvedValue([
        makeSkill({
          id: 'contains',
          name: 'Version Manager for Node',
          aliases: [],
        }),
        makeSkill({ id: 'prefix', name: 'Node.js', aliases: ['NodeJS'] }),
        makeSkill({ id: 'exact', name: 'Node', aliases: [] }),
        makeSkill({ id: 'other', name: 'React', aliases: [] }),
      ]);

      const result = await service.search({ q: 'node' });

      expect(result.map((skill) => skill.id)).toEqual([
        'exact',
        'prefix',
        'contains',
      ]);
    });

    it('ignora aliases não-string e mapeia todos os campos da resposta', async () => {
      skillsRepository.find.mockResolvedValue([
        makeSkill({
          aliases: ['Node', 42, null] as unknown as string[],
        }),
      ]);

      const result = await service.search({ q: 'node' });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: SKILL_ID,
        name: 'Node.js',
        slug: 'node-js',
        category: SkillCategory.FRAMEWORK,
        aliases: ['Node'],
      });
    });

    it('lista por nome normalizado com desempate por id quando q está vazio', async () => {
      skillsRepository.find.mockResolvedValue([
        makeSkill({ id: 'z', name: 'Zebra', aliases: [] }),
        makeSkill({ id: 'node-a', name: 'node', aliases: [] }),
        makeSkill({ id: 'b', name: 'bebê', aliases: [] }),
        makeSkill({ id: 'a', name: 'Ágil', aliases: [] }),
        makeSkill({ id: 'node-z', name: 'Node', aliases: [] }),
      ]);

      const result = await service.search({});

      expect(result.map((skill) => skill.id)).toEqual([
        'a',
        'b',
        'node-a',
        'node-z',
        'z',
      ]);
    });

    it('aplica limit padrão 20, explícito e o máximo de 50', async () => {
      const catalog = Array.from({ length: 55 }, (_, index) =>
        makeSkill({
          id: `skill-${index}`,
          name: `Skill ${String(index).padStart(2, '0')}`,
          aliases: [],
        }),
      );
      skillsRepository.find.mockResolvedValue(catalog);

      expect(await service.search({})).toHaveLength(20);
      expect(await service.search({ q: 'skill' })).toHaveLength(20);
      expect(await service.search({ q: 'skill', limit: 50 })).toHaveLength(50);
      expect((await service.search({ limit: 1 })).map((skill) => skill.name)).toEqual([
        'Skill 00',
      ]);
    });
  });

  describe('addProfileSkill', () => {
    it('cria o vínculo com decimal persistido como string e skill aninhada', async () => {
      mockProfile();
      skillsRepository.existsBy.mockResolvedValue(true);
      profileSkillsRepository.existsBy.mockResolvedValue(false);
      const linkedSkill = makeSkill();
      profileSkillsRepository.create.mockImplementation((input) =>
        makeProfileSkill(input),
      );
      profileSkillsRepository.save.mockImplementation((link) =>
        Promise.resolve(link),
      );
      profileSkillsRepository.findOne.mockResolvedValue(
        makeProfileSkill({ skill: linkedSkill }),
      );

      const result = await service.addProfileSkill(USER_ID, validCreateDto);

      expect(profileSkillsRepository.create).toHaveBeenCalledWith({
        profileId: PROFILE_ID,
        skillId: SKILL_ID,
        level: SkillLevel.ADVANCED,
        yearsExperience: '5.5',
        lastUsedYear: CURRENT_YEAR,
      });
      expect(profileSkillsRepository.findOne).toHaveBeenCalledWith({
        where: { id: LINK_ID, profileId: PROFILE_ID },
        relations: { skill: true },
      });
      expect(result.yearsExperience).toBe(5.5);
      expect(result.skill).toEqual({
        id: SKILL_ID,
        name: 'Node.js',
        slug: 'node-js',
        category: SkillCategory.FRAMEWORK,
        aliases: ['Node', 'NodeJS'],
      });
    });

    it('responde 404 quando o usuário não tem perfil', async () => {
      profilesRepository.findOne.mockResolvedValue(null);

      await expect(
        service.addProfileSkill(USER_ID, validCreateDto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(skillsRepository.existsBy).not.toHaveBeenCalled();
    });

    it('responde 404 quando a skill não existe no catálogo', async () => {
      mockProfile();
      skillsRepository.existsBy.mockResolvedValue(false);

      await expect(
        service.addProfileSkill(USER_ID, validCreateDto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(profileSkillsRepository.create).not.toHaveBeenCalled();
    });

    it('responde 409 quando o vínculo já existe', async () => {
      mockProfile();
      skillsRepository.existsBy.mockResolvedValue(true);
      profileSkillsRepository.existsBy.mockResolvedValue(true);

      await expect(
        service.addProfileSkill(USER_ID, validCreateDto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(profileSkillsRepository.save).not.toHaveBeenCalled();
    });

    it('traduz ER_DUP_ENTRY da constraint esperada para 409', async () => {
      mockProfile();
      skillsRepository.existsBy.mockResolvedValue(true);
      profileSkillsRepository.existsBy.mockResolvedValue(false);
      mockWritableLink();
      profileSkillsRepository.save.mockRejectedValueOnce(
        duplicateError('UQ_profile_skills_profile_skill'),
      );

      await expect(
        service.addProfileSkill(USER_ID, validCreateDto),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('propaga ER_DUP_ENTRY de constraint alheia e outros erros de query', async () => {
      mockProfile();
      skillsRepository.existsBy.mockResolvedValue(true);
      profileSkillsRepository.existsBy.mockResolvedValue(false);
      mockWritableLink();
      const otherConstraint = duplicateError('UQ_users_email');
      profileSkillsRepository.save.mockRejectedValueOnce(otherConstraint);

      await expect(
        service.addProfileSkill(USER_ID, validCreateDto),
      ).rejects.toBe(otherConstraint);

      profileSkillsRepository.save.mockRejectedValueOnce(
        new QueryFailedError(
          'INSERT INTO profile_skills',
          [],
          Object.assign(new Error('lock'), { code: 'ER_LOCK_WAIT_TIMEOUT' }),
        ),
      );

      await expect(
        service.addProfileSkill(USER_ID, validCreateDto),
      ).rejects.toBeInstanceOf(QueryFailedError);
    });

    it('aceita 5.5 e rejeita 5.55 e 100 com 400', async () => {
      mockProfile();
      skillsRepository.existsBy.mockResolvedValue(true);
      profileSkillsRepository.existsBy.mockResolvedValue(false);
      mockWritableLink();

      await expect(
        service.addProfileSkill(USER_ID, validCreateDto),
      ).resolves.toBeDefined();
      expect(profileSkillsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ yearsExperience: '5.5' }),
      );

      await expect(
        service.addProfileSkill(USER_ID, {
          ...validCreateDto,
          yearsExperience: 5.55,
        }),
      ).rejects.toThrow(/yearsExperience/);
      await expect(
        service.addProfileSkill(USER_ID, {
          ...validCreateDto,
          yearsExperience: 100,
        }),
      ).rejects.toThrow(/yearsExperience/);
      await expect(
        service.addProfileSkill(USER_ID, {
          ...validCreateDto,
          yearsExperience: Number.NaN,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(profileSkillsRepository.create).toHaveBeenCalledTimes(1);
    });

    it('rejeita lastUsedYear futuro com 400', async () => {
      mockProfile();
      skillsRepository.existsBy.mockResolvedValue(true);

      await expect(
        service.addProfileSkill(USER_ID, {
          ...validCreateDto,
          lastUsedYear: CURRENT_YEAR + 1,
        }),
      ).rejects.toThrow(/lastUsedYear/);
      expect(profileSkillsRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('updateProfileSkill', () => {
    it('atualiza somente os campos presentes no DTO', async () => {
      mockProfile();
      const link = makeProfileSkill({ lastUsedYear: CURRENT_YEAR - 1 });
      profileSkillsRepository.findOne.mockResolvedValue(link);
      profileSkillsRepository.save.mockImplementation((value) =>
        Promise.resolve(value),
      );

      const result = await service.updateProfileSkill(USER_ID, LINK_ID, {
        yearsExperience: 6,
        lastUsedYear: CURRENT_YEAR,
      });

      expect(link.yearsExperience).toBe('6.0');
      expect(link.lastUsedYear).toBe(CURRENT_YEAR);
      expect(link.level).toBe(SkillLevel.ADVANCED);
      expect(link.skillId).toBe(SKILL_ID);
      expect(profileSkillsRepository.findOne).toHaveBeenCalledWith({
        where: { id: LINK_ID, profileId: PROFILE_ID },
        relations: { skill: true },
      });
      expect(result.skill.name).toBe('Node.js');
    });

    it('rejeita level null antes de qualquer consulta', async () => {
      await expect(
        service.updateProfileSkill(USER_ID, LINK_ID, {
          level: null,
        } as unknown as UpdateProfileSkillDto),
      ).rejects.toThrow(/level/);
      expect(profilesRepository.findOne).not.toHaveBeenCalled();
    });

    it('responde 404 para vínculo de outro usuário', async () => {
      mockProfile();
      profileSkillsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfileSkill(USER_ID, LINK_ID, {
          level: SkillLevel.EXPERT,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(profileSkillsRepository.save).not.toHaveBeenCalled();
    });

    it('valida anos de experiência e ano futuro no PATCH', async () => {
      mockProfile();
      profileSkillsRepository.findOne.mockResolvedValue(makeProfileSkill());
      profileSkillsRepository.save.mockImplementation((value) =>
        Promise.resolve(value),
      );

      await expect(
        service.updateProfileSkill(USER_ID, LINK_ID, { yearsExperience: 5.55 }),
      ).rejects.toThrow(/yearsExperience/);
      await expect(
        service.updateProfileSkill(USER_ID, LINK_ID, { yearsExperience: 100 }),
      ).rejects.toThrow(/yearsExperience/);
      await expect(
        service.updateProfileSkill(USER_ID, LINK_ID, {
          lastUsedYear: CURRENT_YEAR + 1,
        }),
      ).rejects.toThrow(/lastUsedYear/);
      expect(profileSkillsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('listProfileSkills', () => {
    it('lista vínculos do perfil ordenados por categoria, nome e id', async () => {
      mockProfile();
      const links = [
        makeProfileSkill({
          id: 'second',
          skill: makeSkill({
            name: 'Zebra',
            category: SkillCategory.TOOL,
            aliases: [],
          }),
        }),
        makeProfileSkill({
          id: 'first',
          skill: makeSkill({
            name: 'Agile',
            category: SkillCategory.METHODOLOGY,
            aliases: [],
          }),
        }),
      ];
      profileSkillsRepository.find.mockResolvedValue(links);

      const result = await service.listProfileSkills(USER_ID);

      expect(profileSkillsRepository.find).toHaveBeenCalledWith({
        where: { profileId: PROFILE_ID },
        relations: { skill: true },
        order: { skill: { category: 'ASC', name: 'ASC' }, id: 'ASC' },
      });
      expect(result.map((link) => link.id)).toEqual(['second', 'first']);
      expect(result[0].skill.name).toBe('Zebra');
      expect(result[0].yearsExperience).toBe(5.5);
    });

    it('responde 404 quando o usuário não tem perfil', async () => {
      profilesRepository.findOne.mockResolvedValue(null);

      await expect(service.listProfileSkills(USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(profileSkillsRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('removeProfileSkill', () => {
    it('remove apenas o vínculo, preservando o catálogo', async () => {
      mockProfile();
      const link = makeProfileSkill();
      profileSkillsRepository.findOne.mockResolvedValue(link);
      profileSkillsRepository.remove.mockResolvedValue(link);

      await expect(
        service.removeProfileSkill(USER_ID, LINK_ID),
      ).resolves.toBeUndefined();
      expect(profileSkillsRepository.remove).toHaveBeenCalledWith(link);
      expect(skillsRepository.delete).not.toHaveBeenCalled();
    });

    it('responde 404 para vínculo de outro usuário sem remover nada', async () => {
      mockProfile();
      profileSkillsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.removeProfileSkill(USER_ID, LINK_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(profileSkillsRepository.remove).not.toHaveBeenCalled();
    });
  });
});
