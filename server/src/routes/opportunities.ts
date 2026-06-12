import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma, withRetry } from '../lib/prisma';
import { groqJSON } from '../lib/groq';
import { buildCustomerWhere } from '../lib/customerFilter';

const router = Router();
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (d: number) => new Date(Date.now() - d * DAY);

// ₹ formatting helpers (lakh/crore short form + grouped form)
const inrShort = (n: number) =>
  n >= 1e7 ? '₹' + (n / 1e7).toFixed(1) + 'Cr'
    : n >= 1e5 ? '₹' + (n / 1e5).toFixed(1) + 'L'
    : n >= 1e3 ? '₹' + (n / 1e3).toFixed(1) + 'K'
    : '₹' + Math.round(n);
const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

interface SegmentDef {
  segmentType: 'dormant_buyers' | 'high_value_lapsed' | 'one_time_buyers';
  label: string;
  where: Prisma.CustomerWhereInput;
  multiplier: number;
}

const SEGMENTS: SegmentDef[] = [
  {
    segmentType: 'dormant_buyers',
    label: 'Dormant Buyers',
    where: { orderCount: { gte: 2 }, lastPurchaseDate: { gte: daysAgo(365), lte: daysAgo(90) } },
    multiplier: 0.12,
  },
  {
    segmentType: 'high_value_lapsed',
    label: 'High-Value Lapsed',
    where: { totalSpend: { gte: 15000 }, lastPurchaseDate: { gte: daysAgo(180), lte: daysAgo(45) } },
    multiplier: 0.2,
  },
  {
    segmentType: 'one_time_buyers',
    label: 'One-Time Buyers',
    where: { orderCount: 1, lastPurchaseDate: { lt: daysAgo(30) } },
    multiplier: 0.18,
  },
];

function fallbackReasons(label: string, count: number, avgDaysLapsed: number, potentialRevenue: number): string[] {
  return [
    `${count.toLocaleString('en-IN')} ${label.toLowerCase()} represent a concentrated, ready-to-reactivate audience.`,
    `They last purchased ~${avgDaysLapsed} days ago — recent enough to remember the brand, lapsed enough to need a nudge.`,
    `A targeted win-back could recover roughly ${inrShort(potentialRevenue)} in attributable revenue.`,
  ];
}

// In-memory cache so refreshing the page doesn't re-run the AI every time.
let segCache: { at: number; data: unknown } | null = null;
const SEG_TTL = 10 * 60 * 1000; // 10 minutes

