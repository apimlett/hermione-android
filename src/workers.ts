// Bridge-specific ledger-v1 contract. Not invented Hermes SSE events.
export type WorkerState = 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted' | 'unknown';
export type Worker = {
  id: string; delegationId: string; taskIndex: number; profile: string;
  parentSessionId: string | null; parentRunId: null; parentJobId: null;
  label: string; state: WorkerState; recordedState: WorkerState; activity: string;
  startedAt: number | null; updatedAt: number | null; completedAt: number | null;
  liveness: 'unknown'; review: 'unknown'; delivery: string; eventId: string | null;
};
export type WorkerSnapshot = { capability: 'ledger-v1' | 'disabled' | 'unavailable'; workers: Worker[]; hasMore: boolean; push: 'blocked' };
export const NO_WORKERS: WorkerSnapshot = { capability: 'unavailable', workers: [], hasMore: false, push: 'blocked' };
