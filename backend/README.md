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

AgentVault produces verifiable AI trade proposals. Every gas-bearing onchain write is delegated to [KeeperHub](https://keeperhub.com) — the reliability layer for onchain agents (retries on revert, gas estimation, MEV-aware private routing, full audit trail). When `EXEC_MODE=keeperhub`:

1. The backend runs the Uniswap Trade API quote + Permit2 sign locally (same as direct mode).
2. The Permit2 approval (when needed) is decoded as `ERC20.approve(spender, amount)` and submitted via `POST /api/execute/contract-call`. KeeperHub signs and broadcasts from its Turnkey-secured wallet.
3. The Universal Router swap is decoded as `execute(bytes,bytes[],uint256)` and submitted through the same endpoint. KeeperHub broadcasts and retries transient failures, surfacing every attempt in its dashboard.
4. The backend polls `GET /api/execute/{id}/status` until terminal, fetches the receipt, and parses `amountOut` from ERC-20 Transfer logs.
5. Both KeeperHub receipts (kind: `approval`, kind: `swap`) are surfaced as a top-level `Proof.keeperhubReceipts` array. They form the **4th leaf** of `rootHash`:
   ```
   rootHash = keccak( h(proposal) ‖ h(verdict) ‖ h(exec) ‖ h(keeperhubReceipts) )
   ```
   This binds KeeperHub's independent execution log into the proof cryptographically — verifiers can click through to KeeperHub's audit URL and see the same job IDs, attempt counts, and tx hashes that are baked into the rootHash. `Proof.exec.keeperhub` is kept as a back-compat alias that mirrors the swap receipt for older readers.

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
| KeeperHub broadcast succeeds | 200 with `proof.keeperhubReceipts[*].status = success` | rootHash binds the receipts leaf |
| KeeperHub reports `failed` (tx reverted, retries exhausted) | 502 `exec_failed` with top-level `keeperhubAuditUrl` + `lastRevertReason` | no proof persisted |
| KeeperHub reports `timeout` (poll budget exhausted) | 502 `exec_failed` | no proof persisted, `keeperhub.status = timeout` is still recoverable from the audit URL |
| KeeperHub *submission* itself fails (network/auth) | 502 `exec_failed` unless `KEEPERHUB_FALLBACK=true`, in which case a direct ethers send replaces the broadcast and the proof omits the keeperhubReceipts (so verifiers can detect bypass) | depends on fallback flag |

### Live SSE progress (`Accept: text/event-stream`)

`POST /approve` is dual-mode. Default is JSON. With `Accept: text/event-stream` the route streams a deterministic lifecycle so the FE can render real-time sub-progress:

```
event: policy_check    data: { stage: "POLICY_CHECK", payload: { ok: true } }
event: submitting      data: { stage: "SUBMITTING",   step: "approval", payload: { jobId, ... } }
event: broadcast       data: { stage: "BROADCAST",    step: "approval", payload: { txHash, attempts } }
event: submitting      data: { stage: "SUBMITTING",   step: "swap",     payload: { jobId, ... } }
event: broadcast       data: { stage: "BROADCAST",    step: "swap",     payload: { txHash, attempts } }
event: confirming      data: { stage: "CONFIRMING",   ... }
event: settled         data: { stage: "SETTLED",      payload: { proof } }
```

The FE uses `fetch` + `ReadableStream` (native EventSource cannot send the `Authorization` header) and renders a 4-step strip: POLICY → SUBMIT → BROADCAST → CONFIRM. See `frontend/lib/api.ts → approveProposalStream` and `frontend/components/chat/ApprovalPrompt.tsx`.

### Demo retry path: `?demo=force-retry`

To showcase real KeeperHub retry behavior live (PRD §14), append `?demo=force-retry` to the approval call (the FE already forwards the URL query param):

```
POST /approve?demo=force-retry
```

This sets `gasLimitMultiplier: '0.85'` on the swap submission to KeeperHub. The first attempt under-estimates gas → out-of-gas revert → KeeperHub's retry policy bumps gas → second attempt succeeds. The successful proof carries `proof.keeperhubReceipts[].attempts ≥ 2`, the KeeperHub dashboard shows attempt history, and the FE proof header renders a clickable `KEEPERHUB · 2 ATTEMPTS` badge.

Pre-demo smoke run (manual, requires Sepolia funds + funded KH Turnkey wallet):

1. `pnpm dev` with `EXEC_MODE=keeperhub` and `KEEPERHUB_API_KEY` set.
2. Connect a session, deposit USDC allowance to the delegate.
3. Approve once normally — confirm `attempts: 1`.
4. Approve once with `?demo=force-retry` — confirm `attempts ≥ 2` in both the proof and the KH dashboard.
5. If the auto-retry does not fire on out-of-gas (KH retry policy is opaque), drop the flag and document that retries are observed only on transient RPC failures; the rest of the demo (LIVE pill, SSE strip, audit URL, 4-leaf rootHash) is unchanged.

### Network safety

- `EXEC_CHAIN_ID` must equal `11155111`. The `keeperhub` package hard-rejects any other chainId at construction.
- `KEEPERHUB_NETWORK` defaults to `sepolia`; verified against `GET https://app.keeperhub.com/api/chains`. The chainId is the source of truth, so a future slug rename is a single env-var change.
- The KeeperHub API key never leaves memory and is never serialized into `Proof`.

## Phase 1 done criteria

User chats → proposes trade → approves → swap executes (direct or via KeeperHub) → Proof Explorer shows full chain (signed inference + verdict + rules + tx hash + anchor tx + optional KeeperHub audit step). All ticks independently verifiable.
