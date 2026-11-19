import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Application } from '../applications/entities/application.entity.js';
import { ApplicationStatusHistory } from '../applications/entities/application-status-history.entity.js';
import { Interview } from '../interviews/entities/interview.entity.js';
import { Job } from '../jobs/entities/job.entity.js';
import { JobSkill } from '../jobs/entities/job-skill.entity.js';
import { Skill } from '../skills/entities/skill.entity.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Application,
      ApplicationStatusHistory,
      Interview,
      Job,
      JobSkill,
      Skill,
    ]),
    AuthModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
