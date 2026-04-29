import type { Hex } from '@agentvault/types';
import { ethers } from 'ethers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ERC20_APPROVE_ABI,
  UNIVERSAL_ROUTER_EXECUTE_ABI,
  UNIVERSAL_ROUTER_SEPOLIA,
  createKeeperhubClient,
} from '../src/index.js';

const SEPOLIA = 11155111;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeFetch(handlers: Array<(url: string, init?: RequestInit) => Response | Promise<Response>>): typeof fetch {
  let i = 0;
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const handler = handlers[Math.min(i, handlers.length - 1)];
    i += 1;
    if (!handler) throw new Error('fetch handler exhausted');
    return await handler(typeof url === 'string' ? url : url.toString(), init);
  }) as unknown as typeof fetch;
}

const minimalCfg = (overrides: Partial<Parameters<typeof createKeeperhubClient>[0]> = {}) =>
  createKeeperhubClient({
    apiKey: 'kh_test_key',
    network: 'sepolia',
    chainId: SEPOLIA,
    timeoutMs: 5_000,
    fetch: overrides.fetch ?? (vi.fn() as unknown as typeof fetch),
    ...overrides,
  });

describe('keeperhub client — chain guard', () => {
  it('throws on non-Sepolia chainId at construction', () => {
    expect(() =>
      createKeeperhubClient({
        apiKey: 'k',
        network: 'mainnet',
        chainId: 1,
        fetch: vi.fn() as unknown as typeof fetch,
      }),
    ).toThrow(/refused.*Ethereum Sepolia/);
  });

  it('throws if apiKey missing', () => {
    expect(() =>
      createKeeperhubClient({
        apiKey: '',
        network: 'sepolia',
        chainId: SEPOLIA,
        fetch: vi.fn() as unknown as typeof fetch,
      }),
    ).toThrow(/apiKey required/);
  });
});

describe('keeperhub client — submitJob', () => {
  it('POSTs contract-call with serialized args + abi and X-API-Key auth', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchSpy = makeFetch([
      (url, init) => {
        calls.push({ url, init });
        return jsonResponse({ executionId: 'direct_42', status: 'pending' });
      },
    ]);
    const client = minimalCfg({ fetch: fetchSpy });
    const res = await client.submitJob({
      contractAddress: ('0x' + '1'.repeat(40)) as Hex,
      functionName: 'transfer',
      functionArgs: [('0x' + '2'.repeat(40)) as Hex, 1000n],
      abi: [{ type: 'function', name: 'transfer' }],
      value: 0n,
    });

    expect(res.executionId).toBe('direct_42');
    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    expect(c.url).toMatch(/\/api\/execute\/contract-call$/);
    const headers = c.init?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('kh_test_key');
    expect(headers.authorization).toBeUndefined();
    const body = JSON.parse(String(c.init?.body)) as {
      network: string;
      contractAddress: string;
      functionName: string;
      functionArgs: string;
      abi: string;
      value: string;
    };
    expect(body.network).toBe('sepolia');
    expect(body.functionName).toBe('transfer');
    expect(JSON.parse(body.functionArgs)).toEqual(['0x' + '2'.repeat(40), '1000']);
    expect(JSON.parse(body.abi)).toEqual([{ type: 'function', name: 'transfer' }]);
    expect(body.value).toBe('0');
  });

  it('surfaces non-2xx errors with status code', async () => {
    const fetchSpy = makeFetch([
      () => new Response('rate limited', { status: 429 }),
    ]);
    const client = minimalCfg({ fetch: fetchSpy });
    await expect(
      client.submitJob({
        contractAddress: ('0x' + '1'.repeat(40)) as Hex,
        functionName: 'noop',
        functionArgs: [],
        abi: [],
      }),
    ).rejects.toThrow(/429.*rate limited/);
  });
});

