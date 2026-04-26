import type { Memory } from '@agentvault/memory';
import { signSession } from '@agentvault/policy';
import type { AnchorClient } from '@agentvault/proof';
import type { ComputeClient } from '@agentvault/twin';
import type {
  AgentSession,
  ConvoState,
  Hex,
  PortfolioState,
  Proof,
  SignedSession,
  TradeProposal,
} from '@agentvault/types';
import { ethers } from 'ethers';

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
    async getProposal(user, id) {
      return proposal.get(`${user.toLowerCase()}:${id}`) ?? null;
    },
    async setProposal(p) {
      proposal.set(`${p.userId.toLowerCase()}:${p.id}`, p);
    },
    async getProof(user, id) {
      return proof.get(`${user.toLowerCase()}:${id}`) ?? null;
    },
    async setProof(p) {
      proof.set(`${p.proposal.userId.toLowerCase()}:${p.proposalId}`, p);
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

export const TEST_USER_KEY = ('0x' + 'b'.repeat(64)) as Hex;
export const TEST_DELEGATE_KEY = ('0x' + 'a'.repeat(64)) as Hex;
export const TEST_CHAIN_ID = 84532;

export function testUserAddr(): Hex {
  return new ethers.Wallet(TEST_USER_KEY).address as Hex;
}
export function testDelegateAddr(): Hex {
  return new ethers.Wallet(TEST_DELEGATE_KEY).address as Hex;
}

export async function fakeSignedSession(
  overrides: Partial<AgentSession> = {},
): Promise<SignedSession> {
  const userWallet = new ethers.Wallet(TEST_USER_KEY);
  const session: AgentSession = {
    user: userWallet.address as Hex,
    delegate: testDelegateAddr(),
    chainId: TEST_CHAIN_ID,
    allowedTokens: [
      '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Hex,
      '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as Hex,
    ],
    maxDailyVolumeUsd: 5000,
    maxTradeUsd: 1000,
    maxSlippageBps: 100,
    cooldownSec: 30,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    nonce: ('0x' + '11'.repeat(32)) as Hex,
    ...overrides,
  };
  return signSession(userWallet, session);
}

export function sessionHeader(signed: SignedSession): string {
  return `Session ${Buffer.from(JSON.stringify(signed)).toString('base64')}`;
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
