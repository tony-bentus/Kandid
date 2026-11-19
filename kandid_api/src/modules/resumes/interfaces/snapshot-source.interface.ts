import type { Certification } from '../../certifications/entities/certification.entity.js';
import type { Education } from '../../educations/entities/education.entity.js';
import type { Experience } from '../../experiences/entities/experience.entity.js';
import type { ExperienceBullet } from '../../experiences/entities/experience-bullet.entity.js';
import type { Language } from '../../languages/entities/language.entity.js';
import type { Profile } from '../../profiles/entities/profile.entity.js';
import type { ProfileSkill } from '../../skills/entities/profile-skill.entity.js';
import type { User } from '../../users/entities/user.entity.js';

/**
 * Dados lidos dentro da transação de geração de versão para montar o snapshot.
 *
 * Todas as entidades filhas pertencem ao `profile` do mesmo `userId` do
 * currículo; o builder é puro e nunca acessa banco nem relógio de parede.
 */
export interface SnapshotSource {
  user: User;
  profile: Profile;
  targetRole: string;
  experiences: Experience[];
  bullets: ExperienceBullet[];
  profileSkills: ProfileSkill[];
  education: Education[];
  certifications: Certification[];
  languages: Language[];
}
