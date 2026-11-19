import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AtsAnalysis } from '../ats/entities/ats-analysis.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import {
  ResumeVersionsController,
  ResumesController,
} from './resumes.controller.js';
import { ResumeExportService } from './export/resume-export.service.js';
import { ResumesService } from './resumes.service.js';
import { Resume } from './entities/resume.entity.js';
import { ResumeVersion } from './entities/resume-version.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Resume, ResumeVersion, AtsAnalysis]),
    AuthModule,
  ],
  controllers: [ResumesController, ResumeVersionsController],
  providers: [ResumesService, ResumeExportService],
  exports: [ResumesService],
})
export class ResumesModule {}
