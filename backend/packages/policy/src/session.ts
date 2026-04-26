import type { AgentSession, Hex, SignedSession } from '@agentvault/types';
import { ethers } from 'ethers';

export const EIP712_DOMAIN_NAME = 'AgentVault';
export const EIP712_DOMAIN_VERSION = '1';

export const EIP712_TYPES = {
  AgentSession: [
    { name: 'user', type: 'address' },
    { name: 'delegate', type: 'address' },
    { name: 'chainId', type: 'uint256' },
    { name: 'allowedTokens', type: 'address[]' },
    { name: 'maxDailyVolumeUsd', type: 'uint256' },
    { name: 'maxTradeUsd', type: 'uint256' },
    { name: 'maxSlippageBps', type: 'uint256' },
    { name: 'cooldownSec', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

export interface SessionVerifierConfig {
  delegate: Hex;
  chainId: number;
  now?: () => number;
  isRevoked?: (nonce: Hex) => boolean;
}

export function eip712Domain(chainId: number): {
  name: string;
  version: string;
  chainId: number;
} {
  return {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId,
  };
}

export function sessionHash(signed: SignedSession): Hex {
  return ethers.TypedDataEncoder.hash(
    eip712Domain(signed.session.chainId),
    EIP712_TYPES as unknown as Record<string, ethers.TypedDataField[]>,
    signed.session,
  ) as Hex;
}

export class SessionError extends Error {
  constructor(
    public code:
      | 'bad_signature'
      | 'expired'
      | 'wrong_delegate'
      | 'wrong_chain'
      | 'revoked',
    msg: string,
  ) {
    super(`${code}: ${msg}`);
    this.name = 'SessionError';
  }
}

export function verifySession(signed: SignedSession, cfg: SessionVerifierConfig): void {
  const { session, signature } = signed;
  if (session.chainId !== cfg.chainId) {
    throw new SessionError('wrong_chain', `chainId mismatch: ${session.chainId} != ${cfg.chainId}`);
  }
  if (session.delegate.toLowerCase() !== cfg.delegate.toLowerCase()) {
    throw new SessionError('wrong_delegate', `delegate mismatch: ${session.delegate} != ${cfg.delegate}`);
  }
  const now = (cfg.now ?? (() => Math.floor(Date.now() / 1000)))();
  if (session.expiresAt <= now) {
    throw new SessionError('expired', `session expired at ${session.expiresAt}, now ${now}`);
  }
  if (cfg.isRevoked?.(session.nonce)) {
    throw new SessionError('revoked', `session nonce revoked: ${session.nonce}`);
  }
  const recovered = ethers.verifyTypedData(
    eip712Domain(session.chainId),
    EIP712_TYPES as unknown as Record<string, ethers.TypedDataField[]>,
    session,
    signature,
  );
  if (recovered.toLowerCase() !== session.user.toLowerCase()) {
    throw new SessionError('bad_signature', `recovered ${recovered} != user ${session.user}`);
  }
}

export async function signSession(
  signer: ethers.Signer,
  session: AgentSession,
): Promise<SignedSession> {
  const signature = (await signer.signTypedData(
    eip712Domain(session.chainId),
    EIP712_TYPES as unknown as Record<string, ethers.TypedDataField[]>,
    session,
  )) as Hex;
  return { session, signature };
}
