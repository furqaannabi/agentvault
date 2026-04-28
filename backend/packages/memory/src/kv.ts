import { Batcher, type Indexer, getFlowContract } from '@0gfoundation/0g-ts-sdk';
import { ethers } from 'ethers';
import type { Hex } from '@agentvault/types';
import type { ZgClients } from './clients.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

// Generous storage fee well above market. Turbo testnet's quoted pricePerSector
// occasionally drifts above SDK's auto-calculated value, causing Flow.submit to
// require(false) on insufficient msg.value. 0.05 OG covers that headroom.
const KV_FEE_WEI = 50_000_000_000_000_000n;

const toBytes = (s: string): Uint8Array => enc.encode(s);
const fromBytes = (b: Uint8Array): string => dec.decode(b);

async function execOnce(
  indexer: Indexer,
  z: ZgClients,
  streamId: Hex,
  key: string,
  value: string,
): Promise<void> {
  const [nodes, selErr] = await indexer.selectNodes(1);
  if (selErr !== null) throw new Error(`selectNodes: ${String(selErr)}`);
  if (!nodes[0]) throw new Error('selectNodes: empty node list');
  // Auto-discover Flow contract from selected node so we follow whichever
  // contract this indexer (turbo vs standard) actually serves.
  const flowAddr =
    (await nodes[0].getStatus())?.networkIdentity?.flowAddress ?? z.cfg.flowContract;
  const flow = getFlowContract(flowAddr, z.signer);
  const batcher = new Batcher(1, nodes, flow, z.cfg.rpcUrl);
  batcher.streamDataBuilder.set(streamId, toBytes(key), toBytes(value));
  const [, batchErr] = await batcher.exec({
    tags: '0x',
    finalityRequired: true,
    taskSize: 1,
    expectedReplica: 1,
    skipTx: false,
    fee: KV_FEE_WEI,
  });
  if (batchErr !== null) throw new Error(`batcher.exec: ${String(batchErr)}`);
}

export async function kvSet(
  z: ZgClients,
  streamId: Hex,
  key: string,
  value: string,
): Promise<void> {
  try {
    await execOnce(z.indexer, z, streamId, key, value);
  } catch (e) {
    if (!z.indexerFallback) throw e;
    console.warn(
      `[kv] primary indexer failed (${(e as Error).message.slice(0, 120)}); retrying on standard fallback`,
    );
    await execOnce(z.indexerFallback, z, streamId, key, value);
  }
}

export async function kvGet(
  z: ZgClients,
  streamId: Hex,
  key: string,
): Promise<string | null> {
  const encodedKey = ethers.encodeBase64(toBytes(key));
  // SDK signature uses BytesLike; pass Hex string for streamId, base64 for key.
  // biome-ignore lint/suspicious/noExplicitAny: SDK type is overly strict for runtime usage
  const value: any = await z.kvRead.getValue(streamId as any, encodedKey as any);
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return fromBytes(value);
  if (value?.data) {
    return typeof value.data === 'string' ? value.data : fromBytes(value.data);
  }
  return null;
}

export async function kvSetJson<T>(
  z: ZgClients,
  streamId: Hex,
  key: string,
  obj: T,
): Promise<void> {
  await kvSet(z, streamId, key, JSON.stringify(obj));
}

export async function kvGetJson<T>(
  z: ZgClients,
  streamId: Hex,
  key: string,
): Promise<T | null> {
  const raw = await kvGet(z, streamId, key);
  if (raw === null) return null;
  return JSON.parse(raw) as T;
}
