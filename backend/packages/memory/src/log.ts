import { type Indexer, MemData } from '@0gfoundation/0g-ts-sdk';
import type { ZgClients } from './clients.js';

const enc = new TextEncoder();

// Same headroom as KV writes: turbo's pricePerSector drifts cause require(false).
const LOG_FEE_WEI = 50_000_000_000_000_000n;

export interface LogAppendResult {
  rootHash: string;
  txHash: string;
}

async function uploadOnce(indexer: Indexer, z: ZgClients, data: MemData): Promise<LogAppendResult> {
  const [tx, err] = await indexer.upload(data, z.cfg.rpcUrl, z.signer, {
    tags: '0x',
    finalityRequired: false,
    taskSize: 1,
    expectedReplica: 1,
    skipTx: false,
    fee: LOG_FEE_WEI,
  });
  if (err !== null) throw new Error(`indexer.upload: ${String(err)}`);
  const t = tx as { rootHash?: string; txHash?: string };
  if (!t.rootHash || !t.txHash) {
    throw new Error('indexer.upload: missing rootHash/txHash in response');
  }
  return { rootHash: t.rootHash, txHash: t.txHash };
}

export async function logAppend<T>(z: ZgClients, payload: T): Promise<LogAppendResult> {
  const json = JSON.stringify(payload);
  const data = new MemData(enc.encode(json));
  try {
    return await uploadOnce(z.indexer, z, data);
  } catch (e) {
    if (!z.indexerFallback) throw e;
    console.warn(
      `[log] primary indexer failed (${(e as Error).message.slice(0, 120)}); retrying on standard fallback`,
    );
    return await uploadOnce(z.indexerFallback, z, data);
  }
}

export async function logRead<T>(z: ZgClients, rootHash: string): Promise<T> {
  const url = `${z.cfg.indexerEndpoint.replace(/\/$/, '')}/file?root=${rootHash}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`logRead http ${res.status}`);
  const text = await res.text();
  return JSON.parse(text) as T;
}
