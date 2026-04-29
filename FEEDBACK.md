# Builder feedback — Uniswap Foundation + KeeperHub

> Honest, specific feedback from building AgentVault during ETHGlobal Open Agents.
> This file satisfies the **Uniswap Foundation** prize requirement (`FEEDBACK.md` in repo root) and is also submitted for the **KeeperHub Builder Feedback Bounty**.
>
> Project: **AgentVault — ProofTwin** · Repo: this repo · Stack: Hono / TS monorepo, Sepolia, 0G Galileo, Uniswap v3, KeeperHub Direct Execution.

---

## Section 1 — Uniswap Foundation Developer Platform

### What we used

- `POST /v1/check_approval` — to know whether to issue a Permit2 approval before quoting.
- `POST /v1/quote` — for `quote` + `permitData` (EIP-712 typed data we sign with our delegate wallet).
- `POST /v1/swap` — to obtain Universal Router calldata.
- `x-universal-router-version: 2.0` header to lock to UR v2 on Sepolia.

### What worked well

1. **End-to-end coverage with one API.** `/check_approval` → `/quote` → `/swap` is genuinely all you need to swap an ERC-20 pair. We didn't have to touch the SDK, build router-input encoders, or decode commands at all (until we had to re-route through KeeperHub — see below).
2. **Permit2 ergonomics.** Returning `permitData` with `domain`, `types`, `values` ready to feed into `wallet.signTypedData(...)` is excellent; the sign-and-pass-back loop is genuinely 6 lines of code.
3. **Sepolia parity.** UR v2 + Permit2 on Sepolia worked first try once `chainId: 11155111` was passed. Many testnets are second-class citizens; this was not.

### Friction we hit (concrete, time-costing)

1. **`EIP712Domain` key in `permitData.types` breaks ethers v6.**
   - `wallet.signTypedData(domain, types, values)` from ethers v6 throws if `types` contains `EIP712Domain` (it derives the domain separately).
   - The `/quote` response includes `EIP712Domain` in `permitData.types`, so naive code crashes with a confusing error.
   - **Fix in our code:** [`backend/packages/exec/src/keeperhub.ts`](backend/packages/exec/src/keeperhub.ts) explicitly deletes `filtered.EIP712Domain` before signing.
   - **Suggestion:** either (a) document this in the `/quote` reference page next to `permitData`, or (b) omit `EIP712Domain` from the response since it can be reconstructed from `domain`.

2. **No structured "swap intent" alongside the calldata.**
   - `/swap` returns Universal Router calldata as opaque bytes. To route the broadcast through a third-party execution layer (KeeperHub, Gelato, etc.) you have to ABI-decode `execute(bytes commands, bytes[] inputs, uint256 deadline)` yourself just to forward the args.
   - **Suggestion:** an opt-in `format=intent` flag on `/swap` that returns
     ```json
     {
       "transaction": { ... },
       "intent": {
         "router": "...",
         "functionSignature": "execute(bytes,bytes[],uint256)",
         "args": ["0x...", ["0x..."], "1735689600"]
       }
     }
     ```
     would let downstream agents skip the local ABI decode entirely.

3. **`transaction` vs `swap` envelope inconsistency.**
   - On some response paths the swap calldata is at `response.transaction`, on others at `response.swap`. We had to fall back across both keys.
   - **Suggestion:** stabilize on one shape; if both must exist, document the distinction (different UR versions? different approval states?).

