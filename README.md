# Agent Vault - The Cryptographically Verifiable AI Agent 

<img width="1377" height="1366" alt="image" src="https://github.com/user-attachments/assets/64323951-cb2b-4872-9943-880349380f0f" />

<br></br>

**AI portfolio manager with cryptographic receipts. Every trade signed, logged, auditable trust math, not promises**
<br></br>


<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/94905d5e-6988-4e2c-bafa-9dd9629bec99" />

You chat. It trades. Every decision leaves a cryptographic receipt — *who reasoned, who approved, who broadcast, what landed onchain*.

No screenshots. No "trust me." Just proofs.

<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/7ca7582b-5143-4c7d-9212-941b176fa934" />


## Why this matters

Most AI agent demos are black boxes. You see a chat reply and a green checkmark, and you're supposed to believe the trade went through the way the agent says it did.

AgentVault flips that. Every trade produces a public, independently checkable record:

- **The AI's reasoning is signed** — model, prompt, output, all hashed and signed by the backend.
- **The policy that approved it is signed** — the rules you delegated, the verdict, the signer.
- **The onchain execution is real** — actual Universal Router swap on Sepolia, actual receipts.
- **The broadcast is auditable** — KeeperHub's independent log of attempts, retries, gas bumps.
- **All four are bound together** — one rootHash anchored on 0G Galileo. Tamper with any leaf, the root breaks.

If the agent lies, the math says so.

<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/014d90a2-0b9d-4fe6-abf4-cf8ba873469b" />


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


## Deployed contracts

| Contract | Network | Address | Deploy tx |
| --- | --- | --- | --- |
| `ProofAnchor` | 0G Galileo (`16602`) | [`0x524479ef093a9dfa6fb29f09527208ea8657a7d7`](https://chainscan-galileo.0g.ai/address/0x524479ef093a9dfa6fb29f09527208ea8657a7d7) | [`0xa67f984b…7357312d`](https://chainscan-galileo.0g.ai/tx/0xa67f984b101d7492e06a7e607039679c6c617051c78c73fa166d0b2d7357312d) |

---

## Testnets only

Hard-coded to Ethereum Sepolia (`11155111`) and 0G Galileo (`16602`). Mainnet chainIds rejected at the chain-guard layer of every package. You cannot accidentally point this at funds you care about.

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

