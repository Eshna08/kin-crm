import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { prisma, withRetry } from './lib/prisma';
import opportunitiesRouter from './routes/opportunities';
import campaignsRouter from './routes/campaigns';
import analyticsRouter from './routes/analytics';
import triggersRouter, { seedDefaultTriggerRules } from './routes/triggers';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Allow local dev and any Vercel deployment (incl. preview URLs *.vercel.app).
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // non-browser / same-origin / curl
    if (origin === 'http://localhost:3000' || /\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
}));
app.use(express.json());

app.use('/api/opportunities', opportunitiesRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/triggers', triggersRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'KIN server running' });
});

let keepAlive: ReturnType<typeof setInterval> | null = null;

const server = app.listen(PORT, () => {
  console.log(`KIN server running on http://localhost:${PORT}`);

  // FIX 3 — seed with extra retries (DB is most likely cold right at boot), and
  // never let a failure block the server. Run in the background.
  withRetry(() => seedDefaultTriggerRules(), 8, 1500)
    .then(() => console.log('[startup] trigger rules ready'))
    .catch((err) => console.warn('[startup] seed skipped (DB still cold) — routes will recover once it wakes:', (err as Error).message));

  // FIX 4 — keep-alive ping every 4 minutes so Neon's compute doesn't idle
  // mid-session. Never crashes the process.
  keepAlive = setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('[keep-alive] db ping ok');
    } catch (err) {
      console.warn('[keep-alive] db ping failed:', (err as Error).message);
    }
  }, 4 * 60 * 1000);
});

// Clean shutdown — clear the interval and close connections.
function shutdown(signal: string) {
  console.log(`[shutdown] received ${signal}, closing…`);
  if (keepAlive) clearInterval(keepAlive);
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