describe('keeperhub client — awaitJob polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls running -> completed and returns success with tx data', async () => {
    const fetchSpy = makeFetch([
      () => jsonResponse({ executionId: 'direct_1', status: 'running' }),
      () => jsonResponse({ executionId: 'direct_1', status: 'running' }),
      () =>
        jsonResponse({
          executionId: 'direct_1',
          status: 'completed',
          transactionHash: '0x' + 'a'.repeat(64),
          gasUsedWei: '12345',
          transactionLink: 'https://sepolia.etherscan.io/tx/0xaaa',
        }),
    ]);
    const client = minimalCfg({ fetch: fetchSpy });
    const p = client.awaitJob('direct_1', { initialIntervalMs: 100, maxIntervalMs: 100, timeoutMs: 5_000 });
    await vi.runAllTimersAsync();
    const r = await p;
    expect(r.status).toBe('success');
    expect(r.attempts).toBe(3);
    expect(r.finalTxHash).toBe('0x' + 'a'.repeat(64));
    expect(r.finalGasUsed).toBe('12345');
    expect(r.network).toBe('sepolia');
    expect(r.auditTrailUrl).toContain('direct_1');
  });

  it('returns status=failed with error from KeeperHub on terminal failure', async () => {
    const fetchSpy = makeFetch([
      () =>
        jsonResponse({
          executionId: 'direct_2',
          status: 'failed',
          error: 'tx reverted: STF',
          transactionHash: '0x' + 'b'.repeat(64),
          gasUsedWei: '21000',
        }),
    ]);
    const client = minimalCfg({ fetch: fetchSpy });
    const p = client.awaitJob('direct_2', { initialIntervalMs: 50, maxIntervalMs: 50, timeoutMs: 1_000 });
    await vi.runAllTimersAsync();
    const r = await p;
    expect(r.status).toBe('failed');
    expect(r.error).toMatch(/STF/);
    expect(r.finalTxHash).toBe('0x' + 'b'.repeat(64));
    expect(r.attempts).toBe(1);
  });

  it('returns status=timeout when budget exhausts before terminal status', async () => {
    const fetchSpy = makeFetch([
      () => jsonResponse({ executionId: 'direct_3', status: 'running' }),
    ]);
    const client = minimalCfg({ fetch: fetchSpy });
    const p = client.awaitJob('direct_3', { initialIntervalMs: 100, maxIntervalMs: 100, timeoutMs: 250 });
    await vi.runAllTimersAsync();
    const r = await p;
    expect(r.status).toBe('timeout');
    expect(r.error).toMatch(/timed out/);
  });
});

