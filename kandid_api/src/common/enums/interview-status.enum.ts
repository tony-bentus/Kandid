/**
 * Situação da entrevista (spec `:174`).
 *
 * Independente de `InterviewOutcome`: a spec não define máquina de estados para
 * entrevistas, então qualquer valor é aceito em PATCH.
 */
export enum InterviewStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}
