import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { assertDateOrder } from '../../common/utils/dates.js';
import { assertNoForcedNull, hasField } from '../../common/utils/null-fields.js';
import { Profile } from '../profiles/entities/profile.entity.js';
import { CertificationResponseDto } from './dto/certification-response.dto.js';
import { CreateCertificationDto } from './dto/create-certification.dto.js';
import { UpdateCertificationDto } from './dto/update-certification.dto.js';
import { Certification } from './entities/certification.entity.js';

/** Colunas NOT NULL que `PartialType` poderia transformar em ausência via `null`. */
const REQUIRED_UPDATE_FIELDS = ['name', 'issuer', 'issueDate'] as const;

/** Certificações do perfil do usuário autenticado. */
@Injectable()
export class CertificationsService {
  constructor(
    @InjectRepository(Certification)
    private readonly certificationsRepository: Repository<Certification>,
    @InjectRepository(Profile)
    private readonly profilesRepository: Repository<Profile>,
  ) {}

  /** POST /v1/me/certifications */
  async create(
    userId: string,
    dto: CreateCertificationDto,
  ): Promise<CertificationResponseDto> {
    const profile = await this.requireProfile(userId);
    const certification = this.certificationsRepository.create({
      profileId: profile.id,
      name: dto.name,
      issuer: dto.issuer,
      issueDate: dto.issueDate,
      expiryDate: dto.expiryDate ?? null,
      credentialUrl: dto.credentialUrl ?? null,
      credentialId: dto.credentialId ?? null,
    });

    this.assertDates(certification.issueDate, certification.expiryDate);

    return this.toResponse(
      await this.certificationsRepository.save(certification),
    );
  }

  /** GET /v1/me/certifications */
  async findAll(userId: string): Promise<CertificationResponseDto[]> {
    const profile = await this.requireProfile(userId);
    const certifications = await this.certificationsRepository.find({
      where: { profileId: profile.id },
      order: { issueDate: 'DESC', id: 'ASC' },
    });

    return certifications.map((certification) => this.toResponse(certification));
  }

  /** GET /v1/me/certifications/:id */
  async findOne(
    userId: string,
    certificationId: string,
  ): Promise<CertificationResponseDto> {
    const profile = await this.requireProfile(userId);
    const certification = await this.requireOwnedCertification(
      profile.id,
      certificationId,
    );

    return this.toResponse(certification);
  }

  /** PATCH /v1/me/certifications/:id */
  async update(
    userId: string,
    certificationId: string,
    dto: UpdateCertificationDto,
  ): Promise<CertificationResponseDto> {
    const profile = await this.requireProfile(userId);
    const certification = await this.requireOwnedCertification(
      profile.id,
      certificationId,
    );
    assertNoForcedNull(dto, REQUIRED_UPDATE_FIELDS);

    if (hasField(dto, 'name') && dto.name !== undefined) {
      certification.name = dto.name;
    }
    if (hasField(dto, 'issuer') && dto.issuer !== undefined) {
      certification.issuer = dto.issuer;
    }
    if (hasField(dto, 'issueDate') && dto.issueDate !== undefined) {
      certification.issueDate = dto.issueDate;
    }
    if (hasField(dto, 'expiryDate')) {
      certification.expiryDate = dto.expiryDate ?? null;
    }
    if (hasField(dto, 'credentialUrl')) {
      certification.credentialUrl = dto.credentialUrl ?? null;
    }
    if (hasField(dto, 'credentialId')) {
      certification.credentialId = dto.credentialId ?? null;
    }

    // Revalida o estado final após o merge parcial.
    this.assertDates(certification.issueDate, certification.expiryDate);

    return this.toResponse(await this.certificationsRepository.save(certification));
  }

  /** DELETE /v1/me/certifications/:id */
  async remove(userId: string, certificationId: string): Promise<void> {
    const profile = await this.requireProfile(userId);
    await this.requireOwnedCertification(profile.id, certificationId);

    await this.certificationsRepository.delete({
      id: certificationId,
      profileId: profile.id,
    });
  }

  private async requireProfile(userId: string): Promise<Profile> {
    const profile = await this.profilesRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }

  private async requireOwnedCertification(
    profileId: string,
    certificationId: string,
  ): Promise<Certification> {
    const certification = await this.certificationsRepository.findOne({
      where: { id: certificationId, profileId },
    });

    if (!certification) {
      throw new NotFoundException('Certification not found');
    }

    return certification;
  }

  /**
   * Uma certificação vencida continua válida como histórico: apenas a ordem
   * entre emissão e expiração é validada.
   */
  private assertDates(issueDate: string, expiryDate: string | null): void {
    assertDateOrder(issueDate, expiryDate, 'issueDate', 'expiryDate');
  }

  private toResponse(certification: Certification): CertificationResponseDto {
    return {
      id: certification.id,
      profileId: certification.profileId,
      name: certification.name,
      issuer: certification.issuer,
      issueDate: certification.issueDate,
      expiryDate: certification.expiryDate,
      credentialUrl: certification.credentialUrl,
      credentialId: certification.credentialId,
      createdAt: certification.createdAt,
      updatedAt: certification.updatedAt,
    };
  }
}
