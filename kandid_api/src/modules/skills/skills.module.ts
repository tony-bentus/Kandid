import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Profile } from '../profiles/entities/profile.entity.js';
import { ProfileSkill } from './entities/profile-skill.entity.js';
import { Skill } from './entities/skill.entity.js';
import { ProfileSkillsController } from './profile-skills.controller.js';
import { SkillsController } from './skills.controller.js';
import { SkillsService } from './skills.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Skill, ProfileSkill, Profile]), AuthModule],
  controllers: [SkillsController, ProfileSkillsController],
  providers: [SkillsService],
  exports: [SkillsService],
})
export class SkillsModule {}
