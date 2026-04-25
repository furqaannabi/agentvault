import { serve } from '@hono/node-server';
import { config as loadEnv } from 'dotenv';
import { Hono } from 'hono';
import { buildDeps } from './deps.js';
import { approveRoute } from './routes/approve.js';
import { chatRoute } from './routes/chat.js';
import { proofRoute } from './routes/proof.js';
import { pubkeyRoute } from './routes/pubkey.js';

loadEnv();

const app = new Hono();

app.get('/', (c) =>
  c.json({
    name: 'agentvault-api',
    version: '0.1.0',
    routes: ['/chat (POST)', '/approve (POST)', '/proof/:id (GET)', '/pubkey (GET)'],
  }),
);

app.get('/health', (c) => c.json({ ok: true }));

const deps = buildDeps();

app.route('/', chatRoute(deps));
app.route('/', approveRoute(deps));
app.route('/', proofRoute(deps));
app.route('/', pubkeyRoute(deps));

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`agentvault-api listening on http://localhost:${info.port}`);
  console.log(`EXEC_MODE=${process.env.EXEC_MODE ?? 'mock'}`);
});
