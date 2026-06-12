import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma, withRetry } from '../lib/prisma';
import { groqJSON } from '../lib/groq';
import { buildCustomerWhere } from '../lib/customerFilter';

const router = Router();
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (d: number) => new Date(Date.now() - d * DAY);

const SEGMENT_WHERE: Record<string, Prisma.CustomerWhereInput> = {
  dormant_buyers: { orderCount: { gte: 2 }, lastPurchaseDate: { gte: daysAgo(365), lte: daysAgo(90) } },
  high_value_lapsed: { totalSpend: { gte: 15000 }, lastPurchaseDate: { gte: daysAgo(180), lte: daysAgo(45) } },
  one_time_buyers: { orderCount: 1, lastPurchaseDate: { lt: daysAgo(30) } },
};

const SEGMENT_LABEL: Record<string, string> = {
  dormant_buyers: 'Dormant Buyers',
  high_value_lapsed: 'High-Value Lapsed',
  one_time_buyers: 'One-Time Buyers',
  custom: 'Custom Segment',
};

// Run async work over a list with a hard cap on concurrency. Keeps large
// launches (and the AI calls they make) from overwhelming the API/DB at peak.
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

// Channel-specific delivery simulation rates (digital channels engage differently).
const CHANNEL_RATES: Record<string, { delivered: number; opened: number; clicked: number }> = {
  whatsapp: { delivered: 0.98, opened: 0.68, clicked: 0.40 },
  email: { delivered: 0.95, opened: 0.42, clicked: 0.18 },
  sms: { delivered: 0.99, opened: 0.55, clicked: 0.12 },
};

// Hour-of-day each channel tends to get engagement (used to build peak-hour data).
const CHANNEL_HOURS: Record<string, number[]> = {
  whatsapp: [18, 19, 19, 20, 20, 20, 21, 21, 22],
  email: [9, 10, 10, 11, 12, 15, 16],
  sms: [12, 13, 17, 18, 18, 19, 20],
};

function dateAtHour(hour: number): Date {
  const d = new Date();
  d.setUTCHours(hour, Math.floor(Math.random() * 60), 0, 0);
  return d;
}

