# AgentVault

**An AI portfolio manager you can actually verify.**

You chat. It trades. Every decision leaves a cryptographic receipt — *who reasoned, who approved, who broadcast, what landed onchain*.

No screenshots. No "trust me." Just proofs.

---

## Why this matters

Most AI agent demos are black boxes. You see a chat reply and a green checkmark, and you're supposed to believe the trade went through the way the agent says it did.

AgentVault flips that. Every trade produces a public, independently checkable record:

- **The AI's reasoning is signed** — model, prompt, output, all hashed and signed by the backend.
- **The policy that approved it is signed** — the rules you delegated, the verdict, the signer.
- **The onchain execution is real** — actual Universal Router swap on Sepolia, actual receipts.
- **The broadcast is auditable** — KeeperHub's independent log of attempts, retries, gas bumps.
- **All four are bound together** — one rootHash anchored on 0G Galileo. Tamper with any leaf, the root breaks.

If the agent lies, the math says so.

---

## What you can do with it

1. Connect your wallet (Sepolia testnet).
2. Sign a one-time `AgentSession` — bounded delegation: max trade size, slippage cap, allowed tokens, daily volume cap, cooldown. No per-trade signature after this.
3. Chat: *"rebalance ~$50 of USDC into ETH with at most 0.5% slippage"*.
4. Agent proposes. Policy engine checks against your bounds. You approve.
5. Watch the 4-step progress strip light up live: **POLICY → SUBMIT → BROADCAST → CONFIRM**.
6. Open the Proof Explorer. Every leaf clickable. Every claim verifiable.

Want to see a real retry? Append `?demo=force-retry` — KeeperHub's first attempt under-estimates gas and reverts; the retry policy bumps gas; second attempt lands. The proof shows `attempts: 2`. No simulation.

---

## The trust chain at a glance

```
chat ─► AI proposes ─► policy verifies ─► KeeperHub broadcasts ─► proof anchored
        (signed)        (signed verdict)   (independent audit)     (on 0G chain)
```

Each arrow is a cryptographic step. The final proof binds all four into one rootHash:

```
rootHash = keccak( h(proposal) ‖ h(verdict) ‖ h(exec) ‖ h(keeperhubReceipts) )
```

---

## Quick start

```bash
pnpm install
cp backend/.env.example backend/.env
# fill: SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL, UNISWAP_API_KEY,
#       0G compute creds, KEEPERHUB_API_KEY, EXEC_MODE=keeperhub

cd contracts && forge script script/Deploy.s.sol --broadcast
# paste the deployed ProofAnchor address into backend/.env

pnpm -r build
pnpm --filter @agentvault/api dev      # http://localhost:8787
pnpm --filter agentvault-frontend dev  # http://localhost:3000
```

Detailed setup, 0G Compute CLI, KeeperHub Turnkey funding, and Sepolia chain-guards live in [`backend/README.md`](./backend/README.md).

---

## Verifying a proof yourself

Anyone with the proof JSON can re-check every claim:

1. **Inference** — refetch model output at `proposal.inference.providerUrl`, hash, verify signature.
2. **Verdict** — recompute rules from `verdict.rules`, verify the verdict signer.
3. **Execution** — `eth_getTransactionReceipt(exec.txHash)` on Sepolia, parse Transfer logs.
4. **KeeperHub** — open `keeperhubReceipts[i].auditTrailUrl` (independent KH record).
5. **Binding** — recompute `keccak(...)`; must equal `proof.rootHash`.
6. **Anchor** — `eth_getTransactionByHash(proof.anchorTx)` on 0G Galileo; calldata contains the rootHash.

Any step fails → the trade did not happen the way the agent says it did.

---

## Testnets only

Hard-coded to Ethereum Sepolia (`11155111`) and 0G Galileo (`16602`). Mainnet chainIds rejected at the chain-guard layer of every package. You cannot accidentally point this at funds you care about.

---

## Architecture

