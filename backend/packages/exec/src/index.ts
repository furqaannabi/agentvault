import type { ExecAdapter, ExecMode } from '@agentvault/types';
import { mockAdapter } from './mock.js';
import { realAdapter } from './real.js';

export type { ExecAdapter, ExecMode } from '@agentvault/types';

export interface ExecConfig {
  mode: ExecMode;
  sepoliaRpcUrl?: string;
  sepoliaPrivateKey?: string;
}

export function createExecAdapter(config: ExecConfig): ExecAdapter {
  if (config.mode === 'mock') return mockAdapter();
  return realAdapter(config);
}
