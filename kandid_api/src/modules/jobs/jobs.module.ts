import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Company } from '../companies/entities/company.entity.js';
import { Recruiter } from '../recruiters/entities/recruiter.entity.js';
import { Skill } from '../skills/entities/skill.entity.js';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';
import { Job } from './entities/job.entity.js';
import { JobSkill } from './entities/job-skill.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Job,
      JobSkill,
      Company,
      Recruiter,
      Skill,
    ]),
    AuthModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
