import type { AgentSession, Hex } from '@agentvault/types';
import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';
import { SessionError, signSession, verifySession } from '../src/session.js';

const USER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const DELEGATE_KEY = '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba';

function buildSession(overrides: Partial<AgentSession> = {}): AgentSession {
  const user = new ethers.Wallet(USER_KEY).address as Hex;
  const delegate = new ethers.Wallet(DELEGATE_KEY).address as Hex;
  return {
    user,
    delegate,
    chainId: 84532,
    allowedTokens: ['0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Hex],
    maxDailyVolumeUsd: 5000,
    maxTradeUsd: 1000,
    maxSlippageBps: 200,
    cooldownSec: 60,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    nonce: ('0x' + '11'.repeat(32)) as Hex,
    ...overrides,
  };
}

describe('verifySession', () => {
  it('accepts a well-formed signed session', async () => {
    const userWallet = new ethers.Wallet(USER_KEY);
    const session = buildSession();
    const signed = await signSession(userWallet, session);
    expect(() =>
      verifySession(signed, { delegate: session.delegate, chainId: session.chainId }),
    ).not.toThrow();
  });

  it('rejects expired session', async () => {
    const userWallet = new ethers.Wallet(USER_KEY);
    const session = buildSession({ expiresAt: Math.floor(Date.now() / 1000) - 10 });
    const signed = await signSession(userWallet, session);
    expect(() =>
      verifySession(signed, { delegate: session.delegate, chainId: session.chainId }),
    ).toThrow(SessionError);
  });

  it('rejects wrong delegate', async () => {
    const userWallet = new ethers.Wallet(USER_KEY);
    const session = buildSession();
    const signed = await signSession(userWallet, session);
    expect(() =>
      verifySession(signed, {
        delegate: ('0x' + '00'.repeat(20)) as Hex,
        chainId: session.chainId,
      }),
    ).toThrow(/wrong_delegate/);
  });

  it('rejects wrong chain', async () => {
    const userWallet = new ethers.Wallet(USER_KEY);
    const session = buildSession();
    const signed = await signSession(userWallet, session);
    expect(() =>
      verifySession(signed, { delegate: session.delegate, chainId: 1 }),
    ).toThrow(/wrong_chain/);
  });

  it('rejects bad signature (signed by other key)', async () => {
    const otherWallet = new ethers.Wallet(DELEGATE_KEY);
    const session = buildSession();
    const signed = await signSession(otherWallet, session);
    expect(() =>
      verifySession(signed, { delegate: session.delegate, chainId: session.chainId }),
    ).toThrow(/bad_signature/);
  });

  it('rejects revoked nonce', async () => {
    const userWallet = new ethers.Wallet(USER_KEY);
    const session = buildSession();
    const signed = await signSession(userWallet, session);
    expect(() =>
      verifySession(signed, {
        delegate: session.delegate,
        chainId: session.chainId,
        isRevoked: (n) => n === session.nonce,
      }),
    ).toThrow(/revoked/);
  });
});
