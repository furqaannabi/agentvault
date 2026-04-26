import { Batcher, getFlowContract } from '@0glabs/0g-ts-sdk';
import { ethers } from 'ethers';
import type { Hex } from '@agentvault/types';
import type { ZgClients } from './clients.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

const toBytes = (s: string): Uint8Array => enc.encode(s);
const fromBytes = (b: Uint8Array): string => dec.decode(b);

export async function kvSet(
  z: ZgClients,
  streamId: Hex,
  key: string,
  value: string,
): Promise<void> {
  const [nodes, selErr] = await z.indexer.selectNodes(1);
  if (selErr !== null) throw new Error(`selectNodes: ${String(selErr)}`);
  // @ts-expect-error ethers ESM/CJS dual-package hazard: SDK bundled types reference different ethers instance
  const flow = getFlowContract(z.cfg.flowContract, z.signer);
  const batcher = new Batcher(1, nodes, flow, z.cfg.rpcUrl);
  batcher.streamDataBuilder.set(streamId, toBytes(key), toBytes(value));
  // Explicit fee well above market rate. SDK auto-quote sometimes lags real
  // pricePerSector causing Flow.submit to require(false). 0.002 OG per write
  // is generous for hackathon volume; lower if cost matters.
  const [, batchErr] = await batcher.exec({
    tags: '0x',
    finalityRequired: true,
    taskSize: 1,
    expectedReplica: 1,
    skipTx: false,
    fee: 2_000_000_000_000_000n,
  });
  if (batchErr !== null) throw new Error(`batcher.exec: ${String(batchErr)}`);
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
