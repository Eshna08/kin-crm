import { Prisma } from '@prisma/client';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (d: number) => new Date(Date.now() - d * DAY);

export const KNOWN_CITIES = ['mumbai', 'delhi', 'bangalore', 'jaipur', 'surat', 'lucknow', 'aligarh', 'siliguri', 'bhilai'];

function num(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function normGender(g: unknown): 'M' | 'F' | undefined {
  if (typeof g !== 'string') return undefined;
  const s = g.trim().toLowerCase();
  if (['f', 'female', 'females', 'women', 'woman', 'girls', 'ladies'].includes(s)) return 'F';
  if (['m', 'male', 'males', 'men', 'man', 'boys', 'gents'].includes(s)) return 'M';
  return undefined;
}

function normChannel(c: unknown): string | undefined {
  if (typeof c !== 'string') return undefined;
  const s = c.trim().toLowerCase();
  return ['whatsapp', 'email', 'sms'].includes(s) ? s : undefined;
}

/**
 * Build a Prisma Customer where-clause from a loose, AI-produced filter object.
 * Tolerates: tier as number/string/array, gender synonyms, numeric strings,
 * and ignores city values that are not real cities (e.g. the word "city").
 */
export function buildCustomerWhere(f: Record<string, unknown> = {}): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {};

  // tier — single value or several ("tier 1 and 2" -> { in: [1, 2] })
  const rawTier = f.tier ?? f.tiers;
  if (Array.isArray(rawTier)) {
    const tiers = rawTier.map(num).filter((n): n is number => n != null);
    if (tiers.length) where.tier = tiers.length === 1 ? tiers[0] : { in: tiers };
  } else {
    const t = num(rawTier);
    if (t != null) where.tier = t;
  }

  const g = normGender(f.gender);
  if (g) where.gender = g;

  const ch = normChannel(f.channel);
  if (ch) where.channel = ch;

  // Only treat city as a filter if it is an actual city in our dataset.
  if (typeof f.city === 'string' && KNOWN_CITIES.includes(f.city.trim().toLowerCase())) {
    where.city = { equals: f.city, mode: 'insensitive' };
  }

  const minAge = num(f.minAge), maxAge = num(f.maxAge);
  if (minAge != null || maxAge != null) where.age = { ...(minAge != null ? { gte: minAge } : {}), ...(maxAge != null ? { lte: maxAge } : {}) };

  const minSpend = num(f.minSpend), maxSpend = num(f.maxSpend);
  if (minSpend != null || maxSpend != null) where.totalSpend = { ...(minSpend != null ? { gte: minSpend } : {}), ...(maxSpend != null ? { lte: maxSpend } : {}) };

  const minOrders = num(f.minOrders), maxOrders = num(f.maxOrders);
  if (minOrders != null || maxOrders != null) where.orderCount = { ...(minOrders != null ? { gte: minOrders } : {}), ...(maxOrders != null ? { lte: maxOrders } : {}) };

  const dMin = num(f.daysSinceLastPurchaseMin), dMax = num(f.daysSinceLastPurchaseMax);
  if (dMin != null || dMax != null) {
    where.lastPurchaseDate = { ...(dMax != null ? { gte: daysAgo(dMax) } : {}), ...(dMin != null ? { lte: daysAgo(dMin) } : {}) };
  }

  return where;
}
