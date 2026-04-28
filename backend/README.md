# AgentVault Backend (Phase 1)

ProofTwin: AI portfolio manager that produces a cryptographic proof for every decision.

## Stack

- pnpm monorepo, TypeScript, Node 20+
- Hono (HTTP), viem (chain), Zod (validation)
- 0G Galileo testnet (Compute, Storage KV, Storage Log, Chain)
- Ethereum Sepolia (chainId `11155111`) — Uniswap v3 / Universal Router. AgentVault is testnet-only; mainnet is rejected at the chain-guard layer.
- Foundry (contracts)
- Biome (lint+format), Vitest (test)

## Layout

```
agentvault/
├── backend/
│   ├── packages/
│   │   ├── types/       # shared interfaces
│   │   ├── mocks/       # fixtures
│   │   ├── memory/      # 0G Storage KV + Log
│   │   ├── twin/        # 0G Compute + VerifiableInference
│   │   ├── policy/      # rules + sanity + verdict sig
│   │   ├── proof/       # merkle + anchor
│   │   ├── uniswap-api/ # Uniswap Trade API client (quote / swap)
│   │   ├── keeperhub/   # KeeperHub Direct Execution client (Sepolia-only)
│   │   └── exec/        # mock | real | keeperhub adapter dispatcher
│   └── apps/api/        # Hono server
└── contracts/           # Foundry, ProofAnchor.sol (top-level)
```

## Setup

Full walkthrough: [docs/getting-started.md](./docs/getting-started.md)

TL;DR:
1. `pnpm install`
2. Fund 0G wallet, deploy `ProofAnchor` from `../contracts/`, paste address into `.env`
3. Run [0G Compute CLI dance](./docs/0g-compute-setup.md), paste 4 env vars
4. `pnpm dev` → http://localhost:8787

Storage auto-discovers nodes via indexer. KV + Log work out of the box once `.env` is filled.

## Routes

Public:
- `GET /config` — delegate addr, chainId, EIP-712 domain+types, allowed token list
- `GET /pubkey` — verdict signer pubkey (FE verification of policy verdicts)
- `GET /health` — liveness

Authenticated (`Authorization: Session <base64(SignedSession)>`):
- `POST /chat` — `{ msg }` → `{ proposal }`
- `POST /approve` — `{ proposalId }` → `{ proof }` or `{ rejected: verdict }` or `502 exec_failed`
- `GET /proof/:id` — full Proof object scoped to session.user
- `GET /portfolio` — on-chain balances of session.user across session.allowedTokens
- `POST /session/validate` — `{ ok, user, delegate, expiresAt, nonce }`
- `DELETE /session` — revoke nonce; subsequent calls 401 `revoked`

401 codes: `missing_or_malformed_session | bad_signature | expired | wrong_delegate | wrong_chain | revoked`

## Delegated execution model

Non-custodial flow:
1. User connects wallet (Ethereum Sepolia, chainId 11155111)
2. Approves ERC20 allowance to backend signer (`SEPOLIA_PRIVATE_KEY` addr)
3. Signs an EIP-712 `AgentSession` declaring bounds (max trade, slippage, allowed tokens, expiry)
4. FE attaches `Authorization: Session <base64(SignedSession)>` on every request
5. Backend on each `/approve`:
   - verifies session sig + bounds
   - `policyFromSession()` enforces user-set caps
   - `transferFrom(user, signer, amountIn)` pulls funds via allowance
   - swaps on Uniswap (`EXEC_MODE=real`) or routes the final tx through KeeperHub (`EXEC_MODE=keeperhub`) — see below
   - `transfer(user, amountOut)` returns output
   - assembles Proof with `userAddr` + `sessionHash` baked in
   - anchors `rootHash` on 0G Chain

Backend signer never holds funds outside a single trade window. All custody stays with the user. Session is off-chain (no gas), allowance is one-time per token.

## Execution: KeeperHub

