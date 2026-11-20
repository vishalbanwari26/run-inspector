// What the pages show. Plain JSON: from Postgres in the app, from
// fixtures/snapshot.json in the static demo.
export type RunStatus = 'running' | 'waiting' | 'failed' | 'done';
export type StepStatus = 'running' | 'done' | 'failed' | 'waiting';

export type AttemptView = {
  attempt: number;
  status: StepStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  errorKind: 'transient' | 'permanent' | null;
  invalidated: boolean;
  startedAt: string;
  endedAt: string | null;
};

export type EffectView = { kind: 'booking' | 'message'; id: string; externalRef: string; summary: string; createdAt: string };

export type RunView = {
  id: string;
  title: string;
  workflow: string;
  status: RunStatus;
  currentStep: string | null;
  error: string | null;
  outcome: unknown;
  text: string;
  faults: Record<string, unknown>;
  overrides: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  steps: Record<string, AttemptView[]>;
  effects: EffectView[];
};