```
┌─────────┐     chat       ┌──────────┐                   ┌──────────┐
│  user   ├───────────────▶│  twin    │  signed inference │  policy  │
│ wallet  │                │ (0G LLM) ├──────────────────▶│  engine  │
└────┬────┘                └──────────┘                   └────┬─────┘
     │ EIP-712 AgentSession (off-chain, no gas)                │ verdict (signed)
     │ ERC-20 allowance (one-time, to delegate)                ▼
     │                                          ┌────────────────────────┐
     └─────────── /approve ────────────────────▶│   keeperhub adapter    │
                                                │  ┌──────────────────┐  │
                                                │  │ transferFrom user│ ─┼─── direct ethers
                                                │  ├──────────────────┤  │
                                                │  │ Permit2 approve  │ ─┼──▶ KeeperHub
                                                │  ├──────────────────┤  │
                                                │  │ Uniswap swap     │ ─┼──▶ KeeperHub
                                                │  ├──────────────────┤  │     (retry, gas-bump, audit)
                                                │  │ transfer to user │ ─┼─── direct ethers
                                                │  └──────────────────┘  │
                                                └───────────┬────────────┘
                                                            ▼
                                                ┌────────────────────────┐
                                                │ assembleProof          │
                                                │   rootHash = keccak(   │
                                                │     h(proposal) ‖      │
                                                │     h(verdict)  ‖      │
                                                │     h(exec)     ‖      │
                                                │     h(keeperhubReceipts)│
                                                │   )                    │
                                                │ anchor on 0G chain ────┼──▶ ProofAnchor.sol
                                                └────────────────────────┘
```

### What's verifiable, where it lives

| Layer | Verifiable claim | Field |
| --- | --- | --- |
| AI inference | provider URL, model id, prompt + output hashes, signed | `proof.proposal.inference` |
| Policy verdict | rules evaluated, sanity-check inference, signed | `proof.verdict` |
| Onchain execution | tx hash, block, amountOut from logs | `proof.exec` |
| Reliability | KeeperHub job IDs, attempts, audit trail URL | `proof.keeperhubReceipts` |
| Binding | 4-leaf rootHash | `proof.rootHash` + `proof.anchorTx` |

### Repository layout

```
agentvault/
├── backend/                 # pnpm monorepo
│   ├── apps/api/            # Hono HTTP server
│   └── packages/
│       ├── types/           # shared TS interfaces
│       ├── memory/          # 0G Storage KV + immutable Log
│       ├── twin/            # 0G Compute LLM client + inference signing
│       ├── policy/          # bounded-rules engine + verdict signer
│       ├── proof/           # canonical hashing, 4-leaf rootHash, 0G anchoring
│       ├── exec/            # mock | real | keeperhub adapter dispatcher
│       ├── uniswap-api/     # Uniswap Trade API client
│       └── keeperhub/       # KeeperHub Direct Execution client
├── frontend/                # Next.js, ApprovalPrompt + ProofExplorer
└── contracts/               # Foundry — ProofAnchor.sol
```

### Execution modes

`EXEC_MODE` decides who broadcasts:

| mode | What it does |
| --- | --- |
| `mock` | synthesizes plausible `ExecResult`, no chain calls — unit tests, FE iteration |
| `real` | direct `ethers.sendTransaction` from the backend signer — dev fallback |
| `keeperhub` | every gas-bearing write (Permit2 approval + Universal Router swap) goes through KeeperHub — demo + production-like path |

### Live progress (SSE)

`POST /approve` is dual-mode:

- `Accept: application/json` — single response with the final `Proof`.
- `Accept: text/event-stream` — emits the lifecycle:

```
event: policy_check    data: { stage: "POLICY_CHECK",  payload: { ok } }
event: submitting      data: { stage: "SUBMITTING",    step: "approval", payload: { jobId } }
event: broadcast       data: { stage: "BROADCAST",     step: "approval", payload: { txHash, attempts } }
event: submitting      data: { stage: "SUBMITTING",    step: "swap",     payload: { jobId } }
event: broadcast       data: { stage: "BROADCAST",     step: "swap",     payload: { txHash, attempts } }
event: confirming      data: { stage: "CONFIRMING",    payload: { txHash } }
event: settled         data: { stage: "SETTLED",       payload: { proof } }
```

The frontend renders a 4-step progress strip — POLICY → SUBMIT → BROADCAST → CONFIRM — that collapses into the proof view on `SETTLED`.

---

## Status

**Phase 1 (current):** chat → propose → approve → swap (mock | real | keeperhub) → proof anchored on 0G; FE Proof Explorer shows full chain.

**Phase 2 (deferred):** specialist swarm, ledger-backed dailyCap/cooldown, KeeperHub workflows for x402 + private routing.

See [`backend/README.md`](./backend/README.md) for canonical Phase 1 done criteria and the full failure-semantics matrix.

---

## Hackathon submission

