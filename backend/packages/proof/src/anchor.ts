import type { Hex } from '@agentvault/types';
import { ethers } from 'ethers';
import type { ProofConfig } from './config.js';

const PROOF_ANCHOR_ABI = [
  'function anchorRoot(bytes32 root, string calldata logCid) external',
  'function anchoredAt(bytes32) view returns (uint256)',
  'function isAnchored(bytes32) view returns (bool)',
  'event Anchored(bytes32 indexed root, address indexed signer, string logCid, uint256 blockNumber)',
] as const;

export interface AnchorClient {
  anchor(root: Hex, logCid: string): Promise<{ txHash: Hex; blockNumber: number }>;
  isAnchored(root: Hex): Promise<boolean>;
  cfg: ProofConfig;
}

export function makeAnchorClient(cfg: ProofConfig): AnchorClient {
  const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
  const signer = new ethers.Wallet(cfg.privateKey, provider);
  // ethers v6 Contract returns a Proxy with dynamic ABI methods; cast to typed interface.
  const contract = new ethers.Contract(cfg.proofAnchorAddress, PROOF_ANCHOR_ABI, signer) as ethers.Contract & {
    anchorRoot(root: Hex, logCid: string): Promise<ethers.ContractTransactionResponse>;
    isAnchored(root: Hex): Promise<boolean>;
  };

  return {
    cfg,
    async anchor(root, logCid) {
      const tx = await contract.anchorRoot(root, logCid);
      const receipt = await tx.wait();
      if (!receipt) throw new Error('anchorRoot: no receipt');
      return {
        txHash: tx.hash as Hex,
        blockNumber: Number(receipt.blockNumber),
      };
    },
    async isAnchored(root) {
      return await contract.isAnchored(root);
    },
  };
}
