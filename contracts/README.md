# AgentVault Contracts

Foundry project. Deployed on 0G Galileo testnet (chainId 16602).

## Contracts

| Contract | Purpose |
|---|---|
| `ProofAnchor.sol` | Records `keccak256` root of off-chain Proof + Storage Log CID. One-shot per root. |

## Setup (one-time)

```bash
forge install foundry-rs/forge-std --no-commit
```

## Build + test

```bash
forge build
forge test -vvv
```

## Deploy to 0G Galileo

1. Copy `.env.example` → `.env` and fill `ZG_PRIVATE_KEY`
2. Fund wallet via https://faucet.0g.ai (0.1 0G/day)
3. Deploy:

```bash
source .env
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $ZG_RPC_URL \
  --private-key $ZG_PRIVATE_KEY \
  --broadcast \
  --legacy
```

4. Copy deployed address from output → paste into `backend/.env` as `PROOF_ANCHOR_ADDRESS`.

## Read path

```solidity
ProofAnchor a = ProofAnchor(0x...);
bool ok = a.isAnchored(rootHash);
uint256 blk = a.anchoredAt(rootHash);
string memory cid = a.anchoredCid(rootHash);
```

## ABI export for backend

After `forge build`, ABI is at `out/ProofAnchor.sol/ProofAnchor.json`. Backend `proof` package imports the function selectors via ethers Contract from this JSON (or hardcoded subset).
