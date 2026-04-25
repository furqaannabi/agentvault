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

- `POST /chat` — `{ userId, msg }` → `{ proposal }`
- `POST /approve` — `{ proposalId }` → `{ proof }` or `{ rejected: verdict }`
- `GET /proof/:id` — full Proof object
- `GET /proofs?userId=` — list
- `GET /pubkey` — verdict signer pubkey (for FE verification)

## Phase 1 done criteria

User chats → proposes trade → approves → swap executes → Proof Explorer shows full chain (signed inference + verdict + rules + tx hash + anchor tx). All ticks independently verifiable.
