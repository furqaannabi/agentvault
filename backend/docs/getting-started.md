# Getting Started — Backend

Full local setup, end-to-end demo.

## 1. Install

```bash
cd agentvault/backend
pnpm install
```

## 2. 0G testnet wallet

- Generate a key (or use existing).
- Fund via https://faucet.0g.ai (0.1 OG/day; run twice for safety).
- Add to `.env` as `ZG_PRIVATE_KEY`.

## 3. Deploy ProofAnchor contract

```bash
cd ../contracts
cp .env.example .env  # edit ZG_PRIVATE_KEY
forge install foundry-rs/forge-std --no-commit  # one-time
forge build && forge test
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $ZG_RPC_URL \
  --private-key $ZG_PRIVATE_KEY \
  --broadcast --legacy
```

Copy printed address → `backend/.env` as `PROOF_ANCHOR_ADDRESS`.

## 4. 0G Compute CLI

Follow [0g-compute-setup.md](./0g-compute-setup.md). Result: 4 env vars
(`ZG_COMPUTE_BASE_URL`, `ZG_COMPUTE_API_KEY`, `ZG_COMPUTE_MODEL`,
`ZG_COMPUTE_PROVIDER_ADDR`).

## 5. Run server

```bash
cd ../backend
cp .env.example .env  # fill all values
pnpm dev
```

Listens on http://localhost:8787.

## 6. Smoke test

```bash
# Health
curl http://localhost:8787/health

# Pubkey (verdict signer for FE)
curl http://localhost:8787/pubkey

# Chat → propose
curl -X POST http://localhost:8787/chat \
  -H 'content-type: application/json' \
  -d '{"userId":"alice","msg":"swap 500 USDC to ETH"}'

# Take proposal.id from response, then:
curl -X POST http://localhost:8787/approve \
  -H 'content-type: application/json' \
  -d '{"proposalId":"prop_..."}'

# Fetch proof
curl http://localhost:8787/proof/prop_...
```

## Modes

| Var | Effect |
|---|---|
| `EXEC_MODE=mock` | Synthetic ExecResult. Default for BE1 dev. No Sepolia needed. |
| `EXEC_MODE=real` | Calls `@agentvault/exec/real.ts` (BE2 implements). Requires `SEPOLIA_*`. |

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `missing env: ZG_*` | `.env` not loaded | confirm `dotenv` runs; restart server |
| `selectNodes` fails | indexer down | retry; check `ZG_INDEXER_ENDPOINT` |
| `anchorRoot` reverts | already anchored | proposalId reuse — generate new |
| `compute 401` | escrow expired | re-run `transfer-fund` |
| Hono 404 on `/chat` | typo or method mismatch | `POST` not `GET` |

## What's next (P2)

- BE2 implements `packages/exec/src/real.ts` (Uniswap v3 on Sepolia)
- Per-user ledger for cooldown + dailyCap (in `apps/api/src/routes/approve.ts buildPolicyContext`)
- AXL specialist twins (Risk + Macro)
- KeeperHub exec router