// ── GET /api/campaigns ────────────────────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const campaigns = await withRetry(() => prisma.campaign.findMany({ orderBy: { createdAt: 'desc' } }));
    res.json(campaigns);
  } catch (err) {
    console.error('[campaigns:get]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/campaigns/launch ────────────────────────────────────
router.post('/launch', async (req, res) => {
  try {
    const { segmentType, segmentSize, offerType, discount, voucherCode, filter } = req.body ?? {};
    const where = segmentType === 'custom' ? buildCustomerWhere(filter ?? {}) : SEGMENT_WHERE[segmentType];
    if (!where) {
      res.status(400).json({ error: `Unknown segmentType: ${segmentType}` });
      return;
    }

    const take = typeof segmentSize === 'number' && segmentSize > 0 ? segmentSize : undefined;
    const customers = await withRetry(() => prisma.customer.findMany({
      where,
      take,
      include: { orders: { orderBy: { createdAt: 'desc' }, take: 1 } },
    }));

    if (!customers.length) {
      res.status(400).json({ error: 'No customers match this segment.' });
      return;
    }

    const label = SEGMENT_LABEL[segmentType] ?? segmentType;
    const offerLabel = offerType ?? 'Percentage Discount';
    const disc = typeof discount === 'number' ? discount : 20;
    const voucher = voucherCode || 'WELCOME20';

    // Token-efficient personalization: ONE small AI call returns a few message
    // templates with {name}/{category} placeholders, which we fill in locally per
    // customer. A launch of any size costs a single cheap AI call instead of one
    // per customer — keeps us comfortably inside the free token limits.
    type Comm = { customerId: string; customerName: string; channel: string; message: string };

    const fallbackTemplates = [
      `Hi {name}, we have missed you. Enjoy ${disc}% off your next {category} pick with code ${voucher}. Shop now before it is gone.`,
      `Hi {name}, your favourite {category} styles are waiting. Use ${voucher} for ${disc}% off — just for you.`,
      `Hi {name}, here is ${disc}% off to welcome you back. Treat yourself to new {category} with code ${voucher}.`,
      `Hi {name}, ready for a refresh? Take ${disc}% off {category} with code ${voucher}. Limited time.`,
      `Hi {name}, come back for more {category}. ${disc}% off your next order with ${voucher}.`,
    ];

    const ai = await groqJSON<{ templates: string[] }>(
      `You are a retail CRM copywriter. Write 5 unique, friendly win-back message templates for a ${offerLabel} offer (${disc}% off, code ${voucher}). Each template MUST contain the literal placeholders {name} and {category}. Keep each under 300 characters. Do NOT use any emojis. Return only JSON: { "templates": string[] } with exactly 5 items.`,
      JSON.stringify({ offer: offerLabel, discount: disc, voucherCode: voucher }),
      { templates: fallbackTemplates },
    );

    const templates = Array.isArray(ai.templates) && ai.templates.length ? ai.templates : fallbackTemplates;

    const comms: Comm[] = customers.map((c, i): Comm => {
      const firstName = c.name.split(' ')[0];
      const category = c.orders[0]?.category ?? 'clothing';
      const tpl = templates[i % templates.length] ?? fallbackTemplates[0];
      const message = tpl.replace(/\{name\}/g, firstName).replace(/\{category\}/g, category);
      return { customerId: c.id, customerName: c.name, channel: c.channel, message };
    });

    const now = new Date();
    const campaign = await withRetry(() => prisma.campaign.create({
      data: {
        name: `${label} — ${offerLabel} ${disc}%`,
        segmentType,
        segmentSize: customers.length,
        status: 'sent',
        sentCount: comms.length,
        offerType: offerLabel,
        discount: disc,
        voucherCode: voucher,
      },
    }));

    // Chunked bulk insert — handles large segments without one giant statement.
    for (let i = 0; i < comms.length; i += 500) {
      const chunk = comms.slice(i, i + 500);
      await withRetry(() => prisma.communication.createMany({
        data: chunk.map((c) => ({
          campaignId: campaign.id,
          customerId: c.customerId,
          customerName: c.customerName,
          channel: c.channel,
          message: c.message,
          status: 'sent',
          sentAt: now,
        })),
      }));
    }

    res.json({ campaignId: campaign.id, sentCount: comms.length, name: campaign.name });
  } catch (err) {
    console.error('[campaigns/launch]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /api/campaigns/:id/simulate ──────────────────────────────
router.post('/:id/simulate', async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await withRetry(() => prisma.campaign.findUnique({ where: { id } }));
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const comms = await withRetry(() => prisma.communication.findMany({ where: { campaignId: id }, select: { id: true, channel: true } }));
    const deliveredAt = new Date(campaign.createdAt.getTime() + 3 * 60 * 1000);

    let deliveredCount = 0, openedCount = 0, clickedCount = 0;

    // Bucket rows by (status, engagement-hour) so we apply them with a small,
    // bounded number of bulk updateMany calls instead of one query per row.
    const groups: Record<string, { status: 'delivered' | 'opened' | 'clicked'; hour: number; ids: string[] }> = {};
    const bucket = (status: 'delivered' | 'opened' | 'clicked', hour: number, cid: string) => {
      const k = `${status}|${hour}`;
      (groups[k] ??= { status, hour, ids: [] }).ids.push(cid);
    };

    for (const c of comms) {
      const rates = CHANNEL_RATES[c.channel] ?? CHANNEL_RATES.whatsapp;
      const hours = CHANNEL_HOURS[c.channel] ?? CHANNEL_HOURS.whatsapp;
      if (Math.random() >= rates.delivered) continue; // stays "sent"
      deliveredCount++;
      if (Math.random() >= rates.opened) { bucket('delivered', -1, c.id); continue; }
      openedCount++;
      const hour = hours[Math.floor(Math.random() * hours.length)];
      if (Math.random() >= rates.clicked) { bucket('opened', hour, c.id); continue; }
      clickedCount++;
      bucket('clicked', hour, c.id);
    }

    for (const g of Object.values(groups)) {
      if (g.status === 'delivered') {
        await withRetry(() => prisma.communication.updateMany({ where: { id: { in: g.ids } }, data: { status: 'delivered', deliveredAt } }));
      } else if (g.status === 'opened') {
        const openedAt = dateAtHour(g.hour);
        await withRetry(() => prisma.communication.updateMany({ where: { id: { in: g.ids } }, data: { status: 'opened', deliveredAt, openedAt } }));
      } else {
        const openedAt = dateAtHour(g.hour);
        const clickedAt = new Date(openedAt.getTime() + (3 + Math.floor(Math.random() * 20)) * 60 * 1000);
        await withRetry(() => prisma.communication.updateMany({ where: { id: { in: g.ids } }, data: { status: 'clicked', deliveredAt, openedAt, clickedAt } }));
      }
    }

    // Attribute revenue: each click converts at a realistic average order value.
    const revenue = clickedCount * Math.round(1800 + Math.random() * 1400);

    const updated = await withRetry(() => prisma.campaign.update({
      where: { id },
      data: { status: 'completed', deliveredCount, openedCount, clickedCount, revenue },
    }));

    res.json(updated);
  } catch (err) {
    console.error('[campaigns/simulate]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /api/campaigns/:id/feed ───────────────────────────────────
router.get('/:id/feed', async (req, res) => {
  try {
    const { id } = req.params;
    const comms = await withRetry(() => prisma.communication.findMany({
      where: { campaignId: id },
      orderBy: { sentAt: 'asc' },
      select: {
        id: true, customerName: true, channel: true, message: true, status: true,
        sentAt: true, deliveredAt: true, openedAt: true, clickedAt: true,
      },
    }));
    res.json(comms);
  } catch (err) {
    console.error('[campaigns/feed]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
