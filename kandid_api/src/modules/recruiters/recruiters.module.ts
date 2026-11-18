import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Company } from '../companies/entities/company.entity.js';
import { RecruitersController } from './recruiters.controller.js';
import { RecruitersService } from './recruiters.service.js';
import { Recruiter } from './entities/recruiter.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Recruiter, Company]), AuthModule],
  controllers: [RecruitersController],
  providers: [RecruitersService],
  exports: [RecruitersService],
})
export class RecruitersModule {}
