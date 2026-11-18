/**
 * Estados da máquina de candidaturas (Sprint 4).
 *
 * String enum com membro igual ao valor para manter o contrato HTTP e o enum
 * do MySQL alinhados sem conversão adicional.
 */
export enum ApplicationStatus {
  SAVED = 'SAVED',
  APPLIED = 'APPLIED',
  SCREENING = 'SCREENING',
  SCHEDULED = 'SCHEDULED',
  INTERVIEW = 'INTERVIEW',
  OFFER = 'OFFER',
  HIRED = 'HIRED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
  CANCELLED = 'CANCELLED',
  GHOSTED = 'GHOSTED',
}
