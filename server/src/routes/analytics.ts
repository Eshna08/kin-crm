import { Router } from 'express';
import { prisma, withRetry } from '../lib/prisma';
import { groqJSON } from '../lib/groq';

const router = Router();

// ── GET /api/analytics/summary ────────────────────────────────────
router.get('/summary', async (_req, res) => {
  try {
    const agg = await withRetry(() => prisma.campaign.aggregate({
      _sum: { sentCount: true, deliveredCount: true, openedCount: true, clickedCount: true, revenue: true },
    }));
    const campaigns = await withRetry(() => prisma.campaign.findMany({ orderBy: { createdAt: 'desc' } }));

    res.json({
      totalSent: agg._sum.sentCount ?? 0,
      totalDelivered: agg._sum.deliveredCount ?? 0,
      totalOpened: agg._sum.openedCount ?? 0,
      totalClicked: agg._sum.clickedCount ?? 0,
      totalRevenue: agg._sum.revenue ?? 0,
      campaigns,
    });
  } catch (err) {
    console.error('[analytics/summary]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Dynamic insight engine (shared by /insight and /ask) ──────────
const GROUP_EXPR: Record<string, string> = {
  tier: 'c.tier::text',
  gender: 'c.gender',
  city: 'c.city',
  channel: 'c.channel',
  age_group:
    "CASE WHEN c.age BETWEEN 18 AND 25 THEN '18-25' " +
    "WHEN c.age BETWEEN 26 AND 35 THEN '26-35' " +
    "WHEN c.age BETWEEN 36 AND 45 THEN '36-45' " +
    "WHEN c.age BETWEEN 46 AND 60 THEN '46-60' ELSE 'other' END",
  category: 'o.category',
};

const METRIC_EXPR: Record<string, string> = {
  count: 'COUNT(*)::int',
  avg_order_value: 'AVG(o.amount)',
  total_revenue: 'SUM(o.amount)',
};

interface InsightInput {
  groupBy?: string[];
  metric?: string;
  filters?: Record<string, unknown>;
}

interface InsightRow {
  group: string;
  value: number;
  count: number;
}

async function runInsight(input: InsightInput) {
  const groups = (input.groupBy ?? []).filter((g) => g in GROUP_EXPR);
  if (!groups.length) groups.push('tier');
  const metric = input.metric && input.metric in METRIC_EXPR ? input.metric : 'count';
  const filters = input.filters ?? {};

  const needsJoin =
    groups.includes('category') ||
    metric === 'avg_order_value' ||
    metric === 'total_revenue' ||
    filters.category != null;

  // WHERE clause (parameterised values only — column exprs come from whitelist)
  const clauses: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, val: unknown) => { params.push(val); clauses.push(sql.replace('?', `$${params.length}`)); };

  if (filters.tier != null) add('c.tier = ?', Number(filters.tier));
  if (filters.gender === 'M' || filters.gender === 'F') add('c.gender = ?', filters.gender);
  if (filters.city) add('c.city ILIKE ?', String(filters.city));
  if (filters.channel) add('c.channel = ?', String(filters.channel));
  if (filters.category) add('o.category = ?', String(filters.category));
  if (filters.minAge != null) add('c.age >= ?', Number(filters.minAge));
  if (filters.maxAge != null) add('c.age <= ?', Number(filters.maxAge));
  if (filters.minSpend != null) add('c."totalSpend" >= ?', Number(filters.minSpend));
  if (filters.maxSpend != null) add('c."totalSpend" <= ?', Number(filters.maxSpend));

  const selectGroups = groups.map((g, i) => `${GROUP_EXPR[g]} AS g${i}`).join(', ');
  const groupByOrdinals = groups.map((_, i) => i + 1).join(', ');
  const fromClause = needsJoin ? '"Customer" c JOIN "Order" o ON o."customerId" = c.id' : '"Customer" c';
  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const sql =
    `SELECT ${selectGroups}, ${METRIC_EXPR[metric]} AS value, COUNT(*)::int AS cnt ` +
    `FROM ${fromClause} ${whereClause} ` +
    `GROUP BY ${groupByOrdinals} ` +
    `ORDER BY value DESC NULLS LAST LIMIT 5`;

  const raw = (await withRetry(() => prisma.$queryRawUnsafe(sql, ...params))) as Record<string, unknown>[];

  const rows: InsightRow[] = raw.map((r) => {
    const label = groups
      .map((g, i) => {
        const v = r[`g${i}`];
        return g === 'tier' ? `Tier ${v}` : g === 'gender' ? (v === 'M' ? 'Male' : 'Female') : String(v);
      })
      .join(' · ');
    return { group: label, value: Math.round(Number(r.value) * 100) / 100, count: Number(r.cnt) };
  });

  return { groupBy: groups, metric, filters, rows };
}

// ── POST /api/analytics/insight ───────────────────────────────────
router.post('/insight', async (req, res) => {
  try {
    const result = await runInsight(req.body ?? {});
    res.json(result);
  } catch (err) {
    console.error('[analytics/insight]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/analytics/ask ───────────────────────────────────────
router.post('/ask', async (req, res) => {
  try {
    const { question } = req.body ?? {};
    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'question is required' });
      return;
    }

    const query = await groqJSON<InsightInput>(
      'Convert natural language questions about retail customer data to JSON with keys: groupBy (array), metric (one of: count|avg_order_value|total_revenue), filters (object). Valid groupBy values: tier, gender, city, channel, age_group, category. Filters may include tier, gender, city, channel, category, minAge, maxAge, minSpend, maxSpend. Output only valid JSON, no markdown.',
      question,
      { groupBy: ['tier'], metric: 'count', filters: {} },
    );

    const result = await runInsight(query);

    const fallbackInsight = {
      insight: result.rows.length
        ? `${result.rows[0].group} leads on ${result.metric.replace(/_/g, ' ')} with ${result.rows[0].value}. The top groups concentrate most of the value, making them efficient targets.`
        : 'No matching data was found for this question.',
      campaign_name: 'Targeted Win-Back',
      offer_type: 'Percentage Discount',
      whatsapp_copy: `Hi {name}! A little something for you — 20% off your next order. Use code WIN20 before it's gone!`,
      expected_revenue: '₹2.4L',
    };

    const ai = await groqJSON<typeof fallbackInsight>(
      'You are a retail CRM analyst. Given these results, write a 2-sentence business insight. Suggest one campaign. Do NOT use any emojis anywhere. Return only JSON: { insight, campaign_name, offer_type, whatsapp_copy (max 40 words), expected_revenue (format: ₹2.4L) }',
      JSON.stringify({ question, query: { groupBy: result.groupBy, metric: result.metric, filters: result.filters }, results: result.rows }),
      fallbackInsight,
    );

    res.json({
      question,
      query: { groupBy: result.groupBy, metric: result.metric, filters: result.filters },
      rows: result.rows,
      insight: ai.insight ?? fallbackInsight.insight,
      campaign_name: ai.campaign_name ?? fallbackInsight.campaign_name,
      offer_type: ai.offer_type ?? fallbackInsight.offer_type,
      whatsapp_copy: ai.whatsapp_copy ?? fallbackInsight.whatsapp_copy,
      expected_revenue: ai.expected_revenue ?? fallbackInsight.expected_revenue,
    });
  } catch (err) {
    console.error('[analytics/ask]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /api/analytics/channels ───────────────────────────────────
// Per-channel delivery performance across all communications.
router.get('/channels', async (_req, res) => {
  try {
    const rows = (await withRetry(() => prisma.$queryRawUnsafe(
      `SELECT channel,
         COUNT(*)::int AS sent,
         COUNT(*) FILTER (WHERE status IN ('delivered','opened','clicked'))::int AS delivered,
         COUNT(*) FILTER (WHERE status IN ('opened','clicked'))::int AS opened,
         COUNT(*) FILTER (WHERE status = 'clicked')::int AS clicked
       FROM "Communication"
       GROUP BY channel
       ORDER BY sent DESC`,
    ))) as { channel: string; sent: number; delivered: number; opened: number; clicked: number }[];

    const channels = rows.map((r) => {
      const openRate = r.delivered ? Math.round((r.opened / r.delivered) * 100) : 0;
      const clickRate = r.opened ? Math.round((r.clicked / r.opened) * 100) : 0;
      const estRevenue = r.clicked * 2500; // attributed at avg order value
      return { ...r, openRate, clickRate, estRevenue };
    });

    res.json(channels);
  } catch (err) {
    console.error('[analytics/channels]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /api/analytics/peak-hours ─────────────────────────────────
// Engagement (opens) by hour-of-day, overall and per channel, with the
// recommended send time per channel.
router.get('/peak-hours', async (_req, res) => {
  try {
    const rows = (await withRetry(() => prisma.$queryRawUnsafe(
      `SELECT channel, EXTRACT(HOUR FROM "openedAt")::int AS hour, COUNT(*)::int AS opens
       FROM "Communication"
       WHERE "openedAt" IS NOT NULL
       GROUP BY channel, hour
       ORDER BY hour`,
    ))) as { channel: string; hour: number; opens: number }[];

    // Overall hourly distribution (0-23)
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, opens: 0 }));
    const byChannel: Record<string, { hour: number; opens: number }[]> = {};
    for (const r of rows) {
      hourly[r.hour].opens += r.opens;
      (byChannel[r.channel] ??= []).push({ hour: r.hour, opens: r.opens });
    }

    // Best (peak) hour per channel
    const recommendations = Object.entries(byChannel).map(([channel, hrs]) => {
      const best = hrs.reduce((a, b) => (b.opens > a.opens ? b : a), { hour: 0, opens: 0 });
      return { channel, hour: best.hour, opens: best.opens };
    });

    res.json({ hourly, recommendations });
  } catch (err) {
    console.error('[analytics/peak-hours]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
