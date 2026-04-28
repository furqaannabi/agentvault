import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import type { Hex } from '@agentvault/types';
import { config as loadEnv } from 'dotenv';
import { ethers } from 'ethers';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { buildDeps } from './deps.js';
import { createSessionStore } from './middleware/session.js';
import { approveRoute } from './routes/approve.js';
import { chatRoute } from './routes/chat.js';
import { configRoute, parseAllowedTokens } from './routes/config.js';
import { portfolioRoute } from './routes/portfolio.js';
import { proofRoute } from './routes/proof.js';
import { pubkeyRoute } from './routes/pubkey.js';
import { sessionRoute } from './routes/session.js';

// Resolve backend/.env regardless of cwd (apps/api vs backend root)
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv(); // also try cwd as fallback

const app = new Hono();
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (o) => o ?? '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['content-type', 'authorization'],
    maxAge: 600,
  }),
);

app.get('/', (c) =>
  c.json({
    name: 'agentvault-api',
    version: '0.1.0',
    routes: [
      '/chat (POST)',
      '/approve (POST)',
      '/proof/:id (GET)',
      '/pubkey (GET)',
      '/config (GET)',
      '/portfolio (GET)',
      '/session/validate (POST)',
      '/session (DELETE)',
    ],
  }),
);

app.get('/health', (c) => c.json({ ok: true }));

const deps = buildDeps();

const delegateAddr = (process.env.SEPOLIA_SIGNER_ADDR ??
  (process.env.SEPOLIA_PRIVATE_KEY
    ? new ethers.Wallet(process.env.SEPOLIA_PRIVATE_KEY).address
    : undefined)) as Hex | undefined;
if (!delegateAddr) {
  throw new Error('SEPOLIA_PRIVATE_KEY or SEPOLIA_SIGNER_ADDR required for session middleware');
}
const chainId = Number(process.env.EXEC_CHAIN_ID ?? 11155111);
const sessions = createSessionStore({ delegate: delegateAddr, chainId });
const allowedTokens = parseAllowedTokens(process.env.ALLOWED_TOKENS);

app.use('/chat', sessions.middleware);
app.use('/approve', sessions.middleware);
app.use('/proof/*', sessions.middleware);
app.use('/proofs', sessions.middleware);
app.use('/portfolio', sessions.middleware);
app.use('/session', sessions.middleware);
app.use('/session/*', sessions.middleware);

app.route(
  '/',
  configRoute({ delegate: delegateAddr, chainId, allowedTokens, execMode: deps.execMode }),
);
app.route('/', sessionRoute(sessions));
app.route('/', chatRoute(deps));
app.route('/', approveRoute(deps));
app.route('/', proofRoute(deps));
app.route('/', pubkeyRoute(deps));

if (process.env.SEPOLIA_RPC_URL) {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  app.route('/', portfolioRoute({ provider, knownTokens: allowedTokens }));
} else {
  console.warn('[api] SEPOLIA_RPC_URL missing — /portfolio disabled');
}

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port, serverOptions: { requestTimeout: 120_000 } }, (info) => {
  console.log(`agentvault-api listening on http://localhost:${info.port}`);
  console.log(`EXEC_MODE=${process.env.EXEC_MODE ?? 'mock'}`);
});
