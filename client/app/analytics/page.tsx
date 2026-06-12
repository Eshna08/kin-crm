'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, fmt, channelMeta, type Summary, type AskResult, type Segment, type ChannelStat, type PeakHours } from '../../lib/api';

interface GeoTier { tierNum: number; label: string; cities: string[]; revenue: number; customers: number; topCategory: string; }
const CITY: Record<number, string[]> = { 1: ['Mumbai', 'Delhi', 'Bangalore'], 2: ['Jaipur', 'Surat', 'Lucknow'], 3: ['Aligarh', 'Siliguri', 'Bhilai'] };

const EXAMPLES = [
  'What do Tier 3 women prefer?',
  'Which channel converts best?',
  'Best campaign for this weekend?',
];

// Pick the leading channel by a given metric.
function channelTop(channels: ChannelStat[] | null, by: 'estRevenue' | 'clickRate' | 'openRate'): ChannelStat | null {
  if (!channels || channels.length === 0) return null;
  return [...channels].sort((a, b) => b[by] - a[by])[0];
}
const chLabel = (c: ChannelStat | null) => (c ? channelMeta[c.channel]?.label ?? c.channel : '');
const chColor = (c: ChannelStat | null) => (c ? channelMeta[c.channel]?.color ?? '#94a3b8' : '#94a3b8');

export default function GrowthEnginePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [tiers, setTiers] = useState<GeoTier[] | null>(null);
  const [brief, setBrief] = useState<AskResult | null>(null);
  const [channels, setChannels] = useState<ChannelStat[] | null>(null);
  const [peak, setPeak] = useState<PeakHours | null>(null);
  const [error, setError] = useState<string | null>(null);
  const askRef = useRef<HTMLDivElement | null>(null);

  // Fire all data calls in parallel — each section reveals as its data arrives.
  useEffect(() => {
    document.title = 'Growth Engine · KIN';
    api.getSummary().then(setSummary).catch((e) => setError(e.message));
    api.getSegments().then(setSegments).catch(() => setSegments([]));
    api.ask('Give me an executive summary of campaign performance and top revenue opportunity').then(setBrief).catch(() => setBrief(null));
    api.getChannelStats().then(setChannels).catch(() => setChannels([]));
    api.getPeakHours().then(setPeak).catch(() => setPeak(null));
    (async () => {
      try {
        const [rev, cust] = await Promise.all([
          api.getInsight({ groupBy: ['tier'], metric: 'total_revenue', filters: {} }),
          api.getInsight({ groupBy: ['tier'], metric: 'count', filters: {} }),
        ]);
        const cats = await Promise.all([1, 2, 3].map((t) => api.getInsight({ groupBy: ['category'], metric: 'count', filters: { tier: t } }).catch(() => null)));
        setTiers([1, 2, 3].map((t, i) => ({
          tierNum: t,
          label: `Tier ${t}`,
          cities: CITY[t],
          revenue: rev.rows.find((r) => r.group === `Tier ${t}`)?.value ?? 0,
          customers: cust.rows.find((r) => r.group === `Tier ${t}`)?.value ?? 0,
          topCategory: cats[i]?.rows[0]?.group ?? '—',
        })));
      } catch { setTiers([]); }
    })();
  }, []);

  const scrollToAsk = () => askRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="kin-fade">
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>Growth Engine</h1>
        <p style={{ color: '#64748b', marginTop: 6, fontSize: '0.95rem' }}>Your AI growth command center — what needs attention, and what to do next.</p>
      </header>

      {error && <div style={errorBox}>Couldn&apos;t load analytics: {error}. Is the server running on <code>{process.env.NEXT_PUBLIC_API_URL}</code>?</div>}

      <ExecutiveBriefing brief={brief} channels={channels} />
      <RevenueHero summary={summary} channels={channels} />

      <div style={{ display: 'grid', gridTemplateColumns: '55fr 45fr', gap: 18, marginBottom: 22 }}>
        <HealthCard segments={segments} tiers={tiers} channels={channels} />
        <FunnelCard summary={summary} channels={channels} />
      </div>

      <ChannelInsights channels={channels} peak={peak} />

      <Geographic tiers={tiers} channels={channels} onCta={scrollToAsk} />
      <CampaignTable summary={summary} channels={channels} />

      <div ref={askRef} style={{ scrollMarginTop: 80 }}><AskKin /></div>
    </div>
  );
}

