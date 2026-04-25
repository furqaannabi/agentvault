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
backend/
├── packages/
│   ├── types/        # shared interfaces
│   ├── mocks/        # fixtures
│   ├── memory/       # 0G Storage KV + Log
│   ├── twin/         # 0G Compute + VerifiableInference
│   ├── policy/       # rules + sanity + verdict sig
│   ├── proof/        # merkle + anchor
│   ├── contracts/    # Foundry, ProofAnchor.sol
│   └── exec/         # swap interface (mock + real, BE2 owns real)
└── apps/
    └── api/          # Hono server
```

## Setup

1. `pnpm install`
2. Copy `.env.example` → `.env` and fill values (see [Env setup](#env-setup) below)
3. Deploy contract: `pnpm --filter @agentvault/contracts deploy:galileo`
4. Run dev server: `pnpm dev`

## Env setup

### 0G Wallet
- Generate key (or use existing testnet wallet)
- Fund via faucet: https://faucet.0g.ai (0.1 0G/day)

### 0G Compute (one-time CLI dance)
Documented later in `docs/0g-compute-setup.md`.

### Storage
Auto-discovers nodes via indexer. Just need `ZG_INDEXER_ENDPOINT` + `ZG_FLOW_CONTRACT`.

## Routes

- `POST /chat` — `{ userId, msg }` → `{ proposal }`
- `POST /approve` — `{ proposalId }` → `{ proof }` or `{ rejected: verdict }`
- `GET /proof/:id` — full Proof object
- `GET /proofs?userId=` — list
- `GET /pubkey` — verdict signer pubkey (for FE verification)

## Phase 1 done criteria

User chats → proposes trade → approves → swap executes → Proof Explorer shows full chain (signed inference + verdict + rules + tx hash + anchor tx). All ticks independently verifiable.
