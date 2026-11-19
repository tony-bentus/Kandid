import type { Repository } from 'typeorm';
import type { AtsAnalysis } from '../../ats/entities/ats-analysis.entity.js';
import type { ResumeSnapshot } from '../../ats/engine/types.js';
import type { ResumeVersion } from '../entities/resume-version.entity.js';
import { ResumeExportService } from './resume-export.service.js';

const USER_ID = '6f1c2a9e-3b7d-4c85-9f10-2a4d8e7b1c33';
const VERSION_ID = '8b7c6d5e-4f30-4a2b-9c8d-7e6f5a4b3c2d';
const RESUME_ID = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b';

const snapshot: ResumeSnapshot = {
  schemaVersion: '1.0',
  generatedAt: '2026-11-19T12:05:00.000Z',
  candidate: { name: 'Nome Sobrenome' },
  skills: [],
  experiences: [],
  education: [],
  certifications: [],
  languages: [],
  projects: [],
};

const makeVersion = (): ResumeVersion =>
  ({
    id: VERSION_ID,
    resumeId: RESUME_ID,
    version: 3,
    contentSnapshot: snapshot,
    // Coluna legada: deve ser ignorada pelo export.
    atsScore: 99,
  }) as unknown as ResumeVersion;

function makeQueryBuilder(result: ResumeVersion | null) {
  const builder = {
    innerJoin: vi.fn(),
    where: vi.fn(),
    andWhere: vi.fn(),
    getOne: vi.fn().mockResolvedValue(result),
  };
  builder.innerJoin.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.andWhere.mockReturnValue(builder);
  return builder;
}

describe('ResumeExportService', () => {
  let queryBuilder: ReturnType<typeof makeQueryBuilder>;
  let versionsRepository: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let analysesRepository: { findOne: ReturnType<typeof vi.fn> };
  let service: ResumeExportService;

  beforeEach(() => {
    queryBuilder = makeQueryBuilder(makeVersion());
    versionsRepository = { createQueryBuilder: vi.fn(() => queryBuilder) };
    analysesRepository = { findOne: vi.fn().mockResolvedValue(null) };
    service = new ResumeExportService(
      versionsRepository as unknown as Repository<ResumeVersion>,
      analysesRepository as unknown as Repository<AtsAnalysis>,
    );
  });

  it('exporta JSON com exatamente quatro campos, nesta ordem, sem envelope', async () => {
    analysesRepository.findOne.mockResolvedValue({ score: 78 });

    const result = await service.export(USER_ID, VERSION_ID, 'json');

    expect(result.format).toBe('json');
    if (result.format !== 'json') {
      throw new Error('Esperado export JSON');
    }
    expect(Object.keys(result.body)).toEqual([
      'resumeId',
      'version',
      'atsScore',
      'contentSnapshot',
    ]);
    expect(result.body.resumeId).toBe(RESUME_ID);
    expect(result.body.version).toBe(3);
    expect(result.body.atsScore).toBe(78);
    expect(result.body.contentSnapshot).toBe(snapshot);
  });

  it('usa score 0 da análise mais recente com ordenação estável', async () => {
    analysesRepository.findOne.mockResolvedValue({ score: 0 });

    const result = await service.export(USER_ID, VERSION_ID, 'json');

    expect(result.format).toBe('json');
    if (result.format !== 'json') {
      throw new Error('Esperado export JSON');
    }
    expect(result.body.atsScore).toBe(0);
    expect(analysesRepository.findOne).toHaveBeenCalledWith({
      where: { resumeVersionId: VERSION_ID },
      order: { createdAt: 'DESC', id: 'ASC' },
    });
  });

  it('devolve atsScore null quando a versão nunca foi analisada', async () => {
    const result = await service.export(USER_ID, VERSION_ID, 'json');

    expect(result.format).toBe('json');
    if (result.format !== 'json') {
      throw new Error('Esperado export JSON');
    }
    expect(result.body.atsScore).toBeNull();
    expect(result.body.contentSnapshot).toBe(snapshot);
  });

  it('resolve ownership por join e responde 404 para versão alheia/inexistente', async () => {
    queryBuilder.getOne.mockResolvedValue(null);

    await expect(
      service.export(USER_ID, VERSION_ID, 'json'),
    ).rejects.toMatchObject({
      message: 'Resume version not found',
      response: { error: 'Not Found' },
    });
    expect(queryBuilder.innerJoin).toHaveBeenCalledWith(
      'resumeVersion.resume',
      'resume',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'resume.userId = :userId',
      { userId: USER_ID },
    );
    expect(analysesRepository.findOne).not.toHaveBeenCalled();
  });

  it('gera HTML sem consultar analyses nem expor metadados da versão', async () => {
    analysesRepository.findOne.mockResolvedValue({ score: 78 });

    const result = await service.export(USER_ID, VERSION_ID, 'html');

    expect(result.format).toBe('html');
    if (result.format !== 'html') {
      throw new Error('Esperado export HTML');
    }
    expect(result.body.startsWith('<!doctype html>')).toBe(true);
    expect(result.body).toContain('Nome Sobrenome');
    expect(result.body).not.toContain('atsScore');
    expect(result.body).not.toContain(RESUME_ID);
    expect(result.body).not.toContain('version');
    expect(analysesRepository.findOne).not.toHaveBeenCalled();
  });
});
