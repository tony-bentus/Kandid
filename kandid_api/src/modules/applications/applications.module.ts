import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import {
  ApplicationsController,
  JobApplicationsController,
} from './applications.controller.js';
import { ApplicationsService } from './applications.service.js';
import { Application } from './entities/application.entity.js';
import { ApplicationStatusHistory } from './entities/application-status-history.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, ApplicationStatusHistory]),
    AuthModule,
  ],
  controllers: [ApplicationsController, JobApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
