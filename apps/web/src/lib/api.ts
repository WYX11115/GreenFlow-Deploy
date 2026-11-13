import type { ActorListResponse, ActorSelectionResponse, DashboardResponse, EvidenceView, HealthResponse, MilestoneId, TransactionDetail, TransactionResult } from '@greenflow/shared';

export const API_URL = import.meta.env.VITE_API_URL ?? '';
export class ApiRequestError extends Error { constructor(message: string, public code = 'REQUEST_FAILED', public txHash?: string) { super(message); } }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...init?.headers }
  });
  const detail = (await response.json().catch(() => null)) as { message?: string; code?: string; txHash?: string } | T | null;
  if (!response.ok) { const error = detail as { message?: string; code?: string; txHash?: string } | null; throw new ApiRequestError(error?.message ?? `Request failed with status ${response.status}.`, error?.code, error?.txHash); }
  return detail as T;
}
const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const api = {
  health: () => request<HealthResponse>('/api/health'), actors: () => request<ActorListResponse>('/api/demo/actors'),
  selectActor: (actorId: string) => post<ActorSelectionResponse>('/api/demo/actor', { actorId }), dashboard: () => request<DashboardResponse>('/api/dashboard'),
  openOffering: () => post<TransactionResult>('/api/offering/open'), subscribe: (units: number) => post<TransactionResult>('/api/subscriptions', { units }),
  proposeProject: () => post<TransactionResult>('/api/projects/propose'), approveProject: () => post<TransactionResult>('/api/projects/approve'),
  sampleEvidence: (milestoneId: MilestoneId) => post<EvidenceView>('/api/evidence/sample', { milestoneId }),
  uploadEvidence: async (file: File, milestoneId: MilestoneId) => { const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return post<EvidenceView>('/api/evidence', { milestoneId, fileName: file.name, mimeType: file.type, base64: btoa(binary) }); },
  requestDisbursement: (evidenceId: string, milestoneId: MilestoneId) => post<TransactionResult>('/api/disbursements', { evidenceId, milestoneId }),
  attemptInvalid: (kind: 'POLICY_NOT_APPROVED' | 'UNKNOWN_VENDOR' | 'OVER_LIMIT', milestoneId: MilestoneId, evidenceId?: string) => post<TransactionResult>('/api/disbursements/attempt-invalid', { kind, milestoneId, evidenceId }),
  approveRelease: (requestId: `REQUEST-${MilestoneId}`) => post<TransactionResult>(`/api/disbursements/${requestId}/approve`), rejectRequest: (requestId: `REQUEST-${MilestoneId}`) => post<TransactionResult>(`/api/disbursements/${requestId}/reject`),
  setPaused: (paused: boolean) => post<TransactionResult>(`/api/admin/treasury/${paused ? 'pause' : 'unpause'}`), reset: () => post<{ success: true; message: string }>('/api/demo/reset'),
  fundServicing: () => post<TransactionResult>('/api/servicing/fund'),
  advanceToMaturity: () => post<TransactionResult>('/api/demo/advance-to-maturity'),
  claimMaturityPayment: () => post<TransactionResult>('/api/servicing/claim'),
  transaction: (hash: string) => request<TransactionDetail>(`/api/transactions/${hash}`)
};
