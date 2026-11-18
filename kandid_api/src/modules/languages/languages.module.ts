import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Profile } from '../profiles/entities/profile.entity.js';
import { Language } from './entities/language.entity.js';
import { LanguagesController } from './languages.controller.js';
import { LanguagesService } from './languages.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Language, Profile]), AuthModule],
  controllers: [LanguagesController],
  providers: [LanguagesService],
  exports: [LanguagesService],
})
export class LanguagesModule {}
