import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Job } from '../jobs/entities/job.entity.js';
import { ResumeVersion } from '../resumes/entities/resume-version.entity.js';
import { Skill } from '../skills/entities/skill.entity.js';
import { AtsAnalysisController } from './ats-analysis.controller.js';
import { AtsAnalysisService } from './ats-analysis.service.js';
import { AtsAnalysis } from './entities/ats-analysis.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AtsAnalysis, ResumeVersion, Job, Skill]),
    AuthModule,
  ],
  controllers: [AtsAnalysisController],
  providers: [AtsAnalysisService],
  exports: [AtsAnalysisService],
})
export class AtsModule {}
