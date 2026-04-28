import { type ExecAdapter, type ExecMode, createExecAdapter } from '@agentvault/exec';
import { type Memory, createMemory } from '@agentvault/memory';
import { type Policy, createPolicy } from '@agentvault/policy';
import { type ProofPipeline, createProofPipeline } from '@agentvault/proof';
import { type Twin, createTwin } from '@agentvault/twin';

export interface AppDeps {
  memory: Memory;
  twin: Twin;
  policy: Policy;
  exec: ExecAdapter;
  proof: ProofPipeline;
  execMode: ExecMode;
  chainId: number;
}

const SEPOLIA_CHAIN_ID = 11155111;

function parseExecMode(raw: string | undefined): ExecMode {
  switch (raw) {
    case 'real':
      return 'real';
    case 'keeperhub':
      return 'keeperhub';
    case 'mock':
    case undefined:
    case '':
      return 'mock';
    default:
      throw new Error(`EXEC_MODE invalid: "${raw}". Expected mock | real | keeperhub.`);
  }
}

export function buildDeps(): AppDeps {
  const memory = createMemory();
  const twin = createTwin({ memory });
  const policy = createPolicy({ twin });
  const execMode = parseExecMode(process.env.EXEC_MODE);
  const chainId = Number(process.env.EXEC_CHAIN_ID ?? SEPOLIA_CHAIN_ID);

  if (execMode === 'keeperhub' && chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      `EXEC_MODE=keeperhub requires EXEC_CHAIN_ID=${SEPOLIA_CHAIN_ID} (Ethereum Sepolia); got ${chainId}`,
    );
  }

  const exec = createExecAdapter({
    mode: execMode,
    sepoliaRpcUrl: process.env.SEPOLIA_RPC_URL,
    sepoliaPrivateKey: process.env.SEPOLIA_PRIVATE_KEY,
    keeperhub:
      execMode === 'keeperhub'
        ? {
            apiKey: requireEnv('KEEPERHUB_API_KEY'),
            baseUrl: process.env.KEEPERHUB_BASE_URL,
            network: process.env.KEEPERHUB_NETWORK ?? 'sepolia',
            chainId: SEPOLIA_CHAIN_ID,
            timeoutMs: process.env.KEEPERHUB_TIMEOUT_MS
              ? Number(process.env.KEEPERHUB_TIMEOUT_MS)
              : undefined,
            fallbackToDirect: process.env.KEEPERHUB_FALLBACK === 'true',
            dashboardUrl: process.env.KEEPERHUB_DASHBOARD_URL,
          }
        : undefined,
  });
  const proof = createProofPipeline({ memory });
  return { memory, twin, policy, exec, proof, execMode, chainId };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required when EXEC_MODE=keeperhub`);
  return v;
}
