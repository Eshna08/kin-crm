<div align="center">

<img src="https://img.shields.io/badge/STATUS-LIVE-22c55e?style=for-the-badge&labelColor=0F172A" />
<img src="https://img.shields.io/badge/AI-Groq%20LLaMA%203.3-7C3AED?style=for-the-badge&labelColor=0F172A" />
<img src="https://img.shields.io/badge/Built%20on-Xeno-EA580C?style=for-the-badge&labelColor=0F172A" />

<br/><br/>

# 🧠 K I N
### *AI-Native CRM for Retail*

<h3>SQL computes the numbers.<br/>AI only narrates the why.</h3>

<br/>

[![Demo](https://img.shields.io/badge/🚀_LIVE_DEMO-2563EB?style=for-the-badge&logoColor=white)](https://kin-crm-snowy.vercel.app/opportunities)
[![Backend](https://img.shields.io/badge/⚙️_API-0F172A?style=for-the-badge&logoColor=white)](https://kin-crm.onrender.com/api/triggers/rules)

<br/>

```
┌──────────────────────────────────────────────────────────┐
│                                                            │
│   "The AI can't hallucinate ₹15 lakh because it never     │
│    sees raw data — only aggregated SQL output.            │
│                                                            │
│              The database computes.                       │
│              The AI narrates."                            │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

</div>

<br/>

---

<br/>

## 💡 The Core Idea

Most "AI CRMs" let a language model decide everything — segment sizes, revenue projections, customer counts. Which means they can **hallucinate numbers that don't exist.**

KIN does the opposite.

<table>
<tr>
<td width="50%" valign="top">

### ❌ The Old Way

```
User: "How many dormant customers?"

AI: "Approximately 2,400 customers
     appear dormant, representing
     roughly ₹18L in opportunity."
```

🚩 Made up. Unverifiable. Dangerous.

</td>
<td width="50%" valign="top">

### ✅ The KIN Way

```sql
SELECT COUNT(*), AVG(days_lapsed)
FROM customers
WHERE order_count >= 2
  AND last_purchase BETWEEN
      90 AND 365 days ago
```

```
→ 398 customers · 234 days avg
→ ₹1.1L potential revenue
```

✅ Real. Computed. Auditable.
*Then* AI explains why it matters.

</td>
</tr>
</table>

<br/>

---

<br/>

## ✨ Features

<br/>

### 🎯 &nbsp; Revenue Opportunities

Three SQL queries run against **1,200 real seeded customers** and surface computed segments — no AI involved in the math.

| Segment | Criteria | Why it matters |
|:---|:---|:---|
| 🔵 **Dormant Buyers** | 2+ orders, quiet 90–365 days | Proven buyers gone cold |
| 🟣 **High-Value Lapsed** | Spent ₹15k+, inactive 45–180 days | Your best customers, slipping away |
| 🔷 **One-Time Buyers** | Single purchase, 30+ days ago | Never converted to repeat |

Each card shows exact counts and revenue from SQL, plus **3 AI-narrated reasons** for why the segment is worth acting on.

> 💬 Type *"Tier 3 women who spent over ₹5,000 but haven't bought in 60 days"* — Groq converts this to a live database query, instantly.

<br/>

### 🤖 &nbsp; AI Offer Recommendations

Click any segment → Groq analyzes the **computed context only** (size, recency, revenue — zero PII) and returns:

```
┌─────────────────────────────────────┐
│  RECOMMENDED OFFER                   │
│                                       │
│  28% OFF · Code: AIZMT4              │
│                                       │
│  "Hi Priya! We miss you 💙           │
│   Enjoy 28% OFF your next pick..."   │
│                                       │
│  + 2 alternative offers to compare   │
└─────────────────────────────────────┘
```

<br/>

### 📨 &nbsp; Campaign Launch & Live Delivery Feed

Launch → personalized messages generated for every customer (batched 20-at-a-time through Groq, not one call per customer) → watch them move through the funnel **in real time**:

```
sent  ──────►  delivered  ──────►  opened  ──────►  clicked
 ●               ●                   ●                ○
 998             746                 458              158
100%             75%                 61%              34%
```

Revenue attributed within a **72-hour window**.

<br/>

### 📊 &nbsp; Growth Engine

Aggregate funnel + per-campaign ROI table, plus the showcase feature:

<table>
<tr>
<td width="60%" valign="top">

#### 🗣️ "Ask KIN Anything"

```
You:  "What do Tier 3 women prefer?"

KIN:  Tier 3 women generated ₹8.2L
      this quarter, driven mainly by
      clothing (61%) and accessories.
      They respond strongly to festive
      and discount-led messaging.

      Recommendation: Launch a
      weekend WhatsApp offer
      targeting clothing buyers.
```

</td>
<td width="40%" valign="top">

#### ⚙️ How it works

1. Question → Groq → structured query params
2. Params → real Prisma query → actual rows
3. Rows → Groq → insight + campaign suggestion

**Every number in the answer came from the database. Always.**

</td>
</tr>
</table>

<br/>

### ⚡ &nbsp; Automations

| Trigger | Fires when |
|:---|:---|
| 🛒 **Abandoned Cart** | Items added, no checkout |
| ⭐ **Points Earned** | Purchase detected → redeem nudge |
| 🎉 **Special Occasion** | Birthday or festival window |

<br/>

---

<br/>

## 🏗️ Architecture

```
                    ┌─────────────────────┐
                    │      Next.js          │
                    │   (Vercel · UI)        │
                    └──────────┬──────────┘
                               │  HTTP
                    ┌──────────▼──────────┐
                    │     Express API       │
                    │   (Render · Logic)     │
                    └──────────┬──────────┘
                    ┌──────────┴──────────┐
                    │                       │
          ┌─────────▼────────┐   ┌────────▼─────────┐
          │   PostgreSQL        │   │   Groq LLaMA 3.3   │
          │   (Neon · Prisma)   │   │   (narration only)  │
          │                     │   │                     │
          │  ✓ Segment sizes    │   │  ✓ Explains numbers │
          │  ✓ Revenue figures  │   │  ✗ Never invents     │
          │  ✓ All real numbers │   │    numbers           │
          └─────────────────────┘   └─────────────────────┘
```

Two independently deployable services. The AI layer is **thin and replaceable** — swap Groq for OpenAI, Claude, or a local model without touching a single query or changing what the UI shows.

<br/>

---

<br/>

## 🧰 Tech Stack

<div align="center">

<img src="https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=next.js&logoColor=white" />
<img src="https://img.shields.io/badge/TailwindCSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
<img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white" />
<img src="https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white" />
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" />
<img src="https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white" />
<img src="https://img.shields.io/badge/Neon-00E599?style=flat-square&logo=neon&logoColor=white" />
<img src="https://img.shields.io/badge/Groq-F55036?style=flat-square&logoColor=white" />
<img src="https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white" />
<img src="https://img.shields.io/badge/Render-46E3B7?style=flat-square&logo=render&logoColor=white" />

</div>

<br/>

---

<br/>

## ⚙️ Running Locally

<table>
<tr>
<td width="50%" valign="top">

**Backend**
```bash
cd server
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
```
→ `localhost:3001`

</td>
<td width="50%" valign="top">

**Frontend**
```bash
cd client
npm install
npm run dev
```
→ `localhost:3000`

</td>
</tr>
</table>

Set `DATABASE_URL`, `GROQ_API_KEY`, and `NEXT_PUBLIC_API_URL` in `.env` files for each service.

<br/>

---

<br/>

<div align="center">

## 🎯 The One-Line Pitch

<br/>

```
┌────────────────────────────────────────────────────┐
│                                                      │
│   Every number on screen came from PostgreSQL.      │
│   Every sentence explaining it came from AI.        │
│                                                      │
│   That boundary never blurs.                        │
│                                                      │
└────────────────────────────────────────────────────┘
```

<br/>

[![Demo](https://img.shields.io/badge/🚀_Try_the_Live_Demo-2563EB?style=for-the-badge&logoColor=white)](https://kin-crm-snowy.vercel.app/opportunities)

</div>
