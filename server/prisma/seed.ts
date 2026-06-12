import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { faker } from '@faker-js/faker/locale/en_IN';

const prisma = new PrismaClient();

// ── Config ────────────────────────────────────────────────────────
const TOTAL = 1200;

const CITIES: { city: string; tier: number }[] = [
  { city: 'Mumbai', tier: 1 }, { city: 'Delhi', tier: 1 }, { city: 'Bangalore', tier: 1 },
  { city: 'Jaipur', tier: 2 }, { city: 'Surat', tier: 2 }, { city: 'Lucknow', tier: 2 },
  { city: 'Aligarh', tier: 3 }, { city: 'Siliguri', tier: 3 }, { city: 'Bhilai', tier: 3 },
];

const CATEGORIES = ['clothing', 'shoes', 'accessories'] as const;
type Category = (typeof CATEGORIES)[number];

const DAY = 24 * 60 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────
const rint = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const rfloat = (min: number, max: number) => Math.random() * (max - min) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (d: number) => new Date(Date.now() - d * DAY);

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Preferred delivery channel — tier-skewed (tier 3 leans more on SMS, tier 1/2 on digital)
function pickChannel(tier: number): string {
  const r = Math.random();
  if (tier === 3) return r < 0.5 ? 'whatsapp' : r < 0.8 ? 'sms' : 'email';
  if (tier === 2) return r < 0.55 ? 'whatsapp' : r < 0.8 ? 'email' : 'sms';
  return r < 0.55 ? 'whatsapp' : r < 0.85 ? 'email' : 'sms';
}

// Amount ranges per category (₹)
function orderAmount(cat: Category): number {
  switch (cat) {
    case 'shoes': return Math.round(rfloat(1500, 8000));
    case 'clothing': return Math.round(rfloat(600, 4000));
    case 'accessories': return Math.round(rfloat(300, 3000));
  }
}

// ── Segment plan (counts sum to TOTAL) ────────────────────────────
type Segment = 'dormant' | 'high_value_lapsed' | 'one_time' | 'active';
const PLAN: { segment: Segment; count: number }[] = [
  { segment: 'dormant', count: 400 },
  { segment: 'high_value_lapsed', count: 200 },
  { segment: 'one_time', count: 450 },
  { segment: 'active', count: 150 },
];

// City list (≈360 tier-1, ≈420 tier-2, ≈420 tier-3)
function buildCityPool(): { city: string; tier: number }[] {
  const pool: { city: string; tier: number }[] = [];
  const perTier1 = 120; // 3 cities -> 360
  const perTier2 = 140; // 3 cities -> 420
  const perTier3 = 140; // 3 cities -> 420
  for (const c of CITIES) {
    const n = c.tier === 1 ? perTier1 : c.tier === 2 ? perTier2 : perTier3;
    for (let i = 0; i < n; i++) pool.push(c);
  }
  return shuffle(pool); // length 1200
}

interface BuiltCustomer {
  customer: Prisma.CustomerCreateManyInput;
  orders: Prisma.OrderCreateManyInput[];
}

