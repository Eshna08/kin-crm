import { Router } from 'express';
import { prisma, withRetry } from '../lib/prisma';

const router = Router();

const DEFAULT_RULES = [
  { name: 'Abandoned Cart', eventType: 'abandoned_cart' },
  { name: 'Points Earned', eventType: 'post_purchase' },
  { name: 'Special Occasion', eventType: 'app_reengagement' },
];

/**
 * Ensure the database holds exactly the 3 desired automation rules. If the
 * current set doesn't match, delete all existing rules and reseed (idempotent
 * afterwards, so fired counts are preserved across restarts).
 */
export async function seedDefaultTriggerRules(): Promise<void> {
  const existing = await withRetry(() => prisma.triggerRule.findMany({ select: { name: true, eventType: true } }));
  const matches =
    existing.length === DEFAULT_RULES.length &&
    DEFAULT_RULES.every((d) => existing.some((e) => e.eventType === d.eventType && e.name === d.name));
  if (matches) return;

  await withRetry(() => prisma.triggerRule.deleteMany());
  await withRetry(() => prisma.triggerRule.createMany({
    data: DEFAULT_RULES.map((r) => ({ name: r.name, eventType: r.eventType, isActive: true, firedCount: 0 })),
  }));
  console.log('Seeded default automation rules.');
}

// ── GET /api/triggers/rules ───────────────────────────────────────
router.get('/rules', async (_req, res) => {
  try {
    const rules = await withRetry(() => prisma.triggerRule.findMany({ orderBy: { createdAt: 'asc' } }));
    // attach last fired time from most recent event
    const withLastFired = await Promise.all(
      rules.map(async (rule) => {
        const last = await withRetry(() => prisma.triggerEvent.findFirst({
          where: { ruleId: rule.id },
          orderBy: { firedAt: 'desc' },
          select: { firedAt: true },
        }));
        return { ...rule, lastFiredAt: last?.firedAt ?? null };
      }),
    );
    res.json(withLastFired);
  } catch (err) {
    console.error('[triggers/rules]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── PATCH /api/triggers/rules/:id  (toggle active) ────────────────
router.patch('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body ?? {};
    const rule = await withRetry(() => prisma.triggerRule.update({ where: { id }, data: { isActive: !!isActive } }));
    res.json(rule);
  } catch (err) {
    console.error('[triggers/toggle]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// Per-event personalized message templates ({name}/{category} filled in locally —
// no AI tokens, always works). Each automation fires to exactly one customer.
const EVENT_MESSAGE: Record<string, (name: string, category: string) => string> = {
  abandoned_cart: (n, c) => `Hi ${n}, you left some ${c} in your cart. Complete your order now and enjoy 10% off with code BACK10 — before it sells out.`,
  post_purchase: (n, c) => `Hi ${n}, thanks for your order! You have just earned loyalty points. Redeem them on your next ${c} purchase before they expire.`,
  app_reengagement: (n, c) => `Hi ${n}, a special occasion is coming up. Here is a personalised treat just for you — 15% off your favourite ${c} with code CELEBRATE15.`,
};

const EVENT_OFFER: Record<string, { offerType: string; voucher: string }> = {
  abandoned_cart: { offerType: 'Cart Recovery', voucher: 'BACK10' },
  post_purchase: { offerType: 'Loyalty Reminder', voucher: 'POINTS' },
  app_reengagement: { offerType: 'Occasion Offer', voucher: 'CELEBRATE15' },
};

// ── POST /api/triggers/simulate ───────────────────────────────────
router.post('/simulate', async (req, res) => {
  try {
    const { eventType } = req.body ?? {};
    const rule = await withRetry(() => prisma.triggerRule.findFirst({ where: { eventType, isActive: true } }));
    if (!rule) {
      res.status(404).json({ error: `No active rule for eventType "${eventType}"` });
      return;
    }

    // Pick one real customer for the automation to fire at.
    const total = await withRetry(() => prisma.customer.count());
    let customer: { id: string; name: string; channel: string; orders: { category: string }[] } | null = null;
    if (total > 0) {
      const skip = Math.floor(Math.random() * total);
      customer = await withRetry(() => prisma.customer.findFirst({
        skip,
        select: { id: true, name: true, channel: true, orders: { orderBy: { createdAt: 'desc' }, take: 1, select: { category: true } } },
      }));
    }

    let campaignId: string | null = null;

    if (customer) {
      const firstName = customer.name.split(' ')[0];
      const category = customer.orders[0]?.category ?? 'clothing';
      const message = (EVENT_MESSAGE[eventType] ?? EVENT_MESSAGE.abandoned_cart)(firstName, category);
      const offer = EVENT_OFFER[eventType] ?? { offerType: 'Automation', voucher: 'AUTO' };

      // Create a real 1-person campaign so it shows up on the Campaigns page.
      const campaign = await withRetry(() => prisma.campaign.create({
        data: {
          name: `${rule.name} · ${customer!.name}`,
          segmentType: eventType,
          segmentSize: 1,
          status: 'sent',
          sentCount: 1,
          offerType: offer.offerType,
          voucherCode: offer.voucher,
          communications: {
            create: [{
              customerId: customer!.id,
              customerName: customer!.name,
              channel: customer!.channel,
              message,
              status: 'sent',
              sentAt: new Date(),
            }],
          },
        },
      }));
      campaignId = campaign.id;
    }

    const event = await withRetry(() => prisma.triggerEvent.create({
      data: {
        ruleId: rule.id,
        customerId: customer?.id ?? null,
        eventType,
        payload: { customerName: customer?.name ?? 'A customer', campaignId, source: 'simulation' },
      },
    }));

    const updatedRule = await withRetry(() => prisma.triggerRule.update({
      where: { id: rule.id },
      data: { firedCount: { increment: 1 } },
    }));

    res.json({ event, rule: updatedRule, customerName: customer?.name ?? null, campaignId });
  } catch (err) {
    console.error('[triggers/simulate]', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
