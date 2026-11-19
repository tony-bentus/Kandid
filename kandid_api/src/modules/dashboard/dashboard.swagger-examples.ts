import { ApplicationStatus } from '../../common/enums/application-status.enum.js';
import { SalaryPeriod } from '../../common/enums/salary-period.enum.js';
import { Seniority } from '../../common/enums/seniority.enum.js';
import type { DashboardCompensationResponseDto } from './dto/dashboard-compensation-response.dto.js';
import type { DashboardSummaryResponseDto } from './dto/dashboard-summary-response.dto.js';

export const DASHBOARD_SUMMARY_EXAMPLE: DashboardSummaryResponseDto = {
  totalApplications: 24,
  submitted: 18,
  countsByStatus: {
    SAVED: 6,
    APPLIED: 3,
    SCREENING: 4,
    SCHEDULED: 1,
    INTERVIEW: 3,
    OFFER: 2,
    HIRED: 1,
    REJECTED: 2,
    WITHDRAWN: 1,
    CANCELLED: 0,
    GHOSTED: 1,
  },
  responseRate: 77.78,
  interviewRate: 44.44,
  offerRate: 22.22,
  averageTimeToFirstResponseDays: 4.35,
  averageDaysPerStage: [
    { status: ApplicationStatus.SAVED, averageDays: 2.5, sampleSize: 18 },
    { status: ApplicationStatus.APPLIED, averageDays: 6.25, sampleSize: 12 },
    { status: ApplicationStatus.SCREENING, averageDays: null, sampleSize: 0 },
    { status: ApplicationStatus.SCHEDULED, averageDays: null, sampleSize: 0 },
    { status: ApplicationStatus.INTERVIEW, averageDays: null, sampleSize: 0 },
    { status: ApplicationStatus.OFFER, averageDays: null, sampleSize: 0 },
    { status: ApplicationStatus.HIRED, averageDays: null, sampleSize: 0 },
    { status: ApplicationStatus.REJECTED, averageDays: null, sampleSize: 0 },
    { status: ApplicationStatus.WITHDRAWN, averageDays: null, sampleSize: 0 },
    { status: ApplicationStatus.CANCELLED, averageDays: null, sampleSize: 0 },
    { status: ApplicationStatus.GHOSTED, averageDays: null, sampleSize: 0 },
  ],
};

export const DASHBOARD_COMPENSATION_EXAMPLE: DashboardCompensationResponseDto = {
  byCurrency: [
    {
      currency: 'BRL',
      salaryPeriod: SalaryPeriod.MONTH,
      applicationCount: 7,
      proposed: {
        count: 6,
        minCents: 800000,
        maxCents: 1500000,
        averageCents: 1125000,
      },
      offered: {
        count: 3,
        minCents: 900000,
        maxCents: 1450000,
        averageCents: 1183333,
      },
      difference: {
        absoluteCents: 133333,
        percentage: 12.7,
        pairedSampleSize: 3,
      },
    },
  ],
  bySeniority: [
    {
      currency: 'BRL',
      salaryPeriod: SalaryPeriod.MONTH,
      seniority: Seniority.SENIOR,
      applicationCount: 4,
      proposed: {
        count: 4,
        minCents: 900000,
        maxCents: 1500000,
        averageCents: 1150000,
      },
      offered: {
        count: 2,
        minCents: 1100000,
        maxCents: 1450000,
        averageCents: 1275000,
      },
      difference: {
        absoluteCents: 175000,
        percentage: 17.5,
        pairedSampleSize: 2,
      },
    },
  ],
  bySkill: [
    {
      currency: 'BRL',
      salaryPeriod: SalaryPeriod.MONTH,
      skillId: '0b6f9f2e-4a3b-4c5d-8e6f-1a2b3c4d5e6f',
      skillName: 'Node.js',
      applicationCount: 5,
      proposed: {
        count: 4,
        minCents: 800000,
        maxCents: 1400000,
        averageCents: 1075000,
      },
      offered: {
        count: 2,
        minCents: 900000,
        maxCents: 1450000,
        averageCents: 1175000,
      },
      difference: {
        absoluteCents: 200000,
        percentage: 20,
        pairedSampleSize: 2,
      },
    },
  ],
};
