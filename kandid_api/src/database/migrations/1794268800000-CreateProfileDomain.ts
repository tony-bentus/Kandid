import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 1 do domínio: perfil profissional, experiências/bullets, catálogo de
 * skills, formação, certificações e idiomas.
 *
 * Gerada a partir das entidades com `migration:generate` e revisada.
 * `ON DELETE CASCADE` garante que apagar um usuário/perfil/experiência remove
 * os registros dependentes.
 */
export class CreateProfileDomain1794268800000 implements MigrationInterface {
  name = 'CreateProfileDomain1794268800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`profiles\` (
        \`id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`headline\` varchar(160) NULL,
        \`summary\` text NULL,
        \`phone\` varchar(30) NULL,
        \`city\` varchar(80) NULL,
        \`state\` varchar(80) NULL,
        \`country\` varchar(80) NULL,
        \`linkedin_url\` varchar(255) NULL,
        \`github_url\` varchar(255) NULL,
        \`portfolio_url\` varchar(255) NULL,
        \`desired_role\` varchar(160) NULL,
        \`desired_seniority\` enum ('INTERN', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'STAFF', 'PRINCIPAL') NULL,
        \`work_model_preference\` enum ('ONSITE', 'HYBRID', 'REMOTE') NULL,
        \`desired_salary_cents\` bigint unsigned NULL,
        \`currency\` char(3) NOT NULL DEFAULT 'BRL',
        \`available_from\` date NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`REL_9e432b7df0d182f8d292902d1a\` (\`user_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`skills\` (
        \`id\` varchar(36) NOT NULL,
        \`name\` varchar(80) NOT NULL,
        \`slug\` varchar(80) NOT NULL,
        \`category\` enum ('LANGUAGE', 'FRAMEWORK', 'DATABASE', 'CLOUD', 'DEVOPS', 'TOOL', 'METHODOLOGY', 'SOFT_SKILL') NOT NULL,
        \`aliases\` json NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`UQ_skills_name\` (\`name\`),
        UNIQUE INDEX \`UQ_skills_slug\` (\`slug\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`profile_skills\` (
        \`id\` varchar(36) NOT NULL,
        \`profile_id\` varchar(36) NOT NULL,
        \`skill_id\` varchar(36) NOT NULL,
        \`level\` enum ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT') NOT NULL,
        \`years_experience\` decimal(4,1) NULL,
        \`last_used_year\` smallint NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`UQ_profile_skills_profile_skill\` (\`profile_id\`, \`skill_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`experiences\` (
        \`id\` varchar(36) NOT NULL,
        \`profile_id\` varchar(36) NOT NULL,
        \`company_name\` varchar(160) NOT NULL,
        \`role\` varchar(160) NOT NULL,
        \`employment_type\` enum ('CLT', 'PJ', 'CONTRACTOR', 'FREELANCE', 'INTERNSHIP', 'TEMPORARY') NULL,
        \`work_model\` enum ('ONSITE', 'HYBRID', 'REMOTE') NULL,
        \`location\` varchar(160) NULL,
        \`start_date\` date NOT NULL,
        \`end_date\` date NULL,
        \`is_current\` tinyint NOT NULL DEFAULT 0,
        \`description\` text NULL,
        \`sort_order\` int NOT NULL DEFAULT '0',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`experience_bullets\` (
        \`id\` varchar(36) NOT NULL,
        \`experience_id\` varchar(36) NOT NULL,
        \`text\` varchar(500) NOT NULL,
        \`sort_order\` int NOT NULL DEFAULT '0',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`educations\` (
        \`id\` varchar(36) NOT NULL,
        \`profile_id\` varchar(36) NOT NULL,
        \`institution\` varchar(160) NOT NULL,
        \`degree\` varchar(160) NOT NULL,
        \`field_of_study\` varchar(160) NOT NULL,
        \`start_date\` date NOT NULL,
        \`end_date\` date NULL,
        \`is_current\` tinyint NOT NULL DEFAULT 0,
        \`description\` text NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`certifications\` (
        \`id\` varchar(36) NOT NULL,
        \`profile_id\` varchar(36) NOT NULL,
        \`name\` varchar(160) NOT NULL,
        \`issuer\` varchar(160) NOT NULL,
        \`issue_date\` date NOT NULL,
        \`expiry_date\` date NULL,
        \`credential_url\` varchar(255) NULL,
        \`credential_id\` varchar(120) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`languages\` (
        \`id\` varchar(36) NOT NULL,
        \`profile_id\` varchar(36) NOT NULL,
        \`name\` varchar(60) NOT NULL,
        \`proficiency\` enum ('BASIC', 'INTERMEDIATE', 'ADVANCED', 'FLUENT', 'NATIVE') NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(
      'ALTER TABLE `profiles` ADD CONSTRAINT `FK_9e432b7df0d182f8d292902d1a2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `certifications` ADD CONSTRAINT `FK_8eee443e04c2fd956574af4cd24` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `experiences` ADD CONSTRAINT `FK_358a314d189554fce6d662d042a` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `experience_bullets` ADD CONSTRAINT `FK_061ebabae799e872ad9e0957b7d` FOREIGN KEY (`experience_id`) REFERENCES `experiences`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `languages` ADD CONSTRAINT `FK_df403276954a1b55983a0dffd10` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `educations` ADD CONSTRAINT `FK_d158e89c3eb4fa5e31ab560119e` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `profile_skills` ADD CONSTRAINT `FK_307099ef26ed5a2dc95b8ab4c41` FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `profile_skills` ADD CONSTRAINT `FK_af54190875059c8beac9e0f33a0` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `profile_skills` DROP FOREIGN KEY `FK_af54190875059c8beac9e0f33a0`',
    );
    await queryRunner.query(
      'ALTER TABLE `profile_skills` DROP FOREIGN KEY `FK_307099ef26ed5a2dc95b8ab4c41`',
    );
    await queryRunner.query(
      'ALTER TABLE `educations` DROP FOREIGN KEY `FK_d158e89c3eb4fa5e31ab560119e`',
    );
    await queryRunner.query(
      'ALTER TABLE `languages` DROP FOREIGN KEY `FK_df403276954a1b55983a0dffd10`',
    );
    await queryRunner.query(
      'ALTER TABLE `experience_bullets` DROP FOREIGN KEY `FK_061ebabae799e872ad9e0957b7d`',
    );
    await queryRunner.query(
      'ALTER TABLE `experiences` DROP FOREIGN KEY `FK_358a314d189554fce6d662d042a`',
    );
    await queryRunner.query(
      'ALTER TABLE `certifications` DROP FOREIGN KEY `FK_8eee443e04c2fd956574af4cd24`',
    );
    await queryRunner.query(
      'ALTER TABLE `profiles` DROP FOREIGN KEY `FK_9e432b7df0d182f8d292902d1a2`',
    );
    await queryRunner.query('DROP TABLE IF EXISTS `profile_skills`');
    await queryRunner.query('DROP TABLE IF EXISTS `skills`');
    await queryRunner.query('DROP TABLE IF EXISTS `educations`');
    await queryRunner.query('DROP TABLE IF EXISTS `languages`');
    await queryRunner.query('DROP TABLE IF EXISTS `experience_bullets`');
    await queryRunner.query('DROP TABLE IF EXISTS `experiences`');
    await queryRunner.query('DROP TABLE IF EXISTS `certifications`');
    await queryRunner.query('DROP TABLE IF EXISTS `profiles`');
  }
}
