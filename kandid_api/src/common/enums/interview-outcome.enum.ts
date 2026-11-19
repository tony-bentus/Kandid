/**
 * Resultado da entrevista (spec `:175`).
 *
 * `PENDING` é o default na criação; não há regra que exija `COMPLETED` para
 * `PASSED`/`FAILED` nesta sprint.
 */
export enum InterviewOutcome {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
}
