# AgentVault Backend (Phase 1)

ProofTwin: AI portfolio manager that produces a cryptographic proof for every decision.

## Stack

- pnpm monorepo, TypeScript, Node 20+
- Hono (HTTP), viem (chain), Zod (validation)
- 0G Galileo testnet (Compute, Storage KV, Storage Log, Chain)
- Sepolia testnet (Uniswap v3 — BE2 scope)
- Foundry (contracts)
- Biome (lint+format), Vitest (test)

## Layout

```
agentvault/
├── backend/
│   ├── packages/
│   │   ├── types/    # shared interfaces
│   │   ├── mocks/    # fixtures
│   │   ├── memory/   # 0G Storage KV + Log
│   │   ├── twin/     # 0G Compute + VerifiableInference
│   │   ├── policy/   # rules + sanity + verdict sig
│   │   ├── proof/    # merkle + anchor
│   │   └── exec/     # swap interface (mock + real, BE2 owns real)
│   └── apps/api/     # Hono server
└── contracts/        # Foundry, ProofAnchor.sol (top-level)
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
1. User connects wallet (Base Sepolia)
2. Approves ERC20 allowance to backend signer (`SEPOLIA_PRIVATE_KEY` addr)
3. Signs an EIP-712 `AgentSession` declaring bounds (max trade, slippage, allowed tokens, expiry)
4. FE attaches `Authorization: Session <base64(SignedSession)>` on every request
5. Backend on each `/approve`:
   - verifies session sig + bounds
   - `policyFromSession()` enforces user-set caps
   - `transferFrom(user, signer, amountIn)` pulls funds via allowance
   - swaps on Uniswap
   - `transfer(user, amountOut)` returns output
   - assembles Proof with `userAddr` + `sessionHash` baked in
   - anchors `rootHash` on 0G Chain

Backend signer never holds funds outside a single trade window. All custody stays with the user. Session is off-chain (no gas), allowance is one-time per token.

## Phase 1 done criteria

User chats → proposes trade → approves → swap executes → Proof Explorer shows full chain (signed inference + verdict + rules + tx hash + anchor tx). All ticks independently verifiable.
