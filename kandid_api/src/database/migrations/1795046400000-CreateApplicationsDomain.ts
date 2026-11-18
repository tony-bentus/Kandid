import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 4: domínio de candidaturas e histórico de status.
 *
 * SQL manual no padrão das migrations anteriores: charset/collation utf8mb4,
 * `datetime(6)`, `bigint unsigned` para centavos e enums do MySQL. A tabela de
 * histórico usa o nome singular canônico da spec (exceção registrada no ADR
 * 0004) e não possui `updated_at`: é append-only.
 *
 * Os nomes das FKs são explícitos nas entidades e repetidos aqui para que
 * `migration:revert` e `schema:log` não produzam drift.
 */
export class CreateApplicationsDomain1795046400000
  implements MigrationInterface
{
  name = 'CreateApplicationsDomain1795046400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`applications\` (
        \`id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`job_id\` varchar(36) NOT NULL,
        \`status\` enum ('SAVED', 'APPLIED', 'SCREENING', 'SCHEDULED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN', 'CANCELLED', 'GHOSTED') NOT NULL,
        \`applied_at\` date NULL,
        \`resume_version_id\` varchar(36) NULL,
        \`proposed_salary_cents\` bigint unsigned NULL,
        \`offered_salary_cents\` bigint unsigned NULL,
        \`currency\` char(3) NOT NULL DEFAULT 'BRL',
        \`salary_period\` enum ('MONTH', 'YEAR', 'HOUR', 'DAY') NOT NULL,
        \`benefits\` json NULL,
        \`next_step_at\` datetime(6) NULL,
        \`last_contact_at\` datetime(6) NULL,
        \`rejection_reason\` varchar(500) NULL,
        \`closed_at\` datetime(6) NULL,
        \`notes\` text NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`UQ_applications_user_job\` (\`user_id\`, \`job_id\`),
        INDEX \`IX_applications_user_created\` (\`user_id\`, \`created_at\`),
        INDEX \`IX_applications_user_status\` (\`user_id\`, \`status\`),
        INDEX \`IX_applications_job_id\` (\`job_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`application_status_history\` (
        \`id\` varchar(36) NOT NULL,
        \`application_id\` varchar(36) NOT NULL,
        \`from_status\` enum ('SAVED', 'APPLIED', 'SCREENING', 'SCHEDULED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN', 'CANCELLED', 'GHOSTED') NULL,
        \`to_status\` enum ('SAVED', 'APPLIED', 'SCREENING', 'SCHEDULED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN', 'CANCELLED', 'GHOSTED') NOT NULL,
        \`note\` varchar(500) NULL,
        \`changed_at\` datetime(6) NOT NULL,
        INDEX \`IX_application_status_history_app_changed\` (\`application_id\`, \`changed_at\`, \`id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(
      'ALTER TABLE `applications` ADD CONSTRAINT `FK_applications_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `applications` ADD CONSTRAINT `FK_applications_job` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `application_status_history` ADD CONSTRAINT `FK_application_status_history_application` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Ordem inversa: histórico, depois as FKs de applications.
    await queryRunner.query(
      'ALTER TABLE `application_status_history` DROP FOREIGN KEY `FK_application_status_history_application`',
    );
    await queryRunner.query(
      'ALTER TABLE `applications` DROP FOREIGN KEY `FK_applications_job`',
    );
    await queryRunner.query(
      'ALTER TABLE `applications` DROP FOREIGN KEY `FK_applications_user`',
    );

    await queryRunner.query('DROP TABLE IF EXISTS `application_status_history`');
    await queryRunner.query('DROP TABLE IF EXISTS `applications`');
  }
}
