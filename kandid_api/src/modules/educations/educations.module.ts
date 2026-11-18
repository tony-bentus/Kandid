import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Profile } from '../profiles/entities/profile.entity.js';
import { EducationsController } from './educations.controller.js';
import { EducationsService } from './educations.service.js';
import { Education } from './entities/education.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Education, Profile]), AuthModule],
  controllers: [EducationsController],
  providers: [EducationsService],
  exports: [EducationsService],
})
export class EducationsModule {}
