/** Exemplos de request/response das rotas de entrevistas (KAN-52). */

export const INTERVIEW_REQUEST_EXAMPLE: Record<string, unknown> = {
  round: 1,
  type: 'TECHNICAL',
  scheduledAt: '2026-11-25T14:00:00.000Z',
  durationMinutes: 60,
  interviewerName: 'Maria Silva',
  interviewerRole: 'Tech Lead',
  meetingUrl: 'https://meet.example.com/abc-123',
};

export const INTERVIEW_RESPONSE_EXAMPLE: Record<string, unknown> = {
  id: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a',
  applicationId: '7a8b6c5d-4e3f-4a2b-9c1d-0e2f3a4b5c6d',
  round: 1,
  type: 'TECHNICAL',
  scheduledAt: '2026-11-25T14:00:00.000Z',
  durationMinutes: 60,
  interviewerName: 'Maria Silva',
  interviewerRole: 'Tech Lead',
  meetingUrl: 'https://meet.example.com/abc-123',
  status: 'SCHEDULED',
  feedback: null,
  outcome: 'PENDING',
  createdAt: '2026-11-19T12:00:00.000Z',
  updatedAt: '2026-11-19T12:00:00.000Z',
};

export const INTERVIEW_LIST_EXAMPLE: Record<string, unknown>[] = [
  {
    ...INTERVIEW_RESPONSE_EXAMPLE,
    status: 'COMPLETED',
    feedback: 'Boa discussão sobre arquitetura.',
    outcome: 'PASSED',
    updatedAt: '2026-11-26T18:30:00.000Z',
  },
];

export const INTERVIEW_UPDATE_EXAMPLE: Record<string, unknown> = {
  status: 'COMPLETED',
  outcome: 'PASSED',
  feedback: 'Boa discussão sobre arquitetura.',
  meetingUrl: null,
};
