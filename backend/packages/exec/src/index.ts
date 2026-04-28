import type { ExecAdapter, ExecMode } from '@agentvault/types';
import { type KeeperhubAdapterConfig, keeperhubAdapter } from './keeperhub.js';
import { mockAdapter } from './mock.js';
import { realAdapter } from './real.js';

export type { ExecAdapter, ExecMode } from '@agentvault/types';
export type { KeeperhubAdapterConfig } from './keeperhub.js';

export interface ExecConfig {
  mode: ExecMode;
  sepoliaRpcUrl?: string;
  sepoliaPrivateKey?: string;
  /** Required when mode === 'keeperhub'. */
  keeperhub?: KeeperhubAdapterConfig;
}

export function createExecAdapter(config: ExecConfig): ExecAdapter {
  switch (config.mode) {
    case 'mock':
      return mockAdapter();
    case 'real':
      return realAdapter(config);
    case 'keeperhub': {
      if (!config.keeperhub) {
        throw new Error('createExecAdapter: keeperhub config required when mode=keeperhub');
      }
      return keeperhubAdapter(config, config.keeperhub);
    }
    default: {
      const _exhaustive: never = config.mode;
      throw new Error(`createExecAdapter: unsupported mode ${String(_exhaustive)}`);
    }
  }
}