AgentVault produces verifiable AI trade proposals. Execution is delegated to [KeeperHub](https://keeperhub.com) — the reliability layer for onchain agents (retries on revert, gas estimation, MEV-aware private routing, full audit trail). When `EXEC_MODE=keeperhub`:

1. The backend runs the Uniswap Trade API quote + Permit2 sign locally (same as direct mode).
2. Instead of `wallet.sendTransaction(swap)`, it decodes Universal Router calldata into `execute(bytes,bytes[],uint256)` and submits via `POST /api/execute/contract-call` to KeeperHub.
3. KeeperHub broadcasts via its Turnkey-secured wallet, retrying transient failures and surfacing every attempt in its dashboard.
4. The backend polls `GET /api/execute/{id}/status` until terminal, fetches the receipt, and parses `amountOut` from ERC-20 Transfer logs.
5. `Proof.exec.keeperhub` is populated with `{ jobId, auditTrailUrl, attempts, finalTxHash, finalGasUsed, status, network }`. This block is folded into `rootHash` via canonical hashing — verifiers can independently click through to KeeperHub's audit URL and see the same execution lifecycle.

### Setup

1. Create a KeeperHub org-scoped API key at <https://app.keeperhub.com> → Settings → API Keys → Organisation. The key starts with `kh_`.
2. Fund the KeeperHub Turnkey wallet on Sepolia (the dashboard shows the address). Top up with ≥0.05 ETH from a faucet.
3. Set env vars in `backend/.env`:
   ```env
   EXEC_MODE=keeperhub
   EXEC_CHAIN_ID=11155111
   KEEPERHUB_API_KEY=kh_...
   KEEPERHUB_NETWORK=sepolia
   # Optional:
   # KEEPERHUB_BASE_URL=https://app.keeperhub.com
   # KEEPERHUB_TIMEOUT_MS=30000
   # KEEPERHUB_FALLBACK=false
   ```
4. `pnpm dev` — `GET /config` will now report `executionLayer: "keeperhub"` and the FE renders a `KEEPERHUB · SEPOLIA` badge in the top bar.

### Failure semantics

| Outcome | Backend response | Proof state |
| --- | --- | --- |
| KeeperHub broadcast succeeds | 200 with `proof.exec.keeperhub.status = success` | rootHash binds the keeperhub block |
| KeeperHub reports `failed` (tx reverted, retries exhausted) | 502 `exec_failed` with top-level `keeperhubAuditUrl` + `lastRevertReason` | no proof persisted |
| KeeperHub reports `timeout` (poll budget exhausted) | 502 `exec_failed` | no proof persisted, `keeperhub.status = timeout` is still recoverable from the audit URL |
| KeeperHub *submission* itself fails (network/auth) | 502 `exec_failed` unless `KEEPERHUB_FALLBACK=true`, in which case a direct ethers send replaces the broadcast and the proof omits the keeperhub block (so verifiers can detect bypass) | depends on fallback flag |

### Demo retry path

To showcase retry behavior live (PRD §14):

1. Open the proof view in two windows.
2. Set `proposal.maxSlippageBps = 1` (or pre-fund the wallet just below the swap amount) before approving — first KeeperHub attempt reverts with slippage-exceeded.
3. KeeperHub retries with adjusted gas/slippage. The audit URL shows attempts incrementing in real time.
4. The successful attempt produces `proof.exec.keeperhub.attempts ≥ 2` and a clickable `KEEPERHUB · 2 ATTEMPTS` badge in the proof header.

### Network safety

- `EXEC_CHAIN_ID` must equal `11155111`. The `keeperhub` package hard-rejects any other chainId at construction.
- `KEEPERHUB_NETWORK` defaults to `sepolia`; verified against `GET https://app.keeperhub.com/api/chains`. The chainId is the source of truth, so a future slug rename is a single env-var change.
- The KeeperHub API key never leaves memory and is never serialized into `Proof`.

## Phase 1 done criteria

User chats → proposes trade → approves → swap executes (direct or via KeeperHub) → Proof Explorer shows full chain (signed inference + verdict + rules + tx hash + anchor tx + optional KeeperHub audit step). All ticks independently verifiable.