Submitted to **[ETHGlobal Open Agents 2026](https://ethglobal.com/events/openagents/prizes)** across three tracks. Same codebase, same demo, same proofs back all three. Builder feedback for Uniswap + KeeperHub lives in [`FEEDBACK.md`](./FEEDBACK.md).

### Tracks

#### 0G — Best Autonomous Agents, Swarms & iNFT Innovations (up to $1,500)

> "Personal Digital Twin agent that learns from user behavior and maintains evolving persistent memory via 0G Storage."

- **0G Compute:** every LLM call goes through a 0G compute provider; provider URL, model id, prompt + output hashes, timestamp signed and embedded in `proof.proposal.inference` and `proof.verdict.sanityInference`.
- **0G Storage KV:** sessions, proposals, verdicts, proofs, per-user portfolio state — all in 0G KV. No external DB.
- **0G Storage Log:** every verdict and assembled proof appended to an immutable Log; returned `rootHash` becomes our `logCid`.
- **0G Chain:** the 4-leaf rootHash anchored on 0G Galileo via `ProofAnchor.sol`.
- **Self-fact-checking:** the same proposal re-inferred under a different system prompt as sanity check; both inferences bound into rootHash.

#### Uniswap Foundation — Best Uniswap API Integration ($1,000–$2,500)

> "Build the future of agentic finance with Uniswap."

- Real execution on Sepolia: `/check_approval`, `/quote` with Permit2, `/swap` against Universal Router.
- Calldata returned by `/swap` is decoded, re-routed through KeeperHub, full lifecycle bound into a verifiable Proof.
- Trade originates from a 0G-Compute LLM call, bounded by user-signed `AgentSession`, produces a public verifiable record.
- See [`FEEDBACK.md`](./FEEDBACK.md) §1 for Trade API DX feedback.

#### KeeperHub — Best Use of KeeperHub ($500–$2,500)

> "Show us something we haven't seen before."

- **Both onchain writes go through KeeperHub** — Permit2 approval and Universal Router execute. Not just sprinkled on a single tx.
- **Cryptographic binding:** receipts (`jobId`, `attempts`, `auditTrailUrl`, `finalTxHash`) form the **4th leaf** of the rootHash. Most submissions surface KH as a URL; we bake KH's execution log into the proof itself.
- **Real retry demo:** `?demo=force-retry` sets `gasLimitMultiplier='0.85'`; first attempt OOG-reverts, KH bumps gas, second lands. Audit trail and proof both show `attempts ≥ 2`.
- **Live SSE sub-progress** driven by stages emitted from the KH adapter at every lifecycle transition.
- **Sepolia chain-guard:** KH client refuses construction on any chainId ≠ 11155111.

#### KeeperHub — Builder Feedback Bounty ($250)

Honest, specific, actionable feedback: P0 doc defect (auth header), retry-policy opacity, missing log decoding, concrete feature requests. See [`FEEDBACK.md`](./FEEDBACK.md) §2.

### Submission checklist

- [x] Public GitHub repo + README — this file + [`backend/README.md`](./backend/README.md)
- [x] Setup instructions — [`backend/README.md`](./backend/README.md)
- [x] Architecture diagram — [Architecture](#architecture) above
- [x] `FEEDBACK.md` (Uniswap requirement) — [`FEEDBACK.md`](./FEEDBACK.md)
- [x] Brief write-up of approach + KH integration — [Tracks](#tracks) + [Execution modes](#execution-modes)
- [x] Working examples + clear documentation — package READMEs in `backend/packages/exec/` and `backend/packages/uniswap-api/`
- [ ] Demo video (≤ 3 min) — TBD
- [ ] Live demo link — TBD
- [x] Contract deployment addresses — [Deployments](#deployments)
- [ ] Team contact — TBD

### Demo

- **Live demo:** _TBD_
- **Demo video:** _TBD_
- **Flow:** connect wallet → approve USDC + sign session → chat *"rebalance ~$50 USDC into ETH"* → APPROVE → SSE strip lights up → open KH dashboard side-by-side → open Proof Explorer → click anchor tx → rootHash on-chain matches proof. Re-run with `?demo=force-retry` → `attempts: 2` everywhere.

### Deployments

| Component | Network | Address |
| --- | --- | --- |
| `ProofAnchor.sol` | 0G Galileo (`16602`) | _TBD_ |
| KeeperHub Turnkey wallet | Sepolia (`11155111`) | _TBD_ |
| Backend delegate signer | Sepolia (`11155111`) | _TBD_ |

### Team

| Role | Name | Telegram | X |
| --- | --- | --- | --- |
| _TBD_ | _TBD_ | _TBD_ | _TBD_ |

### Protocols / SDKs

- **0G** — `@0gfoundation/0g-ts-sdk` (Storage KV + Log), 0G Compute REST, 0G Galileo chain.
- **Uniswap Foundation** — Trade API on Sepolia v2 Universal Router.
- **KeeperHub** — Direct Execution REST API; X-API-Key auth; `network: sepolia`.
- **Hono** + **viem/ethers** + **Zod** — backend.
- **Next.js** + **wagmi** + **rainbowkit** + **framer-motion** — frontend.
- **Foundry** — `ProofAnchor.sol`.

---

## License

MIT.
