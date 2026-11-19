import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 5: currículos, versões imutáveis e análises ATS (ADR 0005).
 *
 * Nomes físicos no plural (ADR 0005 `:29-35`), FKs explícitos idênticos aos das
 * entidades e `datetime(6)`/utf8mb4 no padrão das migrations anteriores.
 * `resume_versions` e `ats_analyses` são append-only: não possuem `updated_at`.
 *
 * `ats_analyses` é criada aqui, mas sua entidade TypeScript pertence à história
 * de análise (outro agente). Nenhuma migration altera `applications`.
 */
export class CreateResumeDomain1795737600000 implements MigrationInterface {
  name = 'CreateResumeDomain1795737600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`resumes\` (
        \`id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`name\` varchar(120) NOT NULL,
        \`target_role\` varchar(160) NOT NULL,
        \`is_default\` tinyint(1) NOT NULL DEFAULT 0,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`UQ_resumes_user_name\` (\`user_id\`, \`name\`),
        INDEX \`IX_resumes_user_created\` (\`user_id\`, \`created_at\`, \`id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`resume_versions\` (
        \`id\` varchar(36) NOT NULL,
        \`resume_id\` varchar(36) NOT NULL,
        \`version\` int NOT NULL,
        \`job_id\` varchar(36) NULL,
        \`content_snapshot\` json NOT NULL,
        \`ats_score\` int NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`UQ_resume_versions_resume_version\` (\`resume_id\`, \`version\`),
        INDEX \`IX_resume_versions_job_id\` (\`job_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`ats_analyses\` (
        \`id\` varchar(36) NOT NULL,
        \`resume_version_id\` varchar(36) NOT NULL,
        \`job_id\` varchar(36) NOT NULL,
        \`score\` int NOT NULL,
        \`breakdown\` json NOT NULL,
        \`checks\` json NOT NULL,
        \`matched_keywords\` json NOT NULL,
        \`missing_keywords\` json NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IX_ats_analyses_version_created\` (\`resume_version_id\`, \`created_at\`, \`id\`),
        INDEX \`IX_ats_analyses_job_created\` (\`job_id\`, \`created_at\`, \`id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(
      'ALTER TABLE `resumes` ADD CONSTRAINT `FK_resumes_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `resume_versions` ADD CONSTRAINT `FK_resume_versions_resume` FOREIGN KEY (`resume_id`) REFERENCES `resumes`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `resume_versions` ADD CONSTRAINT `FK_resume_versions_job` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `ats_analyses` ADD CONSTRAINT `FK_ats_analyses_resume_version` FOREIGN KEY (`resume_version_id`) REFERENCES `resume_versions`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `ats_analyses` ADD CONSTRAINT `FK_ats_analyses_job` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Ordem inversa: FKs primeiro, depois as tabelas (análise → versão → currículo).
    await queryRunner.query(
      'ALTER TABLE `ats_analyses` DROP FOREIGN KEY `FK_ats_analyses_job`',
    );
    await queryRunner.query(
      'ALTER TABLE `ats_analyses` DROP FOREIGN KEY `FK_ats_analyses_resume_version`',
    );
    await queryRunner.query(
      'ALTER TABLE `resume_versions` DROP FOREIGN KEY `FK_resume_versions_job`',
    );
    await queryRunner.query(
      'ALTER TABLE `resume_versions` DROP FOREIGN KEY `FK_resume_versions_resume`',
    );
    await queryRunner.query(
      'ALTER TABLE `resumes` DROP FOREIGN KEY `FK_resumes_user`',
    );

    await queryRunner.query('DROP TABLE IF EXISTS `ats_analyses`');
    await queryRunner.query('DROP TABLE IF EXISTS `resume_versions`');
    await queryRunner.query('DROP TABLE IF EXISTS `resumes`');
  }
}
