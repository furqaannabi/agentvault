# 0G Compute Setup (one-time per dev)

0G Compute uses an OpenAI-compatible API but requires per-provider escrow funded
via the `0g-compute-cli`. Run this once to get a working `ZG_COMPUTE_*` env block.

## Prerequisites

- Node 20+
- 0G Galileo testnet wallet funded via https://faucet.0g.ai (0.1 0G/day)
- `ZG_PRIVATE_KEY` in your shell

## 1. Install CLI

```bash
npm install -g @0glabs/0g-serving-broker
0g-compute-cli --help
```

## 2. Setup network

```bash
0g-compute-cli setup-network
```

Picks Galileo by default. Confirms RPC + chainId.

## 3. Login

```bash
0g-compute-cli login --private-key $ZG_PRIVATE_KEY
```

Stores key locally (encrypted) so subsequent commands don't need `--private-key`.

## 4. Deposit + fund a provider

List available providers:

```bash
0g-compute-cli providers list
```

Pick one. Save its address as `$PROVIDER`.

Deposit OG into the broker, then transfer to the provider:

```bash
0g-compute-cli deposit --amount 0.05
0g-compute-cli transfer-fund --provider $PROVIDER --amount 0.05
```

## 5. Acknowledge provider + fetch API key

```bash
0g-compute-cli inference acknowledge-provider --provider $PROVIDER
0g-compute-cli inference get-secret --provider $PROVIDER
```

Output gives:
- `api-key` (e.g. `app-sk-XXXXX...`)
- `base-url` (e.g. `https://<provider>/v1/proxy`)
- `model` (e.g. `llama-3.1-70b-instruct`)

## 6. Paste into `.env`

```
ZG_COMPUTE_BASE_URL=<base-url from step 5>
ZG_COMPUTE_API_KEY=<api-key from step 5>
ZG_COMPUTE_MODEL=<model from step 5>
ZG_COMPUTE_PROVIDER_ADDR=$PROVIDER
```

## 7. Verify

```bash
curl -X POST $ZG_COMPUTE_BASE_URL/chat/completions \
  -H "Authorization: Bearer $ZG_COMPUTE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"'"$ZG_COMPUTE_MODEL"'","messages":[{"role":"user","content":"ping"}]}'
```

Expect a normal OpenAI-shaped response.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `insufficient escrow` | Re-run `transfer-fund` with larger amount |
| `provider not acknowledged` | Run `acknowledge-provider` again |
| `api key invalid` | Re-fetch via `get-secret` |
| `deposit reverts` | Check faucet balance; need ~0.06 OG free |

## Note on attestation

0G Compute returns plain OpenAI-shaped JSON. **No provider signature in response.**
The backend's `@agentvault/twin` package signs `(providerUrl, modelId, promptHash, outputHash, ts)` itself — see `attest.ts`. This is the "verifiable inference" record stored in every Proof.
