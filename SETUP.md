# KIN — Run & Setup Guide

The app was rebuilt end-to-end against the spec. Because my sandbox has **no network access**
to Neon, Groq, or npm (and can't delete files on your disk), the database/seed/dev steps below
must be run by you on your machine, where you have network and the correct native binaries.

## SCHEMA UPDATED — reseed required

A `channel` column was added to Customer and Communication (preferred delivery
channel: WhatsApp / Email / SMS). Re-sync and reseed before running:

```
cd server
npx prisma db push --force-reset
npx prisma db seed
```

Then launch a campaign and click "Simulate" so the channel + peak-hours analytics
have data. New features:
- Preferred channel per customer, shown in the campaign live feed and the
  Opportunities custom-segment search ("Channel mix").
- Analytics: a "Channel performance" panel (open/click rates + est. revenue per
  channel) and a "Peak engagement hours" chart with the best send time per channel.
- "channel" is now a valid group-by in the Insight Chat (e.g. "open rate by channel").

Peak-traffic handling: large launches personalize messages with a hard cap of 5
concurrent AI calls (rate-limit safe), insert communications in chunks of 500, and
the delivery simulation applies status updates as a small bounded set of bulk
`updateMany` calls instead of one query per message.

## 0. One manual cleanup (required)

Delete the stale migration folder I couldn't remove from the sandbox:

```
# from server/
rmdir /s /q prisma\migrations        # Windows CMD
# or:  Remove-Item -Recurse -Force prisma\migrations   (PowerShell)
```

This old migration describes the *previous* schema and will conflict with the rebuild.

## 1. Backend

```
cd server
npm install                                   # if needed (deps already present)
npx prisma generate                           # regenerate client for the new schema
npx prisma migrate dev --name full_schema_rebuild
npx prisma db seed                            # seeds 1200 customers + orders
npm run dev                                    # starts API on http://localhost:3001
```

- `DATABASE_URL` in `server/.env` is already correct (no `-pooler`).
- If you prefer no migration history, `npx prisma db push` instead of `migrate dev` also works.
- The seed prints the live segment sizes it produced, e.g.:
  `Dormant buyers: ~400 / High-value lapsed: ~200 / One-time buyers: ~450`.

## 2. Frontend

```
cd client
npm install                                   # if needed
npm run dev                                    # starts UI on http://localhost:3000
```

`client/.env.local` already points to `NEXT_PUBLIC_API_URL=http://localhost:3001`.

## 3. Smoke test

1. Open http://localhost:3000 → redirects to **Opportunities**.
2. Three segment cards (Dormant / High-Value Lapsed / One-Time) appear, each with count,
   avg days lapsed, potential revenue, and 3 AI-written reasons.
3. Click a card → AI offer modal (offer type, discount, voucher, WhatsApp preview, reasoning,
   2 alternative tabs) → **Launch Campaign**.
4. **Campaigns** → table of campaigns; **Simulate Delivery** progresses statuses; the live feed
   below polls every 2s.
5. **Analytics** → 5 stat cards, conversion funnel, per-campaign ROI table, and the Insight Chat
   ("Ask Anything About Your Customers") with example chips.
6. **Triggers** → 4 rule cards with toggles, fired counts, and **Simulate Event** (toast on fire).

## Notes on AI (Groq)

- `GROQ_API_KEY` is read from `server/.env`. All Groq calls use `llama-3.3-70b-versatile`.
- Every AI call has a deterministic fallback, so the UI still works if Groq is unreachable or the
  key is missing — you'll just see template copy instead of model-generated copy.

## What changed vs. the old code

- Prisma schema replaced with the 6 spec models (Customer, Order, Campaign, Communication,
  TriggerRule, TriggerEvent).
- Prisma client switched from the Neon serverless adapter to a plain direct connection.
- New routes: `/api/opportunities`, `/api/campaigns`, `/api/analytics`, `/api/triggers`.
- Old, now-unused server files (`routes/events|receipts|segments.ts`, `services/*`) were emptied
  to harmless stubs — you can delete them. The active server never imports them.
- Frontend rebuilt: sidebar layout, dotted-grid + blue-glow background, and the 4 pages.
