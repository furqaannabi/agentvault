# @agentvault/exec — BE2 home

Single seam between BE1 (proof + policy) and on-chain swap execution.

## Public surface

```ts
import { createExecAdapter } from '@agentvault/exec';

const adapter = createExecAdapter({
  mode: process.env.EXEC_MODE === 'real' ? 'real' : 'mock',
  sepoliaRpcUrl: process.env.SEPOLIA_RPC_URL,
  sepoliaPrivateKey: process.env.SEPOLIA_PRIVATE_KEY,
});

const result = await adapter.swap({ proposal, verdict });
// result: ExecResult
```

## Files

| File | Owner | Notes |
|---|---|---|
| `src/index.ts` | shared | factory + types re-export. **Don't change without BE1 review.** |
| `src/mock.ts` | shared | synthetic ExecResult. BE1 uses for dev. |
| `src/real.ts` | **BE2** | live Uniswap v3 swap on Sepolia. Implement here. |

## Contract (signed in blood)

`adapter.swap(input)` MUST:
1. Always resolve to `ExecResult` — never throw.
2. Set `status='success'` only on confirmed receipt.
3. Set `status='reverted'` on tx revert; populate `error`.
4. Set `status='failed'` on any pre-flight failure (build/sign/send/timeout).
5. Honor `proposal.maxSlippageBps`.
6. Be idempotent on `proposal.id`.

## Suggested sub-packages (BE2 scope)

```
packages/wallet/       # viem signer, gas estimator, nonce mgmt, tx wait
packages/uniswap-api/  # Uniswap Trade API approval, quote, swap helpers
```

`real.ts` orchestrates them.

## Test fixtures

Use `@agentvault/mocks` for inputs:

```ts
import { mockProposal, mockVerdict } from '@agentvault/mocks';
const r = await adapter.swap({ proposal: mockProposal(), verdict: mockVerdict() });
```