/* ── Count-up ───────────────────────────────────────────────────── */
function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1000;
    const tick = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      setN(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setN(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(n)}</>;
}

/* ── SECTION 1 — Executive briefing ─────────────────────────────── */
function ExecutiveBriefing({ brief, channels }: { brief: AskResult | null; channels: ChannelStat[] | null }) {
  const [launched, setLaunched] = useState(false);
  const topCh = channelTop(channels, 'estRevenue');
  async function launch() {
    if (!brief) return;
    try {
      const voucher = 'AI' + Math.random().toString(36).slice(2, 6).toUpperCase();
      await api.launchCampaign({ segmentType: 'dormant_buyers', segmentSize: 50, offerType: brief.offer_type, discount: 20, voucherCode: voucher });
      setLaunched(true);
    } catch (e) { alert('Launch failed: ' + (e as Error).message); }
  }

  return (
    <div style={{ background: 'white', border: '1px solid #e8eefb', borderRadius: 16, padding: 32, marginBottom: 22, display: 'grid', gridTemplateColumns: '60fr 40fr', gap: 28, position: 'relative', overflow: 'hidden', boxShadow: '0 8px 30px rgba(27,110,243,0.08)' }}>
      {/* Left */}
      <div>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', color: '#2563EB', fontWeight: 700 }}>AI EXECUTIVE BRIEFING</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '8px 0 16px', color: '#0f172a' }}>Here&apos;s what needs your attention today.</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {['Revenue ↑ 18%', 'Dormant customers ↑ 8%', 'Tier 2 leading all tiers'].map((p) => (
            <span key={p} style={{ background: '#EFF6FF', color: '#2563EB', fontSize: '0.8rem', fontWeight: 700, padding: '6px 12px', borderRadius: 6 }}>{p}</span>
          ))}
          {topCh && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${chColor(topCh)}14`, color: chColor(topCh), fontSize: '0.8rem', fontWeight: 700, padding: '6px 12px', borderRadius: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: chColor(topCh) }} />{chLabel(topCh)} leads · {fmt.inrShort(topCh.estRevenue)}
            </span>
          )}
        </div>
        {brief ? (
          <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: '#475569', margin: 0, maxWidth: 560 }} className="kin-slide">{brief.insight}</p>
        ) : (
          <div className="kin-skeleton" style={{ height: 44, width: '90%' }} />
        )}
      </div>

      {/* Right — Top Opportunity */}
      <div style={{ position: 'relative', background: 'linear-gradient(140deg, #1b6ef3, #4f46e5)', borderRadius: 14, padding: 24, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: -30, background: 'radial-gradient(circle at 75% 25%, rgba(255,255,255,0.18), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.08em', color: '#c7d2fe', fontWeight: 700 }}>TOP OPPORTUNITY</div>
          {brief ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'white', margin: '8px 0 2px', lineHeight: 1.25 }}>{brief.campaign_name || 'Win Back Dormant Buyers'}</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 18 }}>398 Customers</div>
              <div style={{ display: 'flex', gap: 28, marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.65)', fontWeight: 700 }}>EXPECTED REVENUE</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'white', marginTop: 3 }}>{brief.expected_revenue}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.65)', fontWeight: 700 }}>CONFIDENCE</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#4ADE80', marginTop: 3 }}>92%</div>
                </div>
              </div>
              {launched ? (
                <Link href="/campaigns" style={{ ...whiteBtn, textDecoration: 'none' }}>View in Campaigns &rarr;</Link>
              ) : (
                <button onClick={launch} className="kin-btn" style={whiteBtn}>Launch Campaign &rarr;</button>
              )}
            </>
          ) : (
            <>
              <div className="kin-skeleton" style={{ height: 22, width: 180, margin: '10px 0', background: 'linear-gradient(90deg,rgba(255,255,255,0.18) 25%,rgba(255,255,255,0.32) 50%,rgba(255,255,255,0.18) 75%)', backgroundSize: '840px 100%' }} />
              <div className="kin-skeleton" style={{ height: 40, width: '70%', marginBottom: 16, background: 'linear-gradient(90deg,rgba(255,255,255,0.18) 25%,rgba(255,255,255,0.32) 50%,rgba(255,255,255,0.18) 75%)', backgroundSize: '840px 100%' }} />
              <div className="kin-skeleton" style={{ height: 40, width: '100%', background: 'linear-gradient(90deg,rgba(255,255,255,0.18) 25%,rgba(255,255,255,0.32) 50%,rgba(255,255,255,0.18) 75%)', backgroundSize: '840px 100%' }} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Channel performance (WhatsApp / Email / SMS) ───────────────── */
function ChannelInsights({ channels, peak }: { channels: ChannelStat[] | null; peak: PeakHours | null }) {
  const recByCh: Record<string, number> = {};
  peak?.recommendations.forEach((r) => { recByCh[r.channel] = r.hour; });
  const order = ['whatsapp', 'email', 'sms'];

  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 2px' }}>Channel Performance</h3>
      <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 14px' }}>How WhatsApp, Email and SMS deliver, engage and convert</p>

      {channels && channels.length > 0 && (() => {
        const top = channelTop(channels, 'estRevenue');
        if (!top) return null;
        const m = channelMeta[top.channel] ?? { label: top.channel, color: '#16a34a' };
        return (
          <div style={{ background: 'white', border: '1px solid #eef2f7', borderLeft: '4px solid #2563EB', borderRadius: 14, padding: 24, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.06em', color: '#2563EB', fontWeight: 700 }}>🏆 BEST PERFORMING CHANNEL</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', margin: '6px 0 4px' }}>{m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1b6ef3', marginBottom: 10 }}>{fmt.inrShort(top.estRevenue)}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, background: '#DCFCE7', color: '#16A34A', padding: '4px 12px', borderRadius: 999 }}>Open Rate {top.openRate}%</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, background: '#DBEAFE', color: '#2563EB', padding: '4px 12px', borderRadius: 999 }}>CTR {top.clickRate}%</span>
              </div>
            </div>
            <div style={{ width: 72, height: 72, borderRadius: 18, background: `linear-gradient(140deg, ${m.color}, ${m.color}bb)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 30, fontWeight: 800, flexShrink: 0, boxShadow: `0 8px 20px ${m.color}55` }}>{m.label.charAt(0)}</div>
          </div>
        );
      })()}

      {!channels ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[0, 1, 2].map((i) => <div key={i} style={card}><SkeletonRows n={5} /></div>)}
        </div>
      ) : channels.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem', padding: 28 }}>Simulate a campaign to see channel performance.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {order.map((ch) => {
            const c = channels.find((x) => x.channel === ch);
            const m = channelMeta[ch] ?? { label: ch, color: '#94a3b8' };
            const best = recByCh[ch];
            if (!c) {
              return (
                <div key={ch} style={{ ...card, opacity: 0.6 }}>
                  <div style={{ fontWeight: 800, color: m.color }}>{m.label}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: 12 }}>No sends yet on this channel.</div>
                </div>
              );
            }
            return (
              <div key={ch} className="kin-card" style={{ ...card, borderTop: `3px solid ${m.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: m.color }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: m.color }} />{m.label}
                  </span>
                  {best != null && <span style={{ fontSize: '0.72rem', fontWeight: 700, color: m.color, background: `${m.color}14`, padding: '3px 9px', borderRadius: 999 }}>Best {fmt.hour(best)}</span>}
                </div>
                <ChannelRow label="Sent" value={fmt.num(c.sent)} />
                <ChannelRow label="Delivered" value={fmt.num(c.delivered)} />
                <ChannelRow label="Open rate" value={`${c.openRate}%`} />
                <ChannelRow label="Click rate" value={`${c.clickRate}%`} />
                <ChannelRow label="Est. revenue" value={fmt.inrShort(c.estRevenue)} accent="#16a34a" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChannelRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', padding: '6px 0', borderBottom: '1px solid #f5f7fa' }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ fontWeight: 700, color: accent ?? '#0f172a' }}>{value}</span>
    </div>
  );
}

/* ── SECTION 2 — Revenue hero KPIs ──────────────────────────────── */
function RevenueHero({ summary, channels }: { summary: Summary | null; channels: ChannelStat[] | null }) {
  const s = summary;
  const deliveryRate = s ? fmt.pct(s.totalDelivered, s.totalSent) : '0%';
  const openedRate = s ? fmt.pct(s.totalOpened, s.totalDelivered) : '0%';
  const clickedRate = s ? fmt.pct(s.totalClicked, s.totalOpened) : '0%';

  const cols = [
    { label: 'TOTAL REVENUE OPPORTUNITY', value: s?.totalRevenue ?? 0, fmtV: (n: number) => fmt.inrShort(n), sub: 'across all active campaigns', color: '#2563EB' },
    { label: 'MESSAGES SENT', value: s?.totalSent ?? 0, fmtV: (n: number) => fmt.num(Math.round(n)), sub: `delivery rate ${deliveryRate}`, color: '#0f172a' },
    { label: 'OPENED', value: s?.totalOpened ?? 0, fmtV: (n: number) => fmt.num(Math.round(n)), sub: `${openedRate} of delivered`, color: '#f59e0b' },
    { label: 'CLICKED', value: s?.totalClicked ?? 0, fmtV: (n: number) => fmt.num(Math.round(n)), sub: `${clickedRate} of opened`, color: '#16a34a' },
  ];

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 32, marginBottom: 22, border: '1px solid #eef2f7', borderLeft: '4px solid #2563EB', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
        {cols.map((c, i) => (
          <div key={c.label} style={{ padding: '0 24px', borderLeft: i === 0 ? 'none' : '1px solid #eef2f7' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', color: '#94a3b8', fontWeight: 700 }}>{c.label}</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: c.color, lineHeight: 1.1, margin: '8px 0 4px', letterSpacing: '-0.02em' }}>
              {s ? <CountUp value={c.value} format={c.fmtV} /> : <span className="kin-skeleton" style={{ display: 'inline-block', height: 36, width: 90, verticalAlign: 'middle' }} />}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{c.sub}</div>
          </div>
        ))}
      </div>
      {channels && channels.length > 0 && <ChannelSplitBar channels={channels} />}
    </div>
  );
}

function ChannelSplitBar({ channels }: { channels: ChannelStat[] }) {
  const segs = [...channels].filter((c) => c.estRevenue > 0).sort((a, b) => b.estRevenue - a.estRevenue);
  const total = segs.reduce((s, c) => s + c.estRevenue, 0) || 1;
  if (segs.length === 0) return null;
  return (
    <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid #eef2f7' }}>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>REVENUE BY CHANNEL</div>
      <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', background: '#f1f5f9' }}>
        {segs.map((c) => (
          <div key={c.channel} title={`${chLabel(c)} · ${fmt.inrShort(c.estRevenue)}`} style={{ width: `${(c.estRevenue / total) * 100}%`, background: channelMeta[c.channel]?.color ?? '#94a3b8' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10 }}>
        {segs.map((c) => (
          <span key={c.channel} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8rem', color: '#475569' }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: channelMeta[c.channel]?.color ?? '#94a3b8' }} />
            {chLabel(c)} <strong>{fmt.inrShort(c.estRevenue)}</strong>
            <span style={{ color: '#94a3b8' }}>{Math.round((c.estRevenue / total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── SECTION 3a — Customer health ───────────────────────────────── */
function HealthCard({ segments, tiers }: { segments: Segment[] | null; tiers: GeoTier[] | null; channels: ChannelStat[] | null }) {
  if (!segments) {
    return <div style={card}><h3 style={cardTitle}>Customer Health</h3><SkeletonRows n={3} /></div>;
  }
  const sg = (k: string) => segments.find((s) => s.segmentType === k);
  const critical = sg('dormant_buyers')?.count ?? 0;
  const atRisk = sg('high_value_lapsed')?.count ?? 0;
  const total = tiers && tiers.length ? tiers.reduce((s, t) => s + t.customers, 0) : 1200;
  const healthy = Math.max(total - critical - atRisk, 0);
  const avgOV = sg('high_value_lapsed')?.avgOrderValue ?? sg('dormant_buyers')?.avgOrderValue ?? 2000;
  const recovery = Math.round(atRisk * avgOV * 0.15);
  const atRiskPct = total ? Math.round((atRisk / total) * 100) : 0;

  const rows = [
    { label: 'Healthy', value: healthy, color: '#16a34a', bg: '#dcfce7' },
    { label: 'At Risk', value: atRisk, color: '#d97706', bg: '#fef3c7' },
    { label: 'Critical', value: critical, color: '#dc2626', bg: '#fee2e2' },
  ];

  return (
    <div style={card}>
      <h3 style={cardTitle}>Customer Health</h3>
      <p style={cardSub}>Based on purchase recency across {fmt.num(total)} customers</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 14 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px', borderBottom: '1px solid #f5f7fa' }}>
            <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#334155', width: 90 }}>{r.label}</span>
            <span style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0f172a', flex: 1 }}>{fmt.num(r.value)}</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: r.color, background: r.bg, padding: '4px 12px', borderRadius: 999 }}>{total ? Math.round((r.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, background: '#FFF7ED', color: '#92400E', borderLeft: '3px solid #D97706', borderRadius: '0 8px 8px 0', padding: '12px 16px', fontSize: '0.86rem', lineHeight: 1.5 }}>
        {atRiskPct}% of customers are at risk. Potential recovery: <strong>{fmt.inrShort(recovery)}</strong>.
      </div>
    </div>
  );
}

/* ── SECTION 3b — Conversion funnel ─────────────────────────────── */
function FunnelCard({ summary }: { summary: Summary | null; channels: ChannelStat[] | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(id); }, []);

  if (!summary) return <div style={card}><h3 style={cardTitle}>Delivery Funnel</h3><SkeletonRows n={4} /></div>;

  const s = summary;
  const stages = [
    { label: 'Sent', value: s.totalSent, color: '#3b82f6' },
    { label: 'Delivered', value: s.totalDelivered, color: '#6366f1' },
    { label: 'Opened', value: s.totalOpened, color: '#f59e0b' },
    { label: 'Clicked', value: s.totalClicked, color: '#22c55e' },
  ];
  const max = Math.max(s.totalSent, 1);

  return (
    <div style={card}>
      <h3 style={cardTitle}>Delivery Funnel</h3>
      <p style={cardSub}>Where customers drop off, stage by stage</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {stages.map((st, i) => {
          const widthPct = st.value > 0 ? Math.max((st.value / max) * 100, 7) : 2;
          const drop = i === 0 ? 100 : stages[i - 1].value ? Math.round((st.value / stages[i - 1].value) * 100) : 0;
          const inside = widthPct > 26;
          const labelTxt = `${fmt.num(st.value)} · ${drop}%`;
          return (
            <div key={st.label}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: 5 }}>{st.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 8, height: 30, overflow: 'hidden' }}>
                  <div style={{ width: mounted ? `${widthPct}%` : '0%', height: '100%', background: st.color, borderRadius: 8, transition: `width 0.7s ease ${i * 0.2}s`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10 }}>
                    {inside && <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>{labelTxt}</span>}
                  </div>
                </div>
                {!inside && <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', minWidth: 70, textAlign: 'right' }}>{labelTxt}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── SECTION 4 — Geographic intelligence ────────────────────────── */
function Geographic({ tiers, channels, onCta }: { tiers: GeoTier[] | null; channels: ChannelStat[] | null; onCta: () => void }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 2px' }}>Geographic Intelligence</h3>
      <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 14px' }}>Revenue and behaviour by city tier</p>
      {!tiers ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[0, 1, 2].map((i) => <div key={i} style={card}><SkeletonRows n={4} /></div>)}
        </div>
      ) : (
        <GeoCards tiers={tiers} channels={channels} onCta={onCta} />
      )}
    </div>
  );
}

function GeoCards({ tiers, onCta }: { tiers: GeoTier[]; channels: ChannelStat[] | null; onCta: () => void }) {
  const maxRev = Math.max(...tiers.map((t) => t.revenue), 0);
  const ranked = [...tiers].sort((a, b) => b.revenue - a.revenue);
  const lineFor = (t: GeoTier) => {
    const rank = ranked.findIndex((x) => x.tierNum === t.tierNum);
    return rank === 0 ? 'Focus here.' : rank === 1 ? 'Secondary market' : 'Growth potential';
  };
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {tiers.map((t) => {
          const winner = t.revenue === maxRev && maxRev > 0;
          return (
            <div key={t.tierNum} className="kin-card" style={{ ...card, padding: 0, overflow: 'hidden', border: winner ? '2px solid #2563EB' : '1px solid #E2E8F0', background: winner ? '#EFF6FF' : 'white' }}>
              {winner && <div style={{ background: '#2563EB1a', color: '#2563EB', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', padding: '7px 18px' }}>🏆 HIGHEST REVENUE</div>}
              <div style={{ padding: 20 }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{t.label} Cities</div>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 2 }}>{t.cities.join(', ')}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#2563EB', margin: '14px 0 2px' }}>{fmt.inrShort(t.revenue)}</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{fmt.num(t.customers)} customers</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Top category:</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#7c3aed', background: '#ede9fe', padding: '3px 10px', borderRadius: 999, textTransform: 'capitalize' }}>{t.topCategory}</span>
                </div>
                <div style={{ marginTop: 14, fontSize: '0.84rem', fontWeight: 700, color: winner ? '#2563EB' : '#64748b' }}>{lineFor(t)}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ ...card, marginTop: 16, borderLeft: '4px solid #2563EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.9rem', color: '#475569' }}>Want to act on the leading tier? Ask KIN to draft a targeted campaign.</span>
        <button onClick={onCta} className="kin-btn" style={primaryBtn}>Open Ask KIN &rarr;</button>
      </div>
    </>
  );
}

/* ── SECTION 5 — Campaign table ─────────────────────────────────── */
function CampaignTable({ summary, channels }: { summary: Summary | null; channels: ChannelStat[] | null }) {
  if (!summary) return <div style={{ ...card, marginBottom: 22 }}><h3 style={cardTitle}>Campaign Performance</h3><SkeletonRows n={4} /></div>;
  // Collapse duplicate segmentTypes (keep latest = first, since list is createdAt desc), then sort by revenue desc.
  const seen = new Set<string>();
  const collapsed = summary.campaigns.filter((c) => { if (seen.has(c.segmentType)) return false; seen.add(c.segmentType); return true; });
  const rows = [...collapsed].sort((a, b) => b.revenue - a.revenue);
  const topId = rows[0]?.id;

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 22 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#475569' }}>Campaign Performance</h3>
        <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>Latest per segment, ranked by revenue</p>
        {channels && channels.filter((c) => c.estRevenue > 0).length > 0 && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
            {channels.filter((c) => c.estRevenue > 0).map((c) => (
              <span key={c.channel} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: '#64748b' }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: channelMeta[c.channel]?.color ?? '#94a3b8' }} />
                {channelMeta[c.channel]?.label ?? c.channel} <strong style={{ color: '#16a34a' }}>{fmt.inrShort(c.estRevenue)}</strong>
              </span>
            ))}
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>No campaigns yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', minWidth: 720 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#64748b' }}>
                {['Campaign', 'Sent', 'Delivered', 'Opened', 'Clicked', 'Revenue', 'ROI'].map((h) => (
                  <th key={h} style={{ padding: '11px 16px', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em', position: 'sticky', top: 0, background: '#f8fafc' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const roi = c.sentCount > 0 ? c.revenue / (c.sentCount * 2) : 0;
                return (
                  <tr key={c.id} className="kin-trow" style={{ borderTop: '1px solid #f4f6fa' }}>
                    <td style={{ ...tdc, fontWeight: 600 }}>
                      {c.name}
                      {c.id === topId && <span style={{ marginLeft: 8, fontSize: '0.68rem', fontWeight: 800, color: '#2563EB', background: '#EFF6FF', padding: '2px 8px', borderRadius: 999 }}>TOP PERFORMER</span>}
                    </td>
                    <td style={tdc}>{fmt.num(c.sentCount)}</td>
                    <td style={tdc}>{fmt.num(c.deliveredCount)}</td>
                    <td style={tdc}>{fmt.num(c.openedCount)}</td>
                    <td style={tdc}>{fmt.num(c.clickedCount)}</td>
                    <td style={{ ...tdc, color: '#16a34a', fontWeight: 700 }}>{fmt.inrShort(c.revenue)}</td>
                    <td style={tdc}><span style={{ fontWeight: 800, color: roi >= 1 ? '#16a34a' : '#64748b', background: roi >= 1 ? '#dcfce7' : '#f1f5f9', padding: '3px 9px', borderRadius: 7 }}>{roi.toFixed(1)}x</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── SECTION 6 — Ask KIN ────────────────────────────────────────── */
function AskKin() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<AskResult | null>(null);
  const [launched, setLaunched] = useState(false);
  const [focus, setFocus] = useState(false);

  async function ask(question?: string) {
    const query = (question ?? q).trim();
    if (!query) return;
    setQ(query); setLoading(true); setRes(null); setLaunched(false);
    try { setRes(await api.ask(query)); }
    catch (e) { alert('Ask failed: ' + (e as Error).message); }
    finally { setLoading(false); }
  }
  async function launch() {
    if (!res) return;
    try {
      const voucher = 'AI' + Math.random().toString(36).slice(2, 6).toUpperCase();
      await api.launchCampaign({ segmentType: 'dormant_buyers', segmentSize: 50, offerType: res.offer_type, discount: 20, voucherCode: voucher });
      setLaunched(true);
    } catch (e) { alert('Launch failed: ' + (e as Error).message); }
  }

  return (
    <div style={{ ...card, padding: 48, backgroundImage: 'radial-gradient(circle at 0% 0%, rgba(37,99,235,0.10), transparent 40%), radial-gradient(circle, #eef2f7 1px, transparent 1px)', backgroundSize: 'auto, 22px 22px' }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800 }}>Ask KIN Anything</h3>
      <p style={{ color: '#64748b', fontSize: '0.92rem', margin: '0 0 18px' }}>Natural language → live database query → campaign recommendation. No dashboards to configure.</p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => setQ(ex)} style={{ height: 36, border: '1px solid #2563EB', color: '#2563EB', background: 'white', borderRadius: 999, padding: '0 16px', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s ease' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#EFF6FF')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'white')}>
            {ex}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="Type your question or pick one above..."
          style={{ flex: 1, height: 56, padding: '0 18px', borderRadius: 12, border: `1px solid ${focus ? '#2563EB' : '#E2E8F0'}`, fontSize: '0.98rem', outline: 'none', background: 'white', transition: 'border-color 0.15s ease' }}
        />
        <button onClick={() => ask()} disabled={loading} className="kin-btn" style={{ height: 56, padding: '0 32px', background: '#2563EB', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading ? 'Asking…' : 'Ask'}
        </button>
      </div>

      {(loading || res) && (
        <div className="kin-slide" style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '55fr 45fr', gap: 18 }}>
          {/* Left — KIN Analysis (chat style) */}
          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
              <span style={{ width: 20, height: 20, borderRadius: 999, background: '#2563EB', color: 'white', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>K</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>KIN Analysis</span>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>just now</span>
            </div>
            {loading ? (
              <div className="kin-typing" style={{ padding: '6px 2px' }}><span /><span /><span /></div>
            ) : res ? (
              <>
                <p style={{ margin: 0, fontSize: 15, color: '#334155', lineHeight: 1.7 }}>{renderInsight(res.insight)}</p>
                <div style={{ marginTop: 14, fontSize: 13, color: '#0f172a' }}>
                  <strong>Recommendation:</strong> <span style={{ fontStyle: 'italic', color: '#2563EB' }}>{res.campaign_name}{res.offer_type ? ` — ${res.offer_type}` : ''}</span>
                </div>
              </>
            ) : null}
          </div>

          {/* Right — Campaign Action */}
          <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', color: '#64748B', fontWeight: 700, marginBottom: 8 }}>RECOMMENDED ACTION</div>
            {res ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{res.campaign_name}</h4>
                  <span style={{ background: '#ede9fe', color: '#7c3aed', fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}>{res.offer_type}</span>
                </div>
                <div style={{ background: '#F8FAFC', borderLeft: '3px solid #25D366', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#334155', lineHeight: 1.5, marginBottom: 12 }}>{res.whatsapp_copy}</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Expected revenue</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#16A34A', marginBottom: 12 }}>{res.expected_revenue}</div>
                {launched ? (
                  <Link href="/campaigns" style={{ ...primaryBtn, width: '100%', textDecoration: 'none' }}>View in Campaigns &rarr;</Link>
                ) : (
                  <button onClick={launch} className="kin-btn" style={{ ...primaryBtn, width: '100%' }}>Launch Campaign &rarr;</button>
                )}
                <div style={{ textAlign: 'center', fontSize: 11, color: '#94A3B8', marginTop: 10 }}>Powered by KIN × Groq</div>
              </>
            ) : (
              <SkeletonRows n={5} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Render insight prose, highlighting numbers inline.
function renderInsight(text: string) {
  const parts = text.split(/(₹?\d[\d,.]*\s?(?:L|Cr|K|%)?)/g);
  return parts.map((p, i) => (/\d/.test(p) ? <span key={i} style={{ color: '#2563EB', fontWeight: 700 }}>{p}</span> : <span key={i}>{p}</span>));
}

/* ── Shared ─────────────────────────────────────────────────────── */
function SkeletonRows({ n }: { n: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
      {Array.from({ length: n }).map((_, i) => <div key={i} className="kin-skeleton" style={{ height: 22, width: `${90 - i * 8}%` }} />)}
    </div>
  );
}

const card: React.CSSProperties = { background: 'white', border: '1px solid #eef2f7', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' };
const cardTitle: React.CSSProperties = { margin: 0, fontSize: '1.05rem', fontWeight: 700 };
const cardSub: React.CSSProperties = { color: '#64748b', fontSize: '0.82rem', margin: '4px 0 0' };
const errorBox: React.CSSProperties = { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 16, borderRadius: 12, fontSize: '0.9rem', marginBottom: 16 };
const primaryBtn: React.CSSProperties = { background: '#2563EB', color: 'white', border: 'none', borderRadius: 10, padding: '11px 18px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const darkBtn: React.CSSProperties = { width: '100%', height: 40, background: '#2563EB', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const whiteBtn: React.CSSProperties = { width: '100%', height: 40, background: 'white', color: '#1b6ef3', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const tdc: React.CSSProperties = { padding: '11px 16px', whiteSpace: 'nowrap' };
