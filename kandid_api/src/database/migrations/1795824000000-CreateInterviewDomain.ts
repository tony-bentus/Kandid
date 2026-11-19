import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 6 (KAN-52): domínio de entrevistas por candidatura.
 *
 * Sequência local após `1795737600000-CreateResumeDomain`: 1795824000000
 * (+ 86.400.000 ms, sem colisão com as migrations existentes). Nomes físicos no
 * plural, FKs explícitos idênticos aos da entidade, `datetime(6)` e utf8mb4 no
 * padrão das migrations anteriores. `synchronize: false` permanece.
 *
 * `duration_minutes` é NOT NULL (ruling do tech lead) e `round` é informado pelo
 * cliente: a UNIQUE `(application_id, round)` é o identificador natural da
 * rodada. O índice composto cobre a ordenação da listagem
 * `round ASC, scheduled_at ASC, id ASC`.
 */
export class CreateInterviewDomain1795824000000 implements MigrationInterface {
  name = 'CreateInterviewDomain1795824000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`interviews\` (
        \`id\` varchar(36) NOT NULL,
        \`application_id\` varchar(36) NOT NULL,
        \`round\` int NOT NULL,
        \`type\` enum ('HR', 'TECHNICAL', 'BEHAVIORAL', 'CASE', 'CULTURAL', 'FINAL') NOT NULL,
        \`scheduled_at\` datetime(6) NOT NULL,
        \`duration_minutes\` int NOT NULL,
        \`interviewer_name\` varchar(120) NULL,
        \`interviewer_role\` varchar(120) NULL,
        \`meeting_url\` varchar(255) NULL,
        \`status\` enum ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW') NOT NULL DEFAULT 'SCHEDULED',
        \`feedback\` text NULL,
        \`outcome\` enum ('PENDING', 'PASSED', 'FAILED') NOT NULL DEFAULT 'PENDING',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`UQ_interviews_application_round\` (\`application_id\`, \`round\`),
        INDEX \`IX_interviews_application_round_scheduled\` (\`application_id\`, \`round\`, \`scheduled_at\`, \`id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(
      'ALTER TABLE `interviews` ADD CONSTRAINT `FK_interviews_application` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Ordem inversa: FK, índice de listagem, unique e, por fim, a tabela.
    await queryRunner.query(
      'ALTER TABLE `interviews` DROP FOREIGN KEY `FK_interviews_application`',
    );
    await queryRunner.query(
      'DROP INDEX `IX_interviews_application_round_scheduled` ON `interviews`',
    );
    await queryRunner.query(
      'DROP INDEX `UQ_interviews_application_round` ON `interviews`',
    );

    await queryRunner.query('DROP TABLE IF EXISTS `interviews`');
  }
}
