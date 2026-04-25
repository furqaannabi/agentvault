import type { Memory } from '@agentvault/memory';
import type { AnchorClient } from '@agentvault/proof';
import type { ComputeClient } from '@agentvault/twin';
import type { ConvoState, Hex, PortfolioState, Proof, TradeProposal } from '@agentvault/types';

export function fakeMemory(): Memory {
  const portfolio = new Map<string, PortfolioState>();
  const convo = new Map<string, ConvoState>();
  const proposal = new Map<string, TradeProposal>();
  const proof = new Map<string, Proof>();
  const log: { rootHash: string; payload: unknown }[] = [];

  return {
    async getPortfolio(userId) {
      return portfolio.get(userId) ?? null;
    },
    async setPortfolio(s) {
      portfolio.set(s.userId, s);
    },
    async getConvo(userId) {
      return convo.get(userId) ?? null;
    },
    async setConvo(s) {
      convo.set(s.userId, s);
    },
    async getProposal(id) {
      return proposal.get(id) ?? null;
    },
    async setProposal(p) {
      proposal.set(p.id, p);
    },
    async getProof(id) {
      return proof.get(id) ?? null;
    },
    async setProof(p) {
      proof.set(p.proposalId, p);
    },
    async appendLog(entry) {
      const rootHash = `cid_${log.length}`;
      log.push({ rootHash, payload: entry });
      return { rootHash, txHash: `0xlog${log.length}` };
    },
    async readLog<T>(rootHash: string): Promise<T> {
      const e = log.find((x) => x.rootHash === rootHash);
      if (!e) throw new Error('not found');
      return e.payload as T;
    },
  };
}

export function fakeComputeClient(scripted: { proposal: string; sanity: string }): ComputeClient {
  let n = 0;
  return {
    cfg: {
      privateKey: ('0x' + 'a'.repeat(64)) as Hex,
      computeBaseUrl: 'https://fake.compute/v1/proxy',
      computeApiKey: 'fake',
      computeModel: 'fake-model',
      computeProviderAddr: ('0x' + '1'.repeat(40)) as Hex,
    },
    async infer(_sys, _user) {
      n++;
      return n === 1 ? scripted.proposal : scripted.sanity;
    },
  };
}

export function fakeAnchorClient(): AnchorClient {
  const anchored = new Map<string, number>();
  return {
    cfg: {
      rpcUrl: 'https://fake.0g',
      privateKey: ('0x' + 'a'.repeat(64)) as Hex,
      proofAnchorAddress: ('0x' + '2'.repeat(40)) as Hex,
      chainId: 16602,
    },
    async anchor(root, _logCid) {
      const blockNumber = 1_000_000 + anchored.size;
      anchored.set(root, blockNumber);
      return { txHash: `0xanchor${anchored.size}` as Hex, blockNumber };
    },
    async isAnchored(root) {
      return anchored.has(root);
    },
  };
}
