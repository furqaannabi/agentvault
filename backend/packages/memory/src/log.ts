import { MemData } from '@0glabs/0g-ts-sdk';
import type { ZgClients } from './clients.js';

const enc = new TextEncoder();

export interface LogAppendResult {
  rootHash: string;
  txHash: string;
}

export async function logAppend<T>(z: ZgClients, payload: T): Promise<LogAppendResult> {
  const json = JSON.stringify(payload);
  const data = new MemData(enc.encode(json));
  // @ts-expect-error ethers ESM/CJS dual-package hazard: SDK bundled types reference different ethers instance
  const [tx, err] = await z.indexer.upload(data, z.cfg.rpcUrl, z.signer, {
    tags: '0x',
    finalityRequired: false,
    taskSize: 1,
    expectedReplica: 1,
    skipTx: false,
    fee: 10_000_000_000_000_000n,
  });
  if (err !== null) throw new Error(`indexer.upload: ${String(err)}`);
  // SDK shape: single-file upload returns { rootHash, txHash }
  const t = tx as { rootHash?: string; txHash?: string };
  if (!t.rootHash || !t.txHash) {
    throw new Error('indexer.upload: missing rootHash/txHash in response');
  }
  return { rootHash: t.rootHash, txHash: t.txHash };
}

export async function logRead<T>(z: ZgClients, rootHash: string): Promise<T> {
  const url = `${z.cfg.indexerEndpoint.replace(/\/$/, '')}/file?root=${rootHash}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`logRead http ${res.status}`);
  const text = await res.text();
  return JSON.parse(text) as T;
}
