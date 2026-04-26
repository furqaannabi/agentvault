import { createExecAdapter } from '@agentvault/exec';
import { DEFAULT_POLICY, createPolicy, type PolicyContext } from '@agentvault/policy';
import { createProofPipeline } from '@agentvault/proof';
import { createTwin } from '@agentvault/twin';
import type { Hex, SignedSession } from '@agentvault/types';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createSessionStore } from '../src/middleware/session.js';
import { approveRoute } from '../src/routes/approve.js';
import { chatRoute } from '../src/routes/chat.js';
import { proofRoute } from '../src/routes/proof.js';
import {
  TEST_CHAIN_ID,
  fakeAnchorClient,
  fakeComputeClient,
  fakeMemory,
  fakeSignedSession,
  sessionHeader,
  testDelegateAddr,
  testUserAddr,
} from './fakes.js';

const FIXED_KEY = ('0x' + 'a'.repeat(64)) as Hex;

const validProposalJson = JSON.stringify({
  tokenIn: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  tokenOut: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
  amountIn: '500000000',
  maxSlippageBps: 50,
  reasoning: 'rebalance from stables to ETH',
});

const validSanityJson = JSON.stringify({ ok: true, reason: 'consistent' });

function buildTestApp(opts?: { proposalJson?: string; sanityJson?: string }) {
  const memory = fakeMemory();
  const compute = fakeComputeClient({
    proposal: opts?.proposalJson ?? validProposalJson,
    sanity: opts?.sanityJson ?? validSanityJson,
  });
  const twin = createTwin({ memory, cfg: compute.cfg, compute });
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
  const sessions = createSessionStore({ delegate: testDelegateAddr(), chainId: TEST_CHAIN_ID });
  const app = new Hono();
  app.use('/chat', sessions.middleware);
  app.use('/approve', sessions.middleware);
  app.use('/proof/*', sessions.middleware);
  app.route('/', chatRoute(deps));
  app.route('/', approveRoute(deps));
  app.route('/', proofRoute(deps));
  return { app, sessions };
}

async function postJson(app: Hono, path: string, body: unknown, signed?: SignedSession) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (signed) headers.authorization = sessionHeader(signed);
  const res = await app.request(path, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

describe('e2e: chat → approve → proof', () => {
  it('produces a verifiable proof end-to-end', async () => {
    const { app } = buildTestApp();
    const signed = await fakeSignedSession();
    const user = testUserAddr().toLowerCase();

    const chat = await postJson(app, '/chat', { msg: 'rebalance' }, signed);
    expect(chat.status).toBe(200);
    const proposal = (chat.body as { proposal: { id: string; tokenIn: string; userId: string } }).proposal;
    expect(proposal.id).toMatch(/^prop_/);
    expect(proposal.userId).toBe(user);

    const approve = await postJson(app, '/approve', { proposalId: proposal.id }, signed);
    expect(approve.status).toBe(200);
    const proof = (approve.body as { proof: { proposalId: string; rootHash: string; anchorTx: string } }).proof;
    expect(proof.proposalId).toBe(proposal.id);
    expect(proof.rootHash).toMatch(/^0x[0-9a-f]{64}$/);

    const res = await app.request(`/proof/${proposal.id}`, {
      headers: { authorization: sessionHeader(signed) },
    });
    expect(res.status).toBe(200);
    const fetched = (await res.json()) as { proof: { rootHash: string } };
    expect(fetched.proof.rootHash).toBe(proof.rootHash);
  });

  it('rejects when policy fails (slippage over cap)', async () => {
    const { app } = buildTestApp({
      proposalJson: JSON.stringify({
        tokenIn: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        tokenOut: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
        amountIn: '500000000',
        maxSlippageBps: 999,
        reasoning: 'aggressive',
      }),
    });
    const signed = await fakeSignedSession();
    const chat = await postJson(app, '/chat', { msg: 'go big' }, signed);
    const proposalId = (chat.body as { proposal: { id: string } }).proposal.id;
    const approve = await postJson(app, '/approve', { proposalId }, signed);
    expect(approve.status).toBe(200);
    const rej = approve.body as { rejected: { ok: boolean; rules: { id: string; pass: boolean }[] } };
    expect(rej.rejected.ok).toBe(false);
    const slip = rej.rejected.rules.find((r) => r.id === 'slippageCap');
    expect(slip?.pass).toBe(false);
  });

  it('returns 404 for unknown proposal', async () => {
    const { app } = buildTestApp();
    const signed = await fakeSignedSession();
    const r = await postJson(app, '/approve', { proposalId: 'prop_nope' }, signed);
    expect(r.status).toBe(404);
  });

  it('returns 400 for malformed body', async () => {
    const { app } = buildTestApp();
    const signed = await fakeSignedSession();
    const r = await postJson(app, '/chat', {}, signed);
    expect(r.status).toBe(400);
  });

  it('rejects request without session header (401)', async () => {
    const { app } = buildTestApp();
    const r = await postJson(app, '/chat', { msg: 'hi' });
    expect(r.status).toBe(401);
    expect((r.body as { error: string }).error).toBe('missing_or_malformed_session');
  });

  it('rejects expired session (401)', async () => {
    const { app } = buildTestApp();
    const signed = await fakeSignedSession({ expiresAt: Math.floor(Date.now() / 1000) - 10 });
    const r = await postJson(app, '/chat', { msg: 'hi' }, signed);
    expect(r.status).toBe(401);
    expect((r.body as { error: string }).error).toBe('expired');
  });
});

void DEFAULT_POLICY;
type _U = PolicyContext;