describe('keeperhub client — executeSwap', () => {
  it('decodes Universal Router calldata, submits, and awaits', async () => {
    // Encode a real execute(bytes,bytes[],uint256) calldata.
    const iface = new ethers.Interface(UNIVERSAL_ROUTER_EXECUTE_ABI);
    const commands = '0x00';
    const inputs = ['0xdead', '0xbeef'];
    const deadline = 9_999_999_999n;
    const data = iface.encodeFunctionData('execute', [commands, inputs, deadline]) as Hex;

    const submittedBodies: unknown[] = [];
    const fetchSpy = makeFetch([
      (_url, init) => {
        submittedBodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({ executionId: 'direct_swap_1', status: 'pending' });
      },
      () =>
        jsonResponse({
          executionId: 'direct_swap_1',
          status: 'completed',
          transactionHash: '0x' + 'c'.repeat(64),
          gasUsedWei: '180000',
        }),
    ]);
    const client = minimalCfg({ fetch: fetchSpy });
    const r = await client.executeSwap(
      { routerAddress: UNIVERSAL_ROUTER_SEPOLIA, calldata: data, value: 0n },
      { initialIntervalMs: 1, maxIntervalMs: 1, timeoutMs: 5_000 },
    );
    expect(r.status).toBe('success');
    expect(r.finalTxHash).toBe('0x' + 'c'.repeat(64));
    expect(submittedBodies).toHaveLength(1);
    const body = submittedBodies[0] as { contractAddress: string; functionName: string; functionArgs: string };
    expect(body.contractAddress.toLowerCase()).toBe(UNIVERSAL_ROUTER_SEPOLIA.toLowerCase());
    expect(body.functionName).toBe('execute');
    const args = JSON.parse(body.functionArgs) as [string, string[], string];
    expect(args[0]).toBe(commands);
    expect(args[1]).toEqual(inputs);
    expect(args[2]).toBe(deadline.toString());
  });

  it('executeApproval submits ERC20.approve via /api/execute/contract-call', async () => {
    const submittedBodies: unknown[] = [];
    const fetchSpy = makeFetch([
      (_url, init) => {
        submittedBodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({ executionId: 'direct_approval_1', status: 'pending' });
      },
      () =>
        jsonResponse({
          executionId: 'direct_approval_1',
          status: 'completed',
          transactionHash: '0x' + 'd'.repeat(64),
          gasUsedWei: '46000',
        }),
    ]);
    const client = minimalCfg({ fetch: fetchSpy });
    const usdc = ('0x' + '1'.repeat(40)) as Hex;
    const permit2 = ('0x' + '2'.repeat(40)) as Hex;
    const r = await client.executeApproval(
      { tokenAddress: usdc, spender: permit2, amount: '500000000' },
      { initialIntervalMs: 1, maxIntervalMs: 1, timeoutMs: 5_000 },
    );
    expect(r.status).toBe('success');
    expect(r.finalTxHash).toBe('0x' + 'd'.repeat(64));
    expect(submittedBodies).toHaveLength(1);
    const body = submittedBodies[0] as {
      contractAddress: string;
      functionName: string;
      functionArgs: string;
      abi: string;
      gasLimitMultiplier?: string;
    };
    expect(body.contractAddress.toLowerCase()).toBe(usdc.toLowerCase());
    expect(body.functionName).toBe('approve');
    expect(JSON.parse(body.functionArgs)).toEqual([permit2, '500000000']);
    expect(JSON.parse(body.abi)).toEqual(ERC20_APPROVE_ABI);
    expect(body.gasLimitMultiplier).toBe('1.2');
  });

  it('executeSwap honours gasLimitMultiplier override (Item 4 force-retry)', async () => {
    const iface = new ethers.Interface(UNIVERSAL_ROUTER_EXECUTE_ABI);
    const data = iface.encodeFunctionData('execute', ['0x00', ['0xdead'], 1n]) as Hex;
    const submittedBodies: unknown[] = [];
    const fetchSpy = makeFetch([
      (_u, init) => {
        submittedBodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({ executionId: 'direct_swap_force', status: 'pending' });
      },
      () =>
        jsonResponse({
          executionId: 'direct_swap_force',
          status: 'completed',
          transactionHash: '0x' + 'e'.repeat(64),
          gasUsedWei: '180000',
        }),
    ]);
    const client = minimalCfg({ fetch: fetchSpy });
    await client.executeSwap(
      {
        routerAddress: UNIVERSAL_ROUTER_SEPOLIA,
        calldata: data,
        value: 0n,
        gasLimitMultiplier: '0.85',
      },
      { initialIntervalMs: 1, maxIntervalMs: 1, timeoutMs: 5_000 },
    );
    const body = submittedBodies[0] as { gasLimitMultiplier: string };
    expect(body.gasLimitMultiplier).toBe('0.85');
  });

  it('rejects calldata that is not Universal Router execute()', async () => {
    const fetchSpy = makeFetch([
      () => {
        throw new Error('should not be called');
      },
    ]);
    const client = minimalCfg({ fetch: fetchSpy });
    await expect(
      client.executeSwap({
        routerAddress: UNIVERSAL_ROUTER_SEPOLIA,
        calldata: '0xdeadbeef' as Hex,
        value: 0n,
      }),
    ).rejects.toThrow(/decode|execute/);
  });
});