4. **Universal Router version selection is implicit.**
   - The `x-universal-router-version` header (1.2 vs 2.0) silently changes which router address `/swap` returns. We discovered this only by reading the [`universal-router/deploy-addresses/sepolia.json`](https://raw.githubusercontent.com/Uniswap/universal-router/main/deploy-addresses/sepolia.json).
   - **Suggestion:** include the chosen UR address + version in the `/swap` response body so callers don't have to maintain a per-chain address table.

5. **No idempotency or `requestId` echo for retries.**
   - `/swap` does include `requestId`, but it's not idempotent on retries — we got fresh calldata + a fresh permit deadline each time.
   - **Suggestion:** treat `requestId` as an idempotency key and return cached calldata for, say, 30s.

6. **No partial failure mode for `/check_approval`.**
   - The endpoint is binary: returns an `approval` object or `null`. It doesn't say *why* (existing allowance below threshold? Permit2 used? token blacklisted?).
   - **Suggestion:** include `{ reason: 'allowance_below', current: '...', required: '...' }` so callers can show the user a meaningful nudge ("you have $50 USDC approved, need $100").

### Things we wish existed

- **GET /v1/health/{chainId}** — a single endpoint that confirms quote service + router contract are warm. We currently `try {} catch {}` on the first `/quote` call to detect outages.
- **Webhook on quote staleness.** Quotes go stale on the order of seconds; a websocket subscription to "this `quote.id` is now invalid" would let an agent re-quote before submitting.
- **Per-chain testnet faucet hints in error responses.** When the delegate wallet is missing the input token, the swap fails on-chain; surfacing "balance < amountIn for `<token>` on chainId 11155111; faucet at <url>" in `/swap` would shave 10 minutes off every dev cycle.

### DX summary

We shipped a Sepolia-live swap flow in roughly 2 hours of integration time. The pain points above cost maybe 45 minutes total — small in absolute terms, but 100% of them were undocumented edge cases.

---

## Section 2 — KeeperHub

### What we used

- `POST /api/execute/contract-call` for **two** distinct flows in the same trade:
  - Permit2 `ERC20.approve(spender, amount)` (we ABI-decode the Trade API's approval tx, then re-route).
  - Universal Router `execute(bytes,bytes[],uint256)` (decoded from the Trade API swap response).
- `GET /api/execute/{executionId}/status` for polling.
- `gasLimitMultiplier` to demonstrate retry-on-out-of-gas (our `?demo=force-retry` path uses `'0.85'`).

### What worked well

1. **Single endpoint, two transports.** `/api/execute/contract-call` cleanly handles arbitrary contract calls. We routed both an ERC-20 `approve` and a Universal Router `execute` through the same endpoint with no special-casing on the KH side.
2. **Audit trail URL is gold for verifiers.** `https://app.keeperhub.com/executions/{id}` is exactly the kind of independent attestation an audit story needs.
3. **Sepolia just works.** `network: 'sepolia'` + chainId 11155111 + funded Turnkey wallet = first-try success on a real swap.

### Friction we hit (concrete, time-costing)

#### 🔴 P0 documentation defect: auth header

- Our initial implementation set `Authorization: Bearer ${apiKey}` because that's the universal default for SaaS APIs. Our tests passed because we mocked the header. Live calls would have 401'd in the demo.
- The correct header per docs is **`X-API-Key`**. We caught this 30 minutes before demo by re-reading `/api/authentication`.
- **Suggestion:**
  1. Reject `Authorization: Bearer` with a 401 body that says *"Use X-API-Key instead — see /api/authentication"*. Most SDKs will surface that error message verbatim.
  2. Add the auth-header convention to the **first paragraph** of every endpoint reference page (currently it's only in `/api/authentication`).
  3. Add a `curl` cheat sheet at the top of each endpoint with the correct header — saves a second tab.

#### 🟠 Direct Execution retry policy is opaque

- We chose `gasLimitMultiplier: '0.85'` to demonstrate a real KH retry. We have *no idea* whether KH will retry an out-of-gas revert with a bumped multiplier, or if "retries" only kick in on transient RPC failures.
- The docs at [`/api/direct-execution`](https://docs.keeperhub.com/api/direct-execution) say "retries on revert" but don't enumerate which revert reasons trigger which retry behavior.
- **Suggestion:** publish a table:
  | Failure mode | Retried? | Modification |
  | --- | --- | --- |
  | RPC `connection refused` | yes | none, exponential backoff |
  | tx revert with `out of gas` | yes | gas multiplier × 1.5 |
  | tx revert with `STF` (slippage) | no | hard fail |
  | tx revert with custom error | depends? | — |

#### 🟠 No streaming status — clients must poll

- We had to build a polling loop ([`awaitJob`](backend/packages/keeperhub/src/index.ts)) with exponential backoff (1.5s → 4s) because there's no push channel.
- For a frontend that wants live progress (we built one — see `frontend/components/chat/ApprovalPrompt.tsx`'s 4-step strip), this means:
  - Client polls KH status — adds 1.5–4s latency to every stage transition.
  - Client polls every job ID separately even when many ship together.
- **Suggestion:** `GET /api/execute/{id}/events` as Server-Sent Events emitting `submitted`, `broadcast`, `confirming`, `completed|failed`. Or a webhook callback URL on `submitJob`.

#### 🟠 Status response missing decoded logs

- `GET /api/execute/{id}/status` returns `transactionHash` and `gasUsedWei` but not the receipt's `logs` array.
- For a swap, we still had to `eth_getTransactionReceipt` against our own RPC to parse `Transfer(to, amount)` and surface `amountOut`.
- **Suggestion:** include the raw `logs` (or even decoded events for known ABIs) in the status response so single-tenant agents don't need to maintain RPC infra.

#### 🟡 Audit trail URL not in API response

- We construct `{dashboardUrl}/executions/{executionId}` ourselves. If this URL pattern ever changes, every integration breaks silently.
- **Suggestion:** add `auditTrailUrl: string` to the status + submit responses as a first-class field.

#### 🟡 No way to forward raw calldata directly

- For our use case (Uniswap), we already had Universal Router calldata as bytes. We had to:
  1. Decode `execute(bytes,bytes[],uint256)` to extract `commands`, `inputs`, `deadline`.
  2. Re-serialize as `functionArgs` JSON.
  3. Pass the function ABI to KH so KH can re-encode.
- That's two rounds of encoding/decoding for no semantic gain.
- **Suggestion:** add a `rawCalldata` field on the contract-call request:
  ```json
  {
    "contractAddress": "...",
    "rawCalldata": "0x3593564c...",
    "value": "0",
    "network": "sepolia"
  }
  ```
  KH can ignore the `functionName`/`abi` plumbing in this mode and just broadcast the bytes.

#### 🟡 `/api/chains` doesn't list 0G Galileo

- We wanted to anchor proofs through KH on 0G chain (chainId 16602). Not in the chains list, so we kept anchoring direct via ethers.
- **Suggestion:** if 0G is in the roadmap, even an "unsupported but known" entry would help us plan integrations. Currently we have to discover unsupported chains via 400 responses.

#### 🟡 `functionArgs` serialisation is JSON-as-string

- `functionArgs: "[\"0x...\", \"500000000\"]"` (a stringified JSON array inside a JSON object) is unusual. Most APIs would just take a JSON array.
- **Suggestion:** accept either form. Or rename the field to make the type obvious — `functionArgsJson`.

### Things we wish existed

- **MCP tool for "submit + wait until confirmed".** The MCP server exposes individual primitives; a single `kh.executeAndWait(contractCall, options) → JobResult` tool would let LLM agents one-shot a trade.
- **Sandbox mode with simulated reverts.** We needed real Sepolia gas to demo retry behavior. A `network: 'simulated'` mode that fakes `out_of_gas → success-on-retry` would speed up demos and CI.
- **`x402` quickstart with a published USDC-priced workflow template.** The docs describe x402 but there's no copy-pasteable example workflow ID. We deferred x402 from our submission for this reason.
- **Bulk submission.** `POST /api/execute/batch` with multiple contract calls + dependency edges. For our flow (approve → swap), submitting both at once with "swap depends on approval success" semantics would replace ~80 lines of orchestration code in `keeperhubAdapter`.

### DX summary

KeeperHub Direct Execution is the right primitive at the right level of abstraction — agents care about *guaranteed broadcast*, not *RPC plumbing*. The integration shipped in ~3 hours.

The single P0 issue (`Authorization: Bearer` vs `X-API-Key`) cost roughly 30 minutes to discover and would have killed our demo if we hadn't caught it. Everything else listed above is polish; the auth-header docs gap is the one fix that has outsized ROI.

---

## Project + contact

- **Project:** AgentVault (ProofTwin)
- **Repo:** this repository
- **Demo:** see root [`README.md`](./README.md) for live URLs and video link
- **Contact:** see [`README.md` → Team](./README.md#team)

Happy to discuss any of the above — every observation here came from a real keystroke during build, not after-the-fact theorizing.
