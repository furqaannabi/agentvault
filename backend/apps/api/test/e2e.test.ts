import { createExecAdapter } from '@agentvault/exec';
import { DEFAULT_POLICY, createPolicy, type PolicyContext } from '@agentvault/policy';
import { createProofPipeline } from '@agentvault/proof';
import { createTwin } from '@agentvault/twin';
import type { Hex } from '@agentvault/types';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { approveRoute } from '../src/routes/approve.js';
import { chatRoute } from '../src/routes/chat.js';
import { proofRoute } from '../src/routes/proof.js';
import { fakeAnchorClient, fakeComputeClient, fakeMemory } from './fakes.js';

const FIXED_KEY = ('0x' + 'a'.repeat(64)) as Hex;

const validProposalJson = JSON.stringify({
  tokenIn: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  tokenOut: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
  amountIn: '500000000',
  maxSlippageBps: 50,
  reasoning: 'rebalance from stables to ETH',
});

const validSanityJson = JSON.stringify({ ok: true, reason: 'consistent' });

function buildTestApp() {
  const memory = fakeMemory();
  const compute = fakeComputeClient({
    proposal: validProposalJson,
    sanity: validSanityJson,
  });
  const twin = createTwin({
    memory,
    cfg: compute.cfg,
    compute,
  });
  const policy = createPolicy({ twin, signerKey: FIXED_KEY });
  const exec = createExecAdapter({ mode: 'mock' });
  const proof = createProofPipeline({
    memory,
    cfg: {
      rpcUrl: 'https://fake.0g',
      privateKey: FIXED_KEY,
      proofAnchorAddress: ('0x' + '2'.repeat(40)) as Hex,
      chainId: 16602,
    },
    anchor: fakeAnchorClient(),
  });

  const deps = { memory, twin, policy, exec, proof };
  const app = new Hono();
  app.route('/', chatRoute(deps));
  app.route('/', approveRoute(deps));
  app.route('/', proofRoute(deps));
  return app;
}

async function postJson(app: Hono, path: string, body: unknown) {
  const res = await app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

describe('e2e: chat → approve → proof', () => {
  it('produces a verifiable proof end-to-end', async () => {
    const app = buildTestApp();

    // 1. Chat
    const chat = await postJson(app, '/chat', { userId: 'alice', msg: 'rebalance' });
    expect(chat.status).toBe(200);
    const proposal = (chat.body as { proposal: { id: string; tokenIn: string } }).proposal;
    expect(proposal.id).toMatch(/^prop_/);
    expect(proposal.tokenIn).toBe('0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238');

    // 2. Approve
    const approve = await postJson(app, '/approve', { proposalId: proposal.id, userId: 'alice' });
    expect(approve.status).toBe(200);
    const proof = (approve.body as { proof: { proposalId: string; rootHash: string; anchorTx: string } })
      .proof;
    expect(proof.proposalId).toBe(proposal.id);
    expect(proof.rootHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(proof.anchorTx).toMatch(/^0xanchor/);

    // 3. Fetch proof
    const get = await app.request(`/proof/${proposal.id}?userId=alice`);
    expect(get.status).toBe(200);
    const fetched = (await get.json()) as { proof: { rootHash: string } };
    expect(fetched.proof.rootHash).toBe(proof.rootHash);
  });

  it('rejects when policy fails (slippage over cap)', async () => {
    const memory = fakeMemory();
    const compute = fakeComputeClient({
      proposal: JSON.stringify({
        tokenIn: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        tokenOut: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
        amountIn: '500000000',
        maxSlippageBps: 999, // over default cap of 100
        reasoning: 'aggressive',
      }),
      sanity: validSanityJson,
    });
    const twin = createTwin({ memory, cfg: compute.cfg, compute });
    const policy = createPolicy({ twin, signerKey: FIXED_KEY });
    const exec = createExecAdapter({ mode: 'mock' });
    const proof = createProofPipeline({
      memory,
      cfg: {
        rpcUrl: 'x',
        privateKey: FIXED_KEY,
        proofAnchorAddress: ('0x' + '2'.repeat(40)) as Hex,
        chainId: 16602,
      },
      anchor: fakeAnchorClient(),
    });
    const deps = { memory, twin, policy, exec, proof };
    const app = new Hono();
    app.route('/', chatRoute(deps));
    app.route('/', approveRoute(deps));

    const chat = await postJson(app, '/chat', { userId: 'bob', msg: 'go big' });
    const proposalId = (chat.body as { proposal: { id: string } }).proposal.id;
    const approve = await postJson(app, '/approve', { proposalId, userId: 'bob' });
    expect(approve.status).toBe(200);
    const rej = approve.body as { rejected: { ok: boolean; rules: { id: string; pass: boolean }[] } };
    expect(rej.rejected.ok).toBe(false);
    const slip = rej.rejected.rules.find((r) => r.id === 'slippageCap');
    expect(slip?.pass).toBe(false);
  });

  it('returns 404 for unknown proposal', async () => {
    const app = buildTestApp();
    const r = await postJson(app, '/approve', { proposalId: 'prop_nope', userId: 'alice' });
    expect(r.status).toBe(404);
  });

  it('returns 400 for malformed body', async () => {
    const app = buildTestApp();
    const r = await postJson(app, '/chat', { userId: 'alice' }); // missing msg
    expect(r.status).toBe(400);
  });
});

// Suppresses unused warning when above test doesn't reference DEFAULT_POLICY/PolicyContext
void DEFAULT_POLICY;
type _U = PolicyContext;
