import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { assertDateOrder } from '../../common/utils/dates.js';
import { assertNoForcedNull, hasField } from '../../common/utils/null-fields.js';
import { Profile } from '../profiles/entities/profile.entity.js';
import { CreateEducationDto } from './dto/create-education.dto.js';
import { EducationResponseDto } from './dto/education-response.dto.js';
import { UpdateEducationDto } from './dto/update-education.dto.js';
import { Education } from './entities/education.entity.js';

/** Colunas NOT NULL que `PartialType` poderia transformar em ausência via `null`. */
const REQUIRED_UPDATE_FIELDS = [
  'institution',
  'degree',
  'fieldOfStudy',
  'startDate',
  'isCurrent',
] as const;

/** Formação acadêmica do perfil do usuário autenticado. */
@Injectable()
export class EducationsService {
  constructor(
    @InjectRepository(Education)
    private readonly educationsRepository: Repository<Education>,
    @InjectRepository(Profile)
    private readonly profilesRepository: Repository<Profile>,
  ) {}

  /** POST /v1/me/educations */
  async create(
    userId: string,
    dto: CreateEducationDto,
  ): Promise<EducationResponseDto> {
    const profile = await this.requireProfile(userId);
    const education = this.educationsRepository.create({
      profileId: profile.id,
      institution: dto.institution,
      degree: dto.degree,
      fieldOfStudy: dto.fieldOfStudy,
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
      isCurrent: dto.isCurrent ?? false,
      description: dto.description ?? null,
    });

    this.assertDates(education.startDate, education.endDate, education.isCurrent);

    return this.toResponse(await this.educationsRepository.save(education));
  }

  /** GET /v1/me/educations */
  async findAll(userId: string): Promise<EducationResponseDto[]> {
    const profile = await this.requireProfile(userId);
    const educations = await this.educationsRepository.find({
      where: { profileId: profile.id },
      order: { startDate: 'DESC', id: 'ASC' },
    });

    return educations.map((education) => this.toResponse(education));
  }

  /** GET /v1/me/educations/:id */
  async findOne(
    userId: string,
    educationId: string,
  ): Promise<EducationResponseDto> {
    const profile = await this.requireProfile(userId);
    const education = await this.requireOwnedEducation(profile.id, educationId);

    return this.toResponse(education);
  }

  /** PATCH /v1/me/educations/:id */
  async update(
    userId: string,
    educationId: string,
    dto: UpdateEducationDto,
  ): Promise<EducationResponseDto> {
    const profile = await this.requireProfile(userId);
    const education = await this.requireOwnedEducation(profile.id, educationId);
    assertNoForcedNull(dto, REQUIRED_UPDATE_FIELDS);

    if (hasField(dto, 'institution') && dto.institution !== undefined) {
      education.institution = dto.institution;
    }
    if (hasField(dto, 'degree') && dto.degree !== undefined) {
      education.degree = dto.degree;
    }
    if (hasField(dto, 'fieldOfStudy') && dto.fieldOfStudy !== undefined) {
      education.fieldOfStudy = dto.fieldOfStudy;
    }
    if (hasField(dto, 'startDate') && dto.startDate !== undefined) {
      education.startDate = dto.startDate;
    }
    if (hasField(dto, 'endDate')) {
      education.endDate = dto.endDate ?? null;
    }
    if (hasField(dto, 'isCurrent') && dto.isCurrent !== undefined) {
      education.isCurrent = dto.isCurrent;
    }
    if (hasField(dto, 'description')) {
      education.description = dto.description ?? null;
    }

    // Revalida o estado final: um patch em qualquer data pode quebrar a regra.
    this.assertDates(education.startDate, education.endDate, education.isCurrent);

    return this.toResponse(await this.educationsRepository.save(education));
  }

  /** DELETE /v1/me/educations/:id */
  async remove(userId: string, educationId: string): Promise<void> {
    const profile = await this.requireProfile(userId);
    await this.requireOwnedEducation(profile.id, educationId);

    await this.educationsRepository.delete({
      id: educationId,
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

  private async requireOwnedEducation(
    profileId: string,
    educationId: string,
  ): Promise<Education> {
    const education = await this.educationsRepository.findOne({
      where: { id: educationId, profileId },
    });

    if (!education) {
      throw new NotFoundException('Education not found');
    }

    return education;
  }

  private assertDates(
    startDate: string,
    endDate: string | null,
    isCurrent: boolean,
  ): void {
    if (isCurrent && endDate !== null) {
      throw new BadRequestException('endDate must be null when isCurrent is true');
    }
    if (!isCurrent && endDate === null) {
      throw new BadRequestException(
        'endDate is required when isCurrent is false',
      );
    }
    assertDateOrder(startDate, endDate, 'startDate');
  }

  private toResponse(education: Education): EducationResponseDto {
    return {
      id: education.id,
      profileId: education.profileId,
      institution: education.institution,
      degree: education.degree,
      fieldOfStudy: education.fieldOfStudy,
      startDate: education.startDate,
      endDate: education.endDate,
      isCurrent: education.isCurrent,
      description: education.description,
      createdAt: education.createdAt,
      updatedAt: education.updatedAt,
    };
  }
}
