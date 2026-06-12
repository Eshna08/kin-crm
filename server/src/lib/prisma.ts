import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Plain direct connection to Neon (no pooler / no driver adapter).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Run a DB operation with retry + exponential backoff to survive Neon's
 * cold-start (the serverless compute resumes in ~2-5s and the first attempt
 * — sometimes the first 2-3 — can fail with a connection error).
 *
 * Only connection/availability errors are retried; real query errors throw
 * immediately so bugs aren't masked.
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 5, delayMs = 1500): Promise<T> {
  let attempt = 0;
  let delay = delayMs;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const e = err as { name?: string; message?: string };
      const msg = typeof e?.message === 'string' ? e.message : '';
      const isConnError =
        e?.name === 'PrismaClientInitializationError' ||
        /Can't reach database server|terminating connection|Server has closed the connection|ECONNRESET|Connection reset|Timed out|connection closed/i.test(msg);
      if (!isConnError || attempt >= retries) throw err;
      attempt++;
      console.warn(`[db] connection error — retry ${attempt}/${retries} in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 8000);
    }
  }
}
