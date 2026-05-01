# AgentVault — your verifiable AI portfolio manager

> **ProofTwin**: every AI decision produces a cryptographic proof anchored on-chain.
> **KeeperHub**: every gas-bearing onchain write is delegated to KeeperHub for guaranteed execution + retry + audit trail.

> Submitted to [**ETHGlobal Open Agents 2026**](https://ethglobal.com/events/openagents/prizes) — see [Hackathon submission](#hackathon-submission) for per-track requirement mapping. Builder feedback for the Uniswap Foundation + KeeperHub tracks lives in [`FEEDBACK.md`](./FEEDBACK.md).

AgentVault is a non-custodial, testnet-only portfolio manager. You chat with the agent in natural language; it proposes a trade; the policy engine verifies it against bounds you signed; KeeperHub broadcasts the trade with retry-on-revert and full audit; a 4-leaf rootHash binding the inference, verdict, execution and KeeperHub receipts is anchored on the 0G Galileo chain.

The result: a public, verifiable record of *who reasoned*, *who approved*, *who broadcast*, and *what landed onchain* — for every single trade.

## Why this exists

Most "AI agent" demos are black boxes. You see the chat reply; you trust the screenshot. AgentVault makes every step independently checkable:

| Layer | What's verifiable | Where it lives |
| --- | --- | --- |
| AI inference | LLM provider URL, model id, prompt hash, output hash, signed by the backend | `Proof.proposal.inference` |
| Policy verdict | Rules evaluated, sanity-check inference, signed by the verdict signer | `Proof.verdict` |
| Onchain execution | tx hash, block, amountOut from logs | `Proof.exec` |
| Reliability layer | KeeperHub job IDs, attempts, audit trail URL — for both Permit2 approval and the swap | `Proof.keeperhubReceipts` |
| Binding | `rootHash = keccak(h(proposal) ‖ h(verdict) ‖ h(exec) ‖ h(keeperhubReceipts))` anchored on 0G | `Proof.rootHash` + `Proof.anchorTx` |

All of those URLs are clickable from the FE Proof Explorer.

## Twin: plan-first chat

The twin is **two-turn by design**, not single-shot:

1. *"rebalance ~$50 USDC into ETH"* → the twin replies with a natural-language **plan**. No `TradeProposal` is created, no inference is signed for execution, no policy verdict is requested. The plan is appended to convo memory in 0G KV.
2. *"execute this plan"* / *"do it"* / *"go ahead"* / *"approve"* → the twin re-extracts the trade spec from the prior turn (so token amounts and decimals come from the original request, not a re-guess), produces a signed `VerifiableInference`, and returns a `TradeProposal`.

Why: it removes the "LLM hallucinated an amount with wrong decimals on a follow-up" failure mode, and ensures no proposal is signed without an explicit user execute trigger. Intent classification uses a local regex fast-path (token symbols + execute trigger words) and falls back to an LLM intent prompt only for ambiguous messages — see [`backend/packages/twin/src/index.ts`](./backend/packages/twin/src/index.ts).

## How it works

```
┌─────────┐     chat       ┌──────────┐                   ┌──────────┐
│  user   ├───────────────▶│  twin    │  signed inference │  policy  │
│ wallet  │                │ (0G LLM) ├──────────────────▶│  engine  │
└────┬────┘                └──────────┘                   └────┬─────┘
     │ EIP-712 AgentSession (off-chain, no gas)                │ verdict (signed)
     │ ERC-20 allowance (one-time, to delegate)                ▼
     │                                          ┌────────────────────────┐
     └─────────── /approve ────────────────────▶│   keeperhub adapter     │
                                                │  ┌──────────────────┐   │
                                                │  │ transferFrom user│  ─┼─── direct ethers (allowance is to us)
                                                │  ├──────────────────┤   │
                                                │  │ Permit2 approve  │  ─┼──▶ KeeperHub /api/execute/contract-call
                                                │  ├──────────────────┤   │
                                                │  │ Uniswap swap     │  ─┼──▶ KeeperHub /api/execute/contract-call
                                                │  ├──────────────────┤   │     (retries, gas-bumps, audit)
                                                │  │ transfer to user │  ─┼─── direct ethers
                                                │  └──────────────────┘   │
                                                └───────────┬────────────┘
                                                            ▼
                                                ┌────────────────────────┐
                                                │ assembleProof          │
                                                │   rootHash = keccak(   │
                                                │     h(proposal) ‖      │
                                                │     h(verdict)  ‖      │
                                                │     h(exec)     ‖      │
                                                │     h(keeperhubReceipts)│
                                                │   )                     │
                                                │ anchor on 0G chain ────┼──▶ ProofAnchor.sol
                                                └────────────────────────┘
```

## Repository layout

```
agentvault/
├── backend/                 # pnpm monorepo
│   ├── apps/api/            # Hono HTTP server
│   └── packages/
│       ├── types/           # shared TS interfaces (Proof, ExecResult, KeeperhubExecution, …)
│       ├── memory/          # 0G Storage KV + immutable Log
│       ├── twin/            # 0G Compute LLM client + VerifiableInference signing
│       ├── policy/          # bounded-rules engine + verdict signer
│       ├── proof/           # canonical hashing, 4-leaf rootHash, 0G anchoring
│       ├── exec/            # mock | real | keeperhub adapter dispatcher
│       ├── uniswap-api/     # Uniswap Trade API client (quote, /swap, /check_approval)
│       └── keeperhub/       # KeeperHub Direct Execution client (Sepolia-only)
├── frontend/                # Next.js, design-system components, ApprovalPrompt + ProofExplorer
└── contracts/               # Foundry — ProofAnchor.sol (root anchor)
```

## Quick start

```bash
# 1. Install
pnpm install

# 2. Configure (testnets only)
cp backend/.env.example backend/.env
# fill: SEPOLIA_PRIVATE_KEY, SEPOLIA_RPC_URL, UNISWAP_API_KEY,
#       0G compute creds, KEEPERHUB_API_KEY, EXEC_MODE=keeperhub

# 3. Deploy ProofAnchor on 0G Galileo (one-time)
cd contracts && forge script script/Deploy.s.sol --broadcast
# paste address into backend/.env as PROOF_ANCHOR_ADDRESS

# 4. Run
pnpm -r build              # backend/frontend type-checked + compiled
pnpm --filter @agentvault/api dev      # http://localhost:8787
pnpm --filter agentvault-frontend dev  # http://localhost:3000
```

Detailed setup, including 0G Compute CLI, KeeperHub Turnkey funding, and the Sepolia chain-guard rules, lives in [`backend/README.md`](./backend/README.md).

## Execution modes

`EXEC_MODE` decides who broadcasts:

| mode | What it does | Use case |
| --- | --- | --- |
| `mock` | synthesizes plausible `ExecResult`, no chain calls | unit tests, FE-only iteration |
| `real` | direct `ethers.sendTransaction` from the backend signer | dev fallback if KeeperHub is down |
| `keeperhub` | every gas-bearing write (Permit2 approval + Universal Router swap) goes through KeeperHub | demo + production-like path |

In `keeperhub` mode the FE TopBar shows a `KEEPERHUB · SEPOLIA · LIVE` pill with a green dot once `/config` resolves.

## Live progress (Server-Sent Events)

`POST /approve` is dual-mode:

- `Accept: application/json` (default) — single response with the final `Proof`.
- `Accept: text/event-stream` — emits the lifecycle as it happens:

```
event: policy_check    data: { stage: "POLICY_CHECK",  payload: { ok } }
event: submitting      data: { stage: "SUBMITTING",    step: "approval", payload: { jobId } }
event: broadcast       data: { stage: "BROADCAST",     step: "approval", payload: { txHash, attempts } }
event: submitting      data: { stage: "SUBMITTING",    step: "swap",     payload: { jobId } }
event: broadcast       data: { stage: "BROADCAST",     step: "swap",     payload: { txHash, attempts } }
event: confirming      data: { stage: "CONFIRMING",    payload: { txHash } }
event: settled         data: { stage: "SETTLED",       payload: { proof } }
```

The frontend (`frontend/lib/api.ts → approveProposalStream`) consumes the stream via `fetch` + `ReadableStream` (native `EventSource` cannot send the `Authorization` header) and renders a 4-step progress strip — POLICY → SUBMIT → BROADCAST → CONFIRM — that collapses into the proof view on `SETTLED`.

## Demo retry path: `?demo=force-retry`

Append `?demo=force-retry` to the approval to provoke a real KeeperHub retry:

```
POST /approve?demo=force-retry
```

This sets `gasLimitMultiplier: '0.85'` on the swap submission. The first KH attempt under-estimates gas → out-of-gas revert → KeeperHub's retry policy bumps gas → second attempt succeeds. The resulting proof carries `proof.keeperhubReceipts[].attempts ≥ 2`, the KH dashboard shows the attempt history, and the FE renders a clickable `KEEPERHUB · 2 ATTEMPTS` badge in the proof header.

The demo flag is opt-in and forwarded automatically by the FE if the URL has `?demo=force-retry` in the query string.

## Verifying a proof yourself

For any `proof` returned from the API:

1. **Inference** — re-fetch the model output at `proof.proposal.inference.providerUrl`, hash inputs/outputs, check signature against `proof.proposal.inference.signer`.
2. **Verdict** — recompute the rules from `proof.verdict.rules`, verify the verdict signer.
3. **Execution** — `eth_getTransactionReceipt(proof.exec.txHash)` against Sepolia, parse Transfer logs.
4. **KeeperHub** — open `proof.keeperhubReceipts[i].auditTrailUrl` (independent record of broadcast + attempts).
5. **Binding** — recompute `keccak(h(proposal) ‖ h(verdict) ‖ h(exec) ‖ h(keeperhubReceipts))`; it must equal `proof.rootHash`.
6. **Anchor** — `eth_getTransactionByHash(proof.anchorTx)` on 0G Galileo; the calldata contains `proof.rootHash`.

If any step fails, the trade did not happen the way the agent says it did.

## Testnets only

AgentVault is hard-coded to Ethereum Sepolia (`chainId 11155111`) and 0G Galileo (`chainId 16602`). Mainnet chainIds are rejected at the chain-guard layer of every package — you cannot accidentally run this against funds you care about.

- KeeperHub client refuses construction with any `chainId` ≠ 11155111.
- Exec adapter refuses construction with any `EXEC_CHAIN_ID` ≠ 11155111 in `keeperhub` mode.
- The `/config` route exposes the active `chainId` so the frontend can warn before you connect.

## Status

**Phase 1 (current):** chat → plan → confirm → propose → approve → swap (mock | real | keeperhub) → proof anchored on 0G; FE Proof Explorer shows full chain.

**Phase 2 (deferred):** specialist swarm, ledger-backed dailyCap/cooldown, KeeperHub workflows for x402 + private routing.

See [`backend/README.md`](./backend/README.md) for the canonical "Phase 1 done" criteria and the full failure-semantics matrix.

## Hackathon submission

AgentVault is submitted to **[ETHGlobal Open Agents 2026](https://ethglobal.com/events/openagents/prizes)** across three tracks. The same codebase, demo, and proof artifacts back all three.

### 🏆 Tracks targeted

#### 0G — *Best Autonomous Agents, Swarms & iNFT Innovations* (up to $1,500)

> "Personal *Digital Twin* agent that learns from user behavior and maintains evolving persistent memory via 0G Storage (KV for real-time state + Log for conversation/history)" — and we add: with self-fact-checking via verifiable 0G Compute inference.

**How AgentVault qualifies:**
- **0G Compute:** every LLM call goes through a 0G compute provider; provider URL, model id, prompt + output hashes, and timestamp are signed by our backend signer and embedded in `Proof.proposal.inference` and `Proof.verdict.sanityInference`.
- **0G Storage KV:** sessions, proposals, verdicts, proofs, and per-user portfolio state all live in 0G KV (see `backend/packages/memory/src/kv.ts`). No external DB.
- **0G Storage Log:** every verdict and assembled proof is appended to an immutable Log (see `backend/packages/memory/src/log.ts`); the returned `rootHash` becomes our `logCid`.
- **0G Chain:** the 4-leaf rootHash is anchored on 0G Galileo via `ProofAnchor.sol` ([`contracts/`](./contracts/)). The anchor tx hash is part of every proof.
- **Self-fact-checking:** the same proposal is re-inferred under a different system prompt as a sanity check; the verdict signer evaluates rule pass/fail and signs the result. Both inferences (proposal + sanity) are bound into rootHash.
- **Persistent memory across sessions:** the user's signed `AgentSession` provides bounded delegation; portfolio state and proof history persist across logout via 0G KV keyed by user address.

#### 🦄 Uniswap Foundation — *Best Uniswap API Integration* ($1,000–$2,500)

> "Build the future of agentic finance with Uniswap. Integrate the Uniswap API to give your agent the ability to swap and settle value onchain with transparency, composability, and real execution."

**How AgentVault qualifies:**
- **Real execution on Sepolia:** every approved trade hits a real Universal Router via the Uniswap Trade API (`/check_approval`, `/quote` with Permit2, `/swap`).
- **Transparent + composable:** the calldata returned by `/swap` is decoded, re-routed through KeeperHub, and the entire swap lifecycle (jobIds, attempts, tx hashes, gas) is bound into a verifiable `Proof`.
- **Agentic:** the trade originates from a 0G-Compute LLM call, is bounded by a user-signed `AgentSession` (no manual signature per trade after the initial allowance + session sign), and produces a public verifiable record.
- **Required `FEEDBACK.md`:** see [`FEEDBACK.md`](./FEEDBACK.md) — Section 1 covers Uniswap Trade API DX (`EIP712Domain` ergonomics, swap-intent format requests, idempotency suggestions, etc.).

#### 💚 KeeperHub — *Best Use of KeeperHub* ($500–$2,500)

> "Show us something we haven't seen before. Use KeeperHub's execution layer in a way that solves a real problem."

**How AgentVault qualifies:**
- **Both onchain writes go through KeeperHub:** Permit2 approval (`ERC20.approve`) and Universal Router execute (`execute(bytes,bytes[],uint256)`) are submitted via `POST /api/execute/contract-call` and tracked via `GET /api/execute/{id}/status`. We don't just sprinkle KH on a single tx — every gas-bearing step is on KH.
- **Cryptographic binding to KH:** receipts (`jobId`, `attempts`, `auditTrailUrl`, `finalTxHash`) are hashed as the **4th leaf** of the proof rootHash:
  ```
  rootHash = keccak( h(proposal) ‖ h(verdict) ‖ h(exec) ‖ h(keeperhubReceipts) )
  ```
  This is novel: most "uses KH" submissions surface KH as a URL; we bake KH's independent execution log into the cryptographic proof itself.
- **Real retry demo via gas underestimation:** `?demo=force-retry` sets `gasLimitMultiplier='0.85'` so the first attempt out-of-gas-reverts and KH's retry policy bumps it on attempt 2. The audit trail and the proof both show `attempts ≥ 2` — no client-side simulation.
- **Live SSE sub-progress:** dual-mode `/approve` (JSON or SSE). The frontend renders a 4-step progress strip (POLICY → SUBMIT → BROADCAST → CONFIRM) driven by stages emitted from the KH adapter at every lifecycle transition.
- **LIVE pill in TopBar:** the FE detects when `executionLayer=keeperhub` from `/config` and renders `KEEPERHUB · SEPOLIA · LIVE` with a green dot.
- **Sepolia chain-guard:** the KH client refuses construction on any chainId ≠ 11155111. AgentVault cannot accidentally point KH at mainnet.

#### 🔍 KeeperHub — *Builder Feedback Bounty* ($250)

Honest, specific, actionable feedback covering UX friction, a P0 documentation defect (auth header), retry-policy opacity, missing log decoding, and concrete feature requests (SSE status, raw calldata mode, batch submission). See [`FEEDBACK.md`](./FEEDBACK.md) → Section 2.

### Deployments

| Component | Network | Address / hash |
| --- | --- | --- |
| `ProofAnchor.sol` | 0G Galileo (chainId `16602`) | _TBD — deploy from `contracts/` and paste here_ |
| KeeperHub Turnkey wallet | Ethereum Sepolia (chainId `11155111`) | _TBD — copy from `app.keeperhub.com` Settings → Wallets_ |
| Backend delegate signer | Ethereum Sepolia (chainId `11155111`) | _TBD — derived from `SEPOLIA_PRIVATE_KEY`_ |


### Protocols / SDKs used

- **0G** — `@0gfoundation/0g-ts-sdk` (Storage KV + Log), 0G Compute REST, 0G Galileo chain (anchor).
- **Uniswap Foundation** — Trade API (`/check_approval`, `/quote`, `/swap`) on Sepolia v2 Universal Router.
- **KeeperHub** — Direct Execution REST API (`/api/execute/contract-call`, `/api/execute/{id}/status`); X-API-Key auth; `network: sepolia`.
- **Hono** + **viem/ethers** + **Zod** — backend HTTP, chain interop, schema validation.
- **Next.js** + **wagmi** + **rainbowkit** + **framer-motion** — frontend.
- **Foundry** — `ProofAnchor.sol`.

## License

MIT.
