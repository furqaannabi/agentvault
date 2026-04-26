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
import { proofRoute } from './routes/proof.js';
import { pubkeyRoute } from './routes/pubkey.js';

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
    routes: ['/chat (POST)', '/approve (POST)', '/proof/:id (GET)', '/pubkey (GET)'],
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
const sessions = createSessionStore({
  delegate: delegateAddr,
  chainId: Number(process.env.EXEC_CHAIN_ID ?? 84532),
});

app.use('/chat', sessions.middleware);
app.use('/approve', sessions.middleware);
app.use('/proof/*', sessions.middleware);

app.route('/', chatRoute(deps));
app.route('/', approveRoute(deps));
app.route('/', proofRoute(deps));
app.route('/', pubkeyRoute(deps));

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`agentvault-api listening on http://localhost:${info.port}`);
  console.log(`EXEC_MODE=${process.env.EXEC_MODE ?? 'mock'}`);
});
