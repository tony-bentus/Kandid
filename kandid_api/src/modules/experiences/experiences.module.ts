import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Profile } from '../profiles/entities/profile.entity.js';
import { ExperienceBullet } from './entities/experience-bullet.entity.js';
import { Experience } from './entities/experience.entity.js';
import { ExperiencesController } from './experiences.controller.js';
import { ExperiencesService } from './experiences.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Experience, ExperienceBullet, Profile]),
    AuthModule,
  ],
  controllers: [ExperiencesController],
  providers: [ExperiencesService],
  exports: [ExperiencesService],
})
export class ExperiencesModule {}
