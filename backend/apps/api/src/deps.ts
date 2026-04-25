import { createExecAdapter, type ExecAdapter } from '@agentvault/exec';
import { createMemory, type Memory } from '@agentvault/memory';
import { createPolicy, type Policy } from '@agentvault/policy';
import { createProofPipeline, type ProofPipeline } from '@agentvault/proof';
import { createTwin, type Twin } from '@agentvault/twin';

export interface AppDeps {
  memory: Memory;
  twin: Twin;
  policy: Policy;
  exec: ExecAdapter;
  proof: ProofPipeline;
}

export function buildDeps(): AppDeps {
  const memory = createMemory();
  const twin = createTwin({ memory });
  const policy = createPolicy({ twin });
  const exec = createExecAdapter({
    mode: process.env.EXEC_MODE === 'real' ? 'real' : 'mock',
    sepoliaRpcUrl: process.env.SEPOLIA_RPC_URL,
    sepoliaPrivateKey: process.env.SEPOLIA_PRIVATE_KEY,
  });
  const proof = createProofPipeline({ memory });
  return { memory, twin, policy, exec, proof };
}
