const API = process.env.NEXT_PUBLIC_API_URL || '';

// ── Types ─────────────────────────────────────────────────────────
export interface Segment {
  segmentType: 'dormant_buyers' | 'high_value_lapsed' | 'one_time_buyers';
  label: string;
  count: number;
  avgDaysLapsed: number;
  avgOrderValue: number;
  potentialRevenue: number;
  reasons: string[];
}

export interface OfferAlternative {
  offerType: string;
  discount: number;
  whatsappMessage: string;
}

export interface Recommendation {
  offerType: string;
  discount: number;
  voucherCode: string;
  whatsappMessage: string;
  reasoning: string;
  alternatives: OfferAlternative[];
}

export interface SearchResult {
  query: string;
  filter: Record<string, unknown>;
  count: number;
  sample: {
    avgSpend: number;
    avgOrders: number;
    avgAge: number;
    topCities: { city: string; count: number }[];
    channelMix: { channel: string; count: number }[];
  };
}

export interface Campaign {
  id: string;
  name: string;
  segmentType: string;
  segmentSize: number;
  status: string;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  revenue: number;
  offerType: string | null;
  discount: number | null;
  voucherCode: string | null;
  createdAt: string;
}

export interface FeedItem {
  id: string;
  customerName: string;
  channel: string;
  message: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked';
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
}

export interface Summary {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalRevenue: number;
  campaigns: Campaign[];
}

export interface InsightResult {
  groupBy: string[];
  metric: string;
  filters: Record<string, unknown>;
  rows: { group: string; value: number; count: number }[];
}

export interface AskResult {
  question: string;
  query: { groupBy: string[]; metric: string; filters: Record<string, unknown> };
  rows: { group: string; value: number; count: number }[];
  insight: string;
  campaign_name: string;
  offer_type: string;
  whatsapp_copy: string;
  expected_revenue: string;
}

export interface ChannelStat {
  channel: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
  estRevenue: number;
}

export interface PeakHours {
  hourly: { hour: number; opens: number }[];
  recommendations: { channel: string; hour: number; opens: number }[];
}

export interface TriggerRule {
  id: string;
  name: string;
  eventType: string;
  isActive: boolean;
  firedCount: number;
  createdAt: string;
  lastFiredAt: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────
// Auto-retry on network errors / 500s (Neon cold-start) with a friendly
// "Waking up the database…" banner, before surfacing an error to the user.
const RETRIES = 3;
const RETRY_DELAY = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let bannerEl: HTMLDivElement | null = null;
let bannerCount = 0;
function showWakingBanner() {
  if (typeof document === 'undefined') return;
  bannerCount++;
  if (bannerEl) return;
  bannerEl = document.createElement('div');
  bannerEl.textContent = 'Waking up the database…';
  Object.assign(bannerEl.style, {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    background: '#0f172a', color: '#fff', padding: '10px 18px', borderRadius: '999px',
    fontSize: '13px', fontWeight: '600', zIndex: '9999', boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
  } as CSSStyleDeclaration);
  document.body.appendChild(bannerEl);
}
function hideWakingBanner() {
  if (typeof document === 'undefined') return;
  bannerCount = Math.max(0, bannerCount - 1);
  if (bannerCount === 0 && bannerEl) { bannerEl.remove(); bannerEl = null; }
}

async function doFetch(path: string, init?: RequestInit): Promise<Response> {
  let showing = false;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const r = await fetch(`${API}${path}`, init);
      // Retry server errors (cold DB usually returns 500); pass others through.
      if (r.status >= 500 && attempt < RETRIES) {
        if (!showing) { showWakingBanner(); showing = true; }
        await sleep(RETRY_DELAY);
        continue;
      }
      if (showing) hideWakingBanner();
      return r;
    } catch (err) {
      lastErr = err;
      if (attempt < RETRIES) {
        if (!showing) { showWakingBanner(); showing = true; }
        await sleep(RETRY_DELAY);
        continue;
      }
      if (showing) hideWakingBanner();
      throw lastErr;
    }
  }
  if (showing) hideWakingBanner();
  throw lastErr ?? new Error('Request failed');
}

