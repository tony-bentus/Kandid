import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  assertNoForcedNull,
  hasField,
} from '../../common/utils/null-fields.js';
import { normalizeEmail } from '../../common/utils/normalize-email.js';
import { Company } from '../companies/entities/company.entity.js';
import { CreateRecruiterDto } from './dto/create-recruiter.dto.js';
import { RecruiterResponseDto } from './dto/recruiter-response.dto.js';
import { UpdateRecruiterDto } from './dto/update-recruiter.dto.js';
import { Recruiter } from './entities/recruiter.entity.js';

/** Coluna NOT NULL que o `PartialType` poderia transformar em ausência. */
const REQUIRED_UPDATE_FIELDS = ['name'] as const;

/** Descritivos anuláveis que aceitam `null` ou string vazia para limpar. */
const NULLABLE_STRING_FIELDS = ['phone', 'linkedinUrl', 'notes'] as const;

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

/** E-mail é opcional; quando presente é normalizado (trim + lowercase). */
function normalizeOptionalEmail(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : normalizeEmail(trimmed);
}

/** Recrutadores do usuário autenticado (`/v1/recruiters`). */
@Injectable()
export class RecruitersService {
  constructor(
    @InjectRepository(Recruiter)
    private readonly recruitersRepository: Repository<Recruiter>,
    @InjectRepository(Company)
    private readonly companiesRepository: Repository<Company>,
  ) {}

  /** POST /v1/recruiters */
  async create(
    userId: string,
    dto: CreateRecruiterDto,
  ): Promise<RecruiterResponseDto> {
    const agencyCompanyId = dto.agencyCompanyId ?? null;
    if (agencyCompanyId !== null) {
      await this.requireOwnedCompany(userId, agencyCompanyId);
    }

    const recruiter = this.recruitersRepository.create({
      userId,
      name: dto.name.trim(),
      email: normalizeOptionalEmail(dto.email),
      phone: normalizeOptionalString(dto.phone),
      linkedinUrl: normalizeOptionalString(dto.linkedinUrl),
      agencyCompanyId,
      notes: normalizeOptionalString(dto.notes),
    });

    return this.toResponse(await this.recruitersRepository.save(recruiter));
  }

  /** GET /v1/recruiters */
  async findAll(userId: string): Promise<RecruiterResponseDto[]> {
    const recruiters = await this.recruitersRepository.find({
      where: { userId },
      order: { name: 'ASC', createdAt: 'DESC', id: 'ASC' },
    });

    return recruiters.map((recruiter) => this.toResponse(recruiter));
  }

  /** GET /v1/recruiters/:id */
  async findOne(
    userId: string,
    recruiterId: string,
  ): Promise<RecruiterResponseDto> {
    return this.toResponse(await this.requireOwned(userId, recruiterId));
  }

  /** PATCH /v1/recruiters/:id */
  async update(
    userId: string,
    recruiterId: string,
    dto: UpdateRecruiterDto,
  ): Promise<RecruiterResponseDto> {
    // 404 antes de qualquer validação de conteúdo do payload.
    const recruiter = await this.requireOwned(userId, recruiterId);
    assertNoForcedNull(dto, REQUIRED_UPDATE_FIELDS);

    // `assertNoForcedNull` já garantiu que um `name` presente não é null.
    if (hasField(dto, 'name') && dto.name !== undefined) {
      recruiter.name = dto.name.trim();
    }
    if (hasField(dto, 'email')) {
      recruiter.email = normalizeOptionalEmail(dto.email);
    }
    for (const field of NULLABLE_STRING_FIELDS) {
      if (hasField(dto, field)) {
        recruiter[field] = normalizeOptionalString(dto[field]);
      }
    }
    if (hasField(dto, 'agencyCompanyId')) {
      const agencyCompanyId = dto.agencyCompanyId ?? null;
      if (agencyCompanyId !== null) {
        await this.requireOwnedCompany(userId, agencyCompanyId);
      }
      recruiter.agencyCompanyId = agencyCompanyId;
    }

    return this.toResponse(await this.recruitersRepository.save(recruiter));
  }

  /** DELETE /v1/recruiters/:id */
  async remove(userId: string, recruiterId: string): Promise<void> {
    await this.requireOwned(userId, recruiterId);

    await this.recruitersRepository.delete({ id: recruiterId, userId });
  }

  private async requireOwned(
    userId: string,
    recruiterId: string,
  ): Promise<Recruiter> {
    const recruiter = await this.recruitersRepository.findOne({
      where: { id: recruiterId, userId },
    });

    if (recruiter === null) {
      throw new NotFoundException('Recruiter not found');
    }

    return recruiter;
  }

  /** Agência informada precisa ser uma empresa do mesmo usuário. */
  private async requireOwnedCompany(
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

  private toResponse(recruiter: Recruiter): RecruiterResponseDto {
    return {
      id: recruiter.id,
      userId: recruiter.userId,
      name: recruiter.name,
      email: recruiter.email ?? null,
      phone: recruiter.phone ?? null,
      linkedinUrl: recruiter.linkedinUrl ?? null,
      agencyCompanyId: recruiter.agencyCompanyId ?? null,
      notes: recruiter.notes ?? null,
      createdAt: recruiter.createdAt,
      updatedAt: recruiter.updatedAt,
    };
  }
}
