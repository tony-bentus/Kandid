import type { ApplicationStatus } from '../../../common/enums/application-status.enum.js';
import type { InterviewStatus } from '../../../common/enums/interview-status.enum.js';
import type { SalaryPeriod } from '../../../common/enums/salary-period.enum.js';
import type { Seniority } from '../../../common/enums/seniority.enum.js';

/** Entrada mínima das taxas de funil (já escopada por usuário no service). */
export interface FunnelApplication {
  id: string;
  status: ApplicationStatus;
  appliedAt: string | null;
}

export interface FunnelHistory {
  applicationId: string;
  toStatus: ApplicationStatus;
}

export interface FunnelInterview {
  applicationId: string;
  status: InterviewStatus;
}

/** Entrada de dwell: `createdAt` é a âncora sintética da etapa `SAVED`. */
export interface DwellApplication extends FunnelApplication {
  createdAt: Date;
}

export interface DwellHistory {
  id: string;
  applicationId: string;
  toStatus: ApplicationStatus;
  changedAt: Date;
}

/** Valores monetários já convertidos de `bigint`/string para centavos número. */
export interface MoneyInput {
  currency: string;
  salaryPeriod: SalaryPeriod;
  proposedCents: number | null;
  offeredCents: number | null;
}

export interface SeniorityMoneyInput extends MoneyInput {
  seniority: Seniority | null;
}

export interface SkillMoneyInput extends MoneyInput {
  skillId: string;
  skillName: string;
}

/** Formato interno para cálculo da diferença pareada. */
export interface MoneyPair {
  proposed: number;
  offered: number;
}