// ── GET /api/opportunities/segments ───────────────────────────────
router.get('/segments', async (_req, res) => {
  try {
    if (segCache && Date.now() - segCache.at < SEG_TTL) {
      res.json(segCache.data);
      return;
    }
    const results = [];
    for (const seg of SEGMENTS) {
      const rows = await withRetry(() => prisma.customer.findMany({
        where: seg.where,
        select: { totalSpend: true, orderCount: true, lastPurchaseDate: true },
      }));
      const count = rows.length;
      const avgDaysLapsed = count
        ? Math.round(rows.reduce((s, r) => s + (Date.now() - r.lastPurchaseDate.getTime()) / DAY, 0) / count)
        : 0;
      const avgOrderValue = count
        ? Math.round(rows.reduce((s, r) => s + r.totalSpend / Math.max(r.orderCount, 1), 0) / count)
        : 0;
      const potentialRevenue = Math.round(count * avgOrderValue * seg.multiplier);

      const ai = await groqJSON<{ reasons: string[] }>(
        'You are a retail CRM analyst. Given segment stats, write exactly 3 bullet points explaining why this segment is a revenue opportunity. Be specific and use the numbers provided. All monetary values are Indian Rupees, already formatted (e.g. ₹1.1L, ₹2,394) — use them EXACTLY as given. NEVER convert to dollars ($) or any other currency, and never reformat or recompute the amounts. Return only JSON: { reasons: string[] }',
        JSON.stringify({
          segment: seg.label,
          customerCount: count,
          avgDaysLapsed,
          avgOrderValue: inr(avgOrderValue),
          potentialRevenue: inrShort(potentialRevenue),
        }),
        { reasons: fallbackReasons(seg.label, count, avgDaysLapsed, potentialRevenue) },
      );

      const reasons =
        Array.isArray(ai.reasons) && ai.reasons.length
          ? ai.reasons.slice(0, 3)
          : fallbackReasons(seg.label, count, avgDaysLapsed, potentialRevenue);

      results.push({
        segmentType: seg.segmentType,
        label: seg.label,
        count,
        avgDaysLapsed,
        avgOrderValue,
        potentialRevenue,
        reasons,
      });
    }
    segCache = { at: Date.now(), data: results };
    res.json(results);
  } catch (err) {
    console.error('[opportunities/segments]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/opportunities/recommend ─────────────────────────────
function makeVoucher(segmentType: string): string {
  const prefix = segmentType.split('_')[0].toUpperCase().slice(0, 4);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${rand}`;
}

router.post('/recommend', async (req, res) => {
  try {
    const { segmentType, segmentSize, avgDaysLapsed, potentialRevenue } = req.body ?? {};
    const voucher = makeVoucher(segmentType ?? 'WINBACK');

    const fallback = {
      offerType: 'Percentage Discount',
      discount: 20,
      voucherCode: voucher,
      whatsappMessage:
        `Hi {name}, we have missed you. Here is 20% off your next order, just for you. Use code ${voucher} before it expires. Shop now.`,
      reasoning:
        `A 20% discount strikes the balance between margin and motivation for a segment that lapsed ~${avgDaysLapsed ?? 0} days ago, targeting ~₹${Math.round(potentialRevenue ?? 0).toLocaleString('en-IN')} in recoverable revenue.`,
      alternatives: [
        { offerType: 'Free Shipping', discount: 0, whatsappMessage: `Hi {name}, your favourites are back in stock. Enjoy free shipping on your next order with code ${voucher}.` },
        { offerType: 'Buy One Get One', discount: 50, whatsappMessage: `Hi {name}, treat yourself: Buy 1 Get 1 on selected styles. Use ${voucher} at checkout. Limited time.` },
      ],
    };

    const ai = await groqJSON<typeof fallback>(
      'You are a retail CRM offer strategist. Recommend the single best win-back offer plus 2 distinctly different alternatives, tailored to the EXACT segment given. ' +
        'Strategy by segment: "dormant_buyers" respond to a moderate percentage discount (15-25%); ' +
        '"high_value_lapsed" are premium customers — prefer exclusive/VIP perks (early access, a free premium gift, loyalty points, concierge styling) and AVOID deep discounts that erode margin (cap any discount at 10-15%); ' +
        '"one_time_buyers" respond to second-purchase incentives such as a bundle deal or free shipping paired with a small discount (10-15%). ' +
        'The recommended offerType and discount MUST clearly fit the given segmentType, and the 2 alternatives must each use a different offerType from the recommendation. ' +
        'Use the voucher code provided verbatim. Personalize WhatsApp messages with the {name} placeholder. Keep messages under 320 characters. Do NOT use any emojis. ' +
        'Return only JSON: { offerType: string, discount: number, voucherCode: string, whatsappMessage: string, reasoning: string, alternatives: [{ offerType: string, discount: number, whatsappMessage: string }, { offerType: string, discount: number, whatsappMessage: string }] }',
      JSON.stringify({ segmentType, segmentSize, avgDaysLapsed, potentialRevenue, voucherCode: voucher }),
      fallback,
    );

    if (!ai.voucherCode) ai.voucherCode = voucher;
    res.json(ai);
  } catch (err) {
    console.error('[opportunities/recommend]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/opportunities/search ────────────────────────────────
router.post('/search', async (req, res) => {
  try {
    const { query } = req.body ?? {};
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'query is required' });
      return;
    }

    const filter = await groqJSON<Record<string, unknown>>(
      'Convert a natural-language description of a retail customer segment into JSON filter params. Use ONLY these keys (omit any you do not need): ' +
        'tier (integer 1, 2 or 3; if several tiers are mentioned use an array e.g. [1,2]), ' +
        'gender (must be exactly "M" or "F" — map men/male to "M" and women/female to "F"), ' +
        'channel (one of "whatsapp" | "email" | "sms"), ' +
        'city (a REAL city name only, one of: Mumbai, Delhi, Bangalore, Jaipur, Surat, Lucknow, Aligarh, Siliguri, Bhilai — note that a phrase like "tier 2 city" describes the tier, NOT a city, so omit city in that case), ' +
        'minAge, maxAge (for an age range like "25-40" set minAge=25 and maxAge=40), ' +
        'minSpend, maxSpend, minOrders, maxOrders, daysSinceLastPurchaseMin, daysSinceLastPurchaseMax. ' +
        'Output only valid JSON, no markdown.',
      query,
      {},
    );

    const where = buildCustomerWhere(filter);
    const rows = await withRetry(() => prisma.customer.findMany({
      where,
      select: { totalSpend: true, orderCount: true, city: true, tier: true, gender: true, age: true, channel: true, lastPurchaseDate: true },
    }));

    const count = rows.length;
    const avgSpend = count ? Math.round(rows.reduce((s, r) => s + r.totalSpend, 0) / count) : 0;
    const avgOrders = count ? +(rows.reduce((s, r) => s + r.orderCount, 0) / count).toFixed(1) : 0;
    const avgAge = count ? Math.round(rows.reduce((s, r) => s + (r.age ?? 0), 0) / count) : 0;

    const cityCounts: Record<string, number> = {};
    for (const r of rows) if (r.city) cityCounts[r.city] = (cityCounts[r.city] ?? 0) + 1;
    const topCities = Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([city, n]) => ({ city, count: n }));

    const channelCounts: Record<string, number> = {};
    for (const r of rows) channelCounts[r.channel] = (channelCounts[r.channel] ?? 0) + 1;
    const channelMix = Object.entries(channelCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([channel, n]) => ({ channel, count: n }));

    res.json({
      query,
      filter,
      count,
      sample: { avgSpend, avgOrders, avgAge, topCities, channelMix },
    });
  } catch (err) {
    console.error('[opportunities/search]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