async function get<T>(path: string): Promise<T> {
  const r = await doFetch(path);
  if (!r.ok) throw new Error(`GET ${path} failed (${r.status})`);
  return r.json();
}
async function post<T>(path: string, body?: unknown): Promise<T> {
  const r = await doFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) throw new Error(`POST ${path} failed (${r.status})`);
  return r.json();
}
async function patch<T>(path: string, body?: unknown): Promise<T> {
  const r = await doFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) throw new Error(`PATCH ${path} failed (${r.status})`);
  return r.json();
}

// ── API ───────────────────────────────────────────────────────────
export const api = {
  getSegments: () => get<Segment[]>('/api/opportunities/segments'),
  recommendOffer: (body: { segmentType: string; segmentSize: number; avgDaysLapsed: number; potentialRevenue: number }) =>
    post<Recommendation>('/api/opportunities/recommend', body),
  searchSegment: (query: string) => post<SearchResult>('/api/opportunities/search', { query }),

  getCampaigns: () => get<Campaign[]>('/api/campaigns'),
  launchCampaign: (body: { segmentType: string; segmentSize: number; offerType: string; discount: number; voucherCode: string; filter?: Record<string, unknown> }) =>
    post<{ campaignId: string; sentCount: number; name: string }>('/api/campaigns/launch', body),
  simulateCampaign: (id: string) => post<Campaign>(`/api/campaigns/${id}/simulate`),
  getFeed: (id: string) => get<FeedItem[]>(`/api/campaigns/${id}/feed`),

  getSummary: () => get<Summary>('/api/analytics/summary'),
  getChannelStats: () => get<ChannelStat[]>('/api/analytics/channels'),
  getPeakHours: () => get<PeakHours>('/api/analytics/peak-hours'),
  getInsight: (body: { groupBy: string[]; metric: string; filters?: Record<string, unknown> }) =>
    post<InsightResult>('/api/analytics/insight', body),
  ask: (question: string) => post<AskResult>('/api/analytics/ask', { question }),

  getRules: () => get<TriggerRule[]>('/api/triggers/rules'),
  toggleRule: (id: string, isActive: boolean) => patch<TriggerRule>(`/api/triggers/rules/${id}`, { isActive }),
  simulateTrigger: (eventType: string) =>
    post<{ event: unknown; rule: TriggerRule; customerName: string | null; campaignId: string | null }>('/api/triggers/simulate', { eventType }),
};

// ── Formatting ────────────────────────────────────────────────────
export const fmt = {
  inr: (n: number) => '₹' + Math.round(n).toLocaleString('en-IN'),
  inrShort: (n: number) => {
    if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
    if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
    if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K';
    return '₹' + Math.round(n);
  },
  pct: (num: number, den: number) => (den === 0 ? '0%' : Math.round((num / den) * 100) + '%'),
  num: (n: number) => n.toLocaleString('en-IN'),
  hour: (h: number) => {
    const isAm = h < 12;
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr} ${isAm ? 'AM' : 'PM'}`;
  },
};

export const channelMeta: Record<string, { label: string; color: string }> = {
  whatsapp: { label: 'WhatsApp', color: '#16a34a' },
  email: { label: 'Email', color: '#6366f1' },
  sms: { label: 'SMS', color: '#f59e0b' },
};

export const statusColor: Record<string, string> = {
  sent: '#3b82f6',
  delivered: '#6366f1',
  opened: '#f59e0b',
  clicked: '#22c55e',
};

export const eventLabel: Record<string, { label: string }> = {
  abandoned_cart: { label: 'Abandoned Cart' },
  browse_abandon: { label: 'Browse Abandon' },
  app_reengagement: { label: 'App Re-engagement' },
  post_purchase: { label: 'Post-Purchase' },
};
