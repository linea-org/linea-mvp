import type { ID, Timestamp } from './common';

export type PoolType = 'shared' | 'reserved' | 'dedicated' | 'byo';

export interface ResourcePool {
  id: ID;
  workspaceId: ID;
  poolType: PoolType;
  concurrencyBase: number;
  concurrencyBurst: number;
  cpuMillicores: number;
  memoryMb: number;
  timeoutMaxS: number;
  priority: number;
  burstEnabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ResourceQuota {
  workspaceId: ID;
  executionsPerMonth: number;
  executionsUsed: number;
  burstMinutesUsed: number;
  resetAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ResourceUsage {
  id: ID;
  workspaceId: ID;
  executionId: ID | null;
  cpuSeconds: number;
  memoryMbSeconds: number;
  wallSeconds: number;
  burstSeconds: number;
  recordedAt: Timestamp;
}