function buildCustomer(id: string, segment: Segment, geo: { city: string; tier: number }): BuiltCustomer {
  const gender = Math.random() < 0.5 ? 'M' : 'F';
  const firstName = faker.person.firstName(gender === 'M' ? 'male' : 'female');
  const lastName = faker.person.lastName();
  const name = `${firstName} ${lastName}`;
  const age = rint(18, 60);
  const email = `${firstName}.${lastName}.${id}@example.com`.toLowerCase().replace(/[^a-z0-9.@]/g, '');
  const phone = '+9170' + faker.string.numeric(8);

  // Decide order count, amounts and lastPurchaseDate window per segment
  let orderCount: number;
  let lastPurchaseDays: number; // days ago for most recent order
  let amounts: number[] = [];
  const cats: Category[] = [];

  if (segment === 'dormant') {
    orderCount = rint(2, 4);
    lastPurchaseDays = rint(90, 365);
    for (let i = 0; i < orderCount; i++) { const c = pick(CATEGORIES); cats.push(c); amounts.push(Math.min(orderAmount(c), 3500)); }
    // keep total < 15000 so it doesn't collide with high-value segment
    let total = amounts.reduce((a, b) => a + b, 0);
    while (total >= 15000) { amounts = amounts.map((a) => Math.round(a * 0.8)); total = amounts.reduce((a, b) => a + b, 0); }
  } else if (segment === 'high_value_lapsed') {
    orderCount = rint(4, 5);
    lastPurchaseDays = rint(45, 88); // < 90 so it stays out of the dormant window
    for (let i = 0; i < orderCount; i++) { const c = pick(CATEGORIES); cats.push(c); amounts.push(Math.round(rfloat(4000, 9000))); }
    // ensure total >= 15000
    let total = amounts.reduce((a, b) => a + b, 0);
    if (total < 15000) amounts[0] += 15000 - total + 500;
  } else if (segment === 'one_time') {
    orderCount = 1;
    lastPurchaseDays = rint(31, 365);
    const c = pick(CATEGORIES); cats.push(c); amounts.push(Math.min(orderAmount(c), 12000));
  } else {
    // active / recent — excluded from every opportunity segment
    orderCount = rint(1, 5);
    lastPurchaseDays = rint(0, 29);
    for (let i = 0; i < orderCount; i++) { const c = pick(CATEGORIES); cats.push(c); amounts.push(orderAmount(c)); }
  }

  const totalSpend = amounts.reduce((a, b) => a + b, 0);
  const lastPurchaseDate = daysAgo(lastPurchaseDays);

  // Build orders. The most recent order sits at lastPurchaseDate; earlier ones spread before it.
  const orders: Prisma.OrderCreateManyInput[] = [];
  for (let i = 0; i < orderCount; i++) {
    const createdAt = i === 0 ? lastPurchaseDate : daysAgo(lastPurchaseDays + rint(20, 400));
    orders.push({ customerId: id, amount: amounts[i], category: cats[i], createdAt });
  }

  // createdAt for the customer = earliest order (or a bit before)
  const earliest = orders.reduce((min, o) => (o.createdAt! < min ? o.createdAt! : min), lastPurchaseDate as Date);

  const customer: Prisma.CustomerCreateManyInput = {
    id, name, email, phone,
    totalSpend, orderCount, lastPurchaseDate,
    city: geo.city, tier: geo.tier, gender, age,
    channel: pickChannel(geo.tier),
    createdAt: earliest,
  };

  return { customer, orders };
}

async function main() {
  console.log('🌱 Seeding KIN database…');

  // Clear transactional data (leave TriggerRule for the server to seed).
  await prisma.communication.deleteMany();
  await prisma.order.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.customer.deleteMany();

  const cityPool = buildCityPool();

  // Expand the plan into a flat, shuffled list of segments (length TOTAL).
  const segments: Segment[] = [];
  for (const p of PLAN) for (let i = 0; i < p.count; i++) segments.push(p.segment);
  while (segments.length < TOTAL) segments.push('active');
  shuffle(segments);

  const customers: Prisma.CustomerCreateManyInput[] = [];
  let orders: Prisma.OrderCreateManyInput[] = [];

  for (let i = 0; i < TOTAL; i++) {
    const built = buildCustomer(`cust_${i + 1}`, segments[i], cityPool[i]);
    customers.push(built.customer);
    orders.push(...built.orders);
  }

  // Insert customers (chunked) then orders (chunked).
  for (let i = 0; i < customers.length; i += 500) {
    await prisma.customer.createMany({ data: customers.slice(i, i + 500), skipDuplicates: true });
  }
  for (let i = 0; i < orders.length; i += 1000) {
    await prisma.order.createMany({ data: orders.slice(i, i + 1000) });
  }

  // Report the segment sizes the opportunity queries will actually see.
  const dormant = await prisma.customer.count({
    where: { orderCount: { gte: 2 }, lastPurchaseDate: { gte: daysAgo(365), lte: daysAgo(90) } },
  });
  const highValue = await prisma.customer.count({
    where: { totalSpend: { gte: 15000 }, lastPurchaseDate: { gte: daysAgo(180), lte: daysAgo(45) } },
  });
  const oneTime = await prisma.customer.count({
    where: { orderCount: 1, lastPurchaseDate: { lt: daysAgo(30) } },
  });

  console.log(`✅ Seeded ${customers.length} customers and ${orders.length} orders.`);
  console.log(`   Dormant buyers:      ${dormant}`);
  console.log(`   High-value lapsed:   ${highValue}`);
  console.log(`   One-time buyers:     ${oneTime}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
