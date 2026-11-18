import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { isDuplicateEntry } from '../../common/utils/is-duplicate-entry.js';
import {
  assertNoForcedNull,
  hasField,
} from '../../common/utils/null-fields.js';
import { Job } from '../jobs/entities/job.entity.js';
import { CompanyResponseDto } from './dto/company-response.dto.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';
import { Company } from './entities/company.entity.js';

const COMPANY_NAME_UNIQUE = 'UQ_companies_user_name';

/** Colunas NOT NULL que o `PartialType` poderia transformar em ausência. */
const REQUIRED_UPDATE_FIELDS = ['name', 'kind'] as const;

/** Descritivos anuláveis que aceitam `null` ou string vazia para limpar. */
const NULLABLE_STRING_FIELDS = [
  'website',
  'industry',
  'location',
  'notes',
] as const;

/** String vazia (ou só espaços) e `null` explícito limpam a coluna opcional. */
function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}

/** Empresas do usuário autenticado (`/v1/companies`). */
@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companiesRepository: Repository<Company>,
    @InjectRepository(Job)
    private readonly jobsRepository: Repository<Job>,
  ) {}

  /** POST /v1/companies */
  async create(
    userId: string,
    dto: CreateCompanyDto,
  ): Promise<CompanyResponseDto> {
    const name = dto.name.trim();

    await this.assertNameAvailable(userId, name);

    const company = this.companiesRepository.create({
      userId,
      name,
      kind: dto.kind,
      website: normalizeOptionalString(dto.website),
      industry: normalizeOptionalString(dto.industry),
      size: dto.size ?? null,
      location: normalizeOptionalString(dto.location),
      notes: normalizeOptionalString(dto.notes),
    });

    try {
      return this.toResponse(await this.companiesRepository.save(company));
    } catch (error) {
      return this.rethrowDuplicate(error);
    }
  }

  /** GET /v1/companies?kind= */
  async findAll(
    userId: string,
    query: ListCompaniesQueryDto,
  ): Promise<CompanyResponseDto[]> {
    const companies = await this.companiesRepository.find({
      where: {
        userId,
        ...(query.kind === undefined ? {} : { kind: query.kind }),
      },
      order: { name: 'ASC', createdAt: 'DESC', id: 'ASC' },
    });

    return companies.map((company) => this.toResponse(company));
  }

  /** GET /v1/companies/:id */
  async findOne(
    userId: string,
    companyId: string,
  ): Promise<CompanyResponseDto> {
    return this.toResponse(await this.requireOwned(userId, companyId));
  }

  /** PATCH /v1/companies/:id */
  async update(
    userId: string,
    companyId: string,
    dto: UpdateCompanyDto,
  ): Promise<CompanyResponseDto> {
    // 404 antes de qualquer validação de conteúdo do payload.
    const company = await this.requireOwned(userId, companyId);
    assertNoForcedNull(dto, REQUIRED_UPDATE_FIELDS);

    // `assertNoForcedNull` já garantiu que um `name` presente não é null.
    if (hasField(dto, 'name') && dto.name !== undefined) {
      const name = dto.name.trim();

      if (name !== company.name) {
        await this.assertNameAvailable(userId, name, companyId);
      }
      company.name = name;
    }
    if (hasField(dto, 'kind') && dto.kind !== undefined) {
      company.kind = dto.kind;
    }

    for (const field of NULLABLE_STRING_FIELDS) {
      if (hasField(dto, field)) {
        company[field] = normalizeOptionalString(dto[field]);
      }
    }
    if (hasField(dto, 'size')) {
      company.size = dto.size ?? null;
    }

    try {
      return this.toResponse(await this.companiesRepository.save(company));
    } catch (error) {
      return this.rethrowDuplicate(error);
    }
  }

  /** DELETE /v1/companies/:id */
  async remove(userId: string, companyId: string): Promise<void> {
    await this.requireOwned(userId, companyId);

    // ON DELETE RESTRICT em jobs.company_id: falha explícita com 409.
    const hasJobs = await this.jobsRepository.existsBy({ companyId });
    if (hasJobs) {
      throw new ConflictException('Company has linked jobs');
    }

    await this.companiesRepository.delete({ id: companyId, userId });
  }

  private async requireOwned(
    userId: string,
    companyId: string,
  ): Promise<Company> {
    const company = await this.companiesRepository.findOne({
      where: { id: companyId, userId },
    });

    if (company === null) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  /** UNIQUE(user_id, name), inclusive em corrida de escrita concorrente. */
  private async assertNameAvailable(
    userId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const exists = await this.companiesRepository.existsBy(
      exceptId === undefined
        ? { userId, name }
        : { userId, name, id: Not(exceptId) },
    );

    if (exists) {
      throw new ConflictException('Company name already exists');
    }
  }

  private rethrowDuplicate(error: unknown): never {
    if (isDuplicateEntry(error, COMPANY_NAME_UNIQUE)) {
      throw new ConflictException('Company name already exists');
    }

    throw error;
  }

  private toResponse(company: Company): CompanyResponseDto {
    return {
      id: company.id,
      userId: company.userId,
      name: company.name,
      kind: company.kind,
      website: company.website ?? null,
      industry: company.industry ?? null,
      size: company.size ?? null,
      location: company.location ?? null,
      notes: company.notes ?? null,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }
}
