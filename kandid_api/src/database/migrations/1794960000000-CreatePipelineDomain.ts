import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 3: domínio de pipeline (empresas, recrutadores, vagas e stack).
 *
 * SQL manual no padrão da migration de perfil: charset/collation utf8mb4,
 * `datetime(6)`, `bigint unsigned` para centavos e enums do MySQL.
 *
 * Decisão do tech lead (sobre a Decisão 10 do ADR 0003): `jobs.company_id`
 * usa `ON DELETE RESTRICT` — empresa com vagas deve gerar 409, não perda
 * silenciosa de histórico. As FKs opcionais mantêm `SET NULL`.
 */
export class CreatePipelineDomain1794960000000 implements MigrationInterface {
  name = 'CreatePipelineDomain1794960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`companies\` (
        \`id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`name\` varchar(160) NOT NULL,
        \`kind\` enum ('CLIENT', 'AGENCY', 'OTHER') NOT NULL,
        \`website\` varchar(255) NULL,
        \`industry\` varchar(120) NULL,
        \`size\` enum ('MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE') NULL,
        \`location\` varchar(160) NULL,
        \`notes\` text NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`UQ_companies_user_name\` (\`user_id\`, \`name\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`recruiters\` (
        \`id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`name\` varchar(120) NOT NULL,
        \`email\` varchar(160) NULL,
        \`phone\` varchar(30) NULL,
        \`linkedin_url\` varchar(255) NULL,
        \`agency_company_id\` varchar(36) NULL,
        \`notes\` text NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`jobs\` (
        \`id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`company_id\` varchar(36) NOT NULL,
        \`recruiter_id\` varchar(36) NULL,
        \`title\` varchar(160) NOT NULL,
        \`description\` text NULL,
        \`seniority\` enum ('INTERN', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'STAFF', 'PRINCIPAL') NULL,
        \`work_model\` enum ('ONSITE', 'HYBRID', 'REMOTE') NULL,
        \`contract_type\` enum ('CLT', 'PJ', 'CONTRACTOR', 'FREELANCE', 'INTERNSHIP', 'TEMPORARY') NULL,
        \`location\` varchar(160) NULL,
        \`source\` enum ('LINKEDIN', 'GUPY', 'INDEED', 'REFERRAL', 'COMPANY_SITE', 'OTHER') NOT NULL,
        \`source_url\` varchar(255) NULL,
        \`salary_range_min_cents\` bigint unsigned NULL,
        \`salary_range_max_cents\` bigint unsigned NULL,
        \`currency\` char(3) NOT NULL DEFAULT 'BRL',
        \`salary_period\` enum ('MONTH', 'YEAR', 'HOUR', 'DAY') NOT NULL,
        \`posted_at\` date NULL,
        \`application_deadline\` date NULL,
        \`notes\` text NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IX_jobs_user_created\` (\`user_id\`, \`created_at\`),
        INDEX \`IX_jobs_user_company\` (\`user_id\`, \`company_id\`),
        INDEX \`IX_jobs_user_posted\` (\`user_id\`, \`posted_at\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`job_skills\` (
        \`job_id\` varchar(36) NOT NULL,
        \`skill_id\` varchar(36) NOT NULL,
        \`is_required\` tinyint NOT NULL DEFAULT 1,
        PRIMARY KEY (\`job_id\`, \`skill_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    // Nomes gerados pelo TypeORM (confirmados por `schema:log`) para não haver
    // drift entre as entidades e a migration.
    await queryRunner.query(
      'ALTER TABLE `companies` ADD CONSTRAINT `FK_ee0839cba07cb0c52602021ad4b` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `recruiters` ADD CONSTRAINT `FK_0c851bd72ee5568e8793794624b` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `recruiters` ADD CONSTRAINT `FK_fcd49b25abbf49e78e54cb80c81` FOREIGN KEY (`agency_company_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `jobs` ADD CONSTRAINT `FK_9027c8f0ba75fbc1ac46647d043` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `jobs` ADD CONSTRAINT `FK_087a773c50525e348e26188e7cc` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `jobs` ADD CONSTRAINT `FK_4aa9e89c9fdf42566a1978820a6` FOREIGN KEY (`recruiter_id`) REFERENCES `recruiters`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `job_skills` ADD CONSTRAINT `FK_4f7427e13d249156f37669e7127` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `job_skills` ADD CONSTRAINT `FK_7c0a3c52e77f9d9d839fdbb14b6` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Mesmos nomes criados no `up()` — gerados pelo TypeORM para evitar drift.
    await queryRunner.query(
      'ALTER TABLE `job_skills` DROP FOREIGN KEY `FK_7c0a3c52e77f9d9d839fdbb14b6`',
    );
    await queryRunner.query(
      'ALTER TABLE `job_skills` DROP FOREIGN KEY `FK_4f7427e13d249156f37669e7127`',
    );
    await queryRunner.query(
      'ALTER TABLE `jobs` DROP FOREIGN KEY `FK_4aa9e89c9fdf42566a1978820a6`',
    );
    await queryRunner.query(
      'ALTER TABLE `jobs` DROP FOREIGN KEY `FK_087a773c50525e348e26188e7cc`',
    );
    await queryRunner.query(
      'ALTER TABLE `jobs` DROP FOREIGN KEY `FK_9027c8f0ba75fbc1ac46647d043`',
    );
    await queryRunner.query(
      'ALTER TABLE `recruiters` DROP FOREIGN KEY `FK_fcd49b25abbf49e78e54cb80c81`',
    );
    await queryRunner.query(
      'ALTER TABLE `recruiters` DROP FOREIGN KEY `FK_0c851bd72ee5568e8793794624b`',
    );
    await queryRunner.query(
      'ALTER TABLE `companies` DROP FOREIGN KEY `FK_ee0839cba07cb0c52602021ad4b`',
    );

    await queryRunner.query('DROP TABLE IF EXISTS `job_skills`');
    await queryRunner.query('DROP TABLE IF EXISTS `jobs`');
    await queryRunner.query('DROP TABLE IF EXISTS `recruiters`');
    await queryRunner.query('DROP TABLE IF EXISTS `companies`');
  }
}
