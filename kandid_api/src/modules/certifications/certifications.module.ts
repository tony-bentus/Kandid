import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Profile } from '../profiles/entities/profile.entity.js';
import { CertificationsController } from './certifications.controller.js';
import { CertificationsService } from './certifications.service.js';
import { Certification } from './entities/certification.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Certification, Profile]), AuthModule],
  controllers: [CertificationsController],
  providers: [CertificationsService],
  exports: [CertificationsService],
})
export class CertificationsModule {}
