import { ApplicationStatus } from './application-status.enum.js';

/**
 * Única fonte da verdade da máquina de estados de candidaturas.
 *
 * A matriz segue o ADR 0004 §2. Transição para o mesmo status não aparece e
 * portanto é inválida. `GHOSTED` não é terminal; os terminais exatos são
 * `HIRED`, `REJECTED`, `WITHDRAWN` e `CANCELLED`.
 */
export const APPLICATION_TRANSITIONS: Record<
  ApplicationStatus,
  ApplicationStatus[]
> = {
  [ApplicationStatus.SAVED]: [
    ApplicationStatus.APPLIED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.APPLIED]: [
    ApplicationStatus.SCREENING,
    ApplicationStatus.SCHEDULED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.GHOSTED,
    ApplicationStatus.WITHDRAWN,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.SCREENING]: [
    ApplicationStatus.SCHEDULED,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.REJECTED,
    ApplicationStatus.GHOSTED,
    ApplicationStatus.WITHDRAWN,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.SCHEDULED]: [
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.REJECTED,
    ApplicationStatus.GHOSTED,
    ApplicationStatus.WITHDRAWN,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.INTERVIEW]: [
    ApplicationStatus.OFFER,
    ApplicationStatus.REJECTED,
    ApplicationStatus.GHOSTED,
    ApplicationStatus.WITHDRAWN,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.OFFER]: [
    ApplicationStatus.HIRED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.GHOSTED]: [
    ApplicationStatus.SCREENING,
    ApplicationStatus.SCHEDULED,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  [ApplicationStatus.HIRED]: [],
  [ApplicationStatus.REJECTED]: [],
  [ApplicationStatus.WITHDRAWN]: [],
  [ApplicationStatus.CANCELLED]: [],
};
