import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import {
  ResumeVersionsController,
  ResumesController,
} from './resumes.controller.js';
import { ResumesService } from './resumes.service.js';
import { Resume } from './entities/resume.entity.js';
import { ResumeVersion } from './entities/resume-version.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Resume, ResumeVersion]), AuthModule],
  controllers: [ResumesController, ResumeVersionsController],
  providers: [ResumesService],
  exports: [ResumesService],
})
export class ResumesModule {}
