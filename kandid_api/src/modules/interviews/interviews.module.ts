import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from '../applications/entities/application.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { Interview } from './entities/interview.entity.js';
import { InterviewsController } from './interviews.controller.js';
import { InterviewsService } from './interviews.service.js';

/**
 * Módulo de entrevistas. `Application` é registrado somente para a checagem de
 * ownership; nenhum service de candidatura é alterado ou reexportado.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Interview, Application]), AuthModule],
  controllers: [InterviewsController],
  providers: [InterviewsService],
})
export class InterviewsModule {}
