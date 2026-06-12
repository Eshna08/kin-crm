'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, fmt, channelMeta, type Segment, type Recommendation, type SearchResult } from '../../lib/api';

const ACCENT: Record<string, string> = {
  dormant_buyers: '#1b6ef3',
  high_value_lapsed: '#7c3aed',
  one_time_buyers: '#0ea5e9',
};


export default function OpportunitiesPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Segment | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.getSegments()
      .then(setSegments)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="kin-fade">
      <LandingHero onExplore={() => contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />

      <div ref={contentRef} style={{ scrollMarginTop: 80 }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>Revenue Opportunities</h1>
        <p style={{ color: '#64748b', marginTop: 6, fontSize: '0.95rem' }}>
          AI-surfaced revenue segments — each with the reasoning behind it.
        </p>
      </header>

      {loading && <SkeletonCards />}
      {error && (
        <div style={errorBox}>
          Couldn&apos;t load segments: {error}. <br />
          Make sure the server is running on <code>{process.env.NEXT_PUBLIC_API_URL}</code>.
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
          {segments.map((s) => (
            <SegmentCard key={s.segmentType} seg={s} onClick={() => setActive(s)} />
          ))}
        </div>
      )}

      <SearchBox />
      </div>

      {active && <RecommendModal seg={active} onClose={() => setActive(null)} />}
    </div>
  );
}

/* ── Landing hero (animated, Xeno-style) ───────────────────────── */
function LandingHero({ onExplore }: { onExplore: () => void }) {
  const [count, setCount] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const target = 398;
    const start = performance.now();
    const dur = 1500;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      setCount(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % 4), 1500);
    return () => clearInterval(id);
  }, []);

  const rows = [
    { label: 'Recommended product', value: 'Relaxed Blazer', color: '#1b6ef3' },
    { label: 'Personalised offer', value: 'FLAT 15% OFF', color: '#7c3aed' },
    { label: 'Best channel', value: 'WhatsApp', color: '#16a34a' },
    { label: 'Best time', value: '9:00 PM', color: '#f59e0b' },
  ];

  return (
    <section
      style={{
        position: 'relative', overflow: 'hidden',
        width: '100vw', marginLeft: 'calc(50% - 50vw)', marginTop: -36, marginBottom: 40,
        minHeight: 'calc(100vh - 66px)',
        display: 'flex', alignItems: 'center',
        background: 'linear-gradient(180deg, #eaf1ff 0%, rgba(255,255,255,0) 62%)',
      }}
    >
      <div className="kin-hero-blob" style={{ width: 440, height: 440, background: '#bfd4ff', top: -90, left: '3%' }} />
      <div className="kin-hero-blob" style={{ width: 360, height: 360, background: '#ddd6fe', bottom: -60, right: '7%', animationDelay: '2s' }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1240, margin: '0 auto', padding: '0 32px', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48, alignItems: 'center' }}>

      {/* Left — copy */}
      <div style={{ position: 'relative', zIndex: 1 }} className="kin-fade">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: '#1b6ef3', background: 'rgba(27,110,243,0.09)', padding: '6px 12px', borderRadius: 999, textTransform: 'uppercase' }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: '#1b6ef3' }} className="kin-live" />
          AI-Native CRM
        </span>
        <h1 className="kin-hero-title" style={{ fontSize: '3.2rem', lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.04em', margin: '18px 0 0', color: '#0f172a' }}>
          Turn customer data into{' '}
          <span className="kin-gradient">repeat revenue</span>, automatically.
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#475569', lineHeight: 1.6, margin: '18px 0 28px', maxWidth: 540 }}>
          KIN surfaces your highest-value segments, writes the message, picks the best channel and time —
          and shows the reasoning behind every decision.
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={onExplore} className="kin-btn" style={{ background: '#1b6ef3', color: 'white', border: 'none', borderRadius: 12, padding: '14px 26px', fontWeight: 700, fontSize: '0.98rem', cursor: 'pointer' }}>
            Explore Revenue Opportunities
          </button>
          <a href="https://agentic-marketing.getxeno.com/" target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, fontSize: '0.92rem', color: '#475569', textDecoration: 'none', padding: '14px 18px' }}>
            Built on Xeno &rarr;
          </a>
        </div>
      </div>

      {/* Right — animated decision card */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center' }}>
        <div className="kin-hero-card" style={{ width: '100%', maxWidth: 420, background: 'white', border: '1px solid #e8eefb', borderRadius: 20, boxShadow: '0 24px 70px rgba(27,110,243,0.18)', padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: '#16a34a' }} className="kin-live" />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>KIN is analysing 1,200 customers</span>
          </div>

          <div style={{ background: 'linear-gradient(140deg,#1b6ef3,#4f46e5)', color: 'white', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, lineHeight: 1 }}>{count.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: 2 }}>dormant customers identified</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {rows.map((r, i) => {
              const activeRow = i === step;
              return (
                <div key={r.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '11px 14px', borderRadius: 11,
                  border: `1px solid ${activeRow ? r.color : '#eef2f7'}`,
                  background: activeRow ? `${r.color}0f` : '#fafbff',
                  transition: 'all 0.3s ease', transform: activeRow ? 'translateX(2px)' : 'none',
                }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>{r.label}</span>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: activeRow ? r.color : '#0f172a' }}>{r.value}</span>
                </div>
              );
            })}
          </div>

          <div style={{ background: '#dcf8c6', border: '1px solid #c5eda5', borderRadius: '4px 14px 14px 14px', padding: '12px 14px', fontSize: '0.84rem', color: '#1f2937', lineHeight: 1.5 }} className="kin-pop">
            Hi Eshna, your favourite styles are back — enjoy 15% off tonight. Shop now before they go.
          </div>
        </div>
      </div>
      </div>

      {/* Scroll cue */}
      <button
        onClick={onExplore}
        aria-label="Scroll to revenue opportunities"
        style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: 1 }}
      >
        <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.05em' }}>SCROLL</span>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="kin-bounce">
          <path d="M6 9l6 6 6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </section>
  );
}

function SegmentCard({ seg, onClick }: { seg: Segment; onClick: () => void }) {
  const accent = ACCENT[seg.segmentType] ?? '#1b6ef3';
  return (
    <button onClick={onClick} className="kin-card" style={{ ...card, textAlign: 'left', cursor: 'pointer', borderTop: `3px solid ${accent}`, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 30 }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: accent, flexShrink: 0 }} />{seg.label}
        </h3>
        <span style={{ ...pill, background: `${accent}14`, color: accent, flexShrink: 0 }}>{fmt.num(seg.count)} customers</span>
      </div>

      <div style={{ display: 'flex', gap: 24, margin: '18px 0' }}>
        <Stat label="Avg days lapsed" value={`${seg.avgDaysLapsed}d`} />
        <Stat label="Potential revenue" value={fmt.inrShort(seg.potentialRevenue)} accent={accent} />
      </div>

      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {seg.reasons.map((r, i) => (
          <li key={i} style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.45 }}>{r}</li>
        ))}
      </ul>

      <div style={{ marginTop: 'auto', paddingTop: 18, fontSize: '0.82rem', fontWeight: 700, color: accent }}>
        Get AI offer recommendation &rarr;
      </div>
    </button>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: accent ?? '#0f172a', marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ── Recommendation modal ──────────────────────────────────────────
function RecommendModal({ seg, onClose }: { seg: Segment; onClose: () => void }) {
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState<{ name: string; sentCount: number } | null>(null);

  useEffect(() => {
    api.recommendOffer({ segmentType: seg.segmentType, segmentSize: seg.count, avgDaysLapsed: seg.avgDaysLapsed, potentialRevenue: seg.potentialRevenue })
      .then(setRec)
      .finally(() => setLoading(false));
  }, [seg]);

  const current =
    rec && tab > 0 && rec.alternatives[tab - 1]
      ? { offerType: rec.alternatives[tab - 1].offerType, discount: rec.alternatives[tab - 1].discount, whatsappMessage: rec.alternatives[tab - 1].whatsappMessage }
      : rec
        ? { offerType: rec.offerType, discount: rec.discount, whatsappMessage: rec.whatsappMessage }
        : null;

  async function launch() {
    if (!rec || !current) return;
    setLaunching(true);
    try {
      const res = await api.launchCampaign({
        segmentType: seg.segmentType,
        segmentSize: seg.count,
        offerType: current.offerType,
        discount: current.discount,
        voucherCode: rec.voucherCode,
      });
      setLaunched({ name: res.name, sentCount: res.sentCount });
    } catch (e) {
      alert('Launch failed: ' + (e as Error).message);
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} className="kin-fade" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>AI Offer Recommendation</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 0 }}>{seg.label} · {fmt.num(seg.count)} customers</p>

        {loading && <div style={{ padding: '40px 0', textAlign: 'center' }}><span className="kin-spinner" /><div style={{ color: '#94a3b8', marginTop: 10, fontSize: '0.85rem' }}>Generating recommendation…</div></div>}

        {!loading && rec && launched && (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem' }}>🚀</div>
            <h3 style={{ margin: '8px 0 4px' }}>Campaign launched</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              <strong>{launched.name}</strong> sent to {fmt.num(launched.sentCount)} customers.
            </p>
            <Link href="/campaigns" style={{ ...primaryBtn, display: 'inline-block', textDecoration: 'none', marginTop: 8 }}>
              View in Campaigns →
            </Link>
          </div>
        )}

        {!loading && rec && !launched && current && (
          <>
            <div style={{ display: 'flex', gap: 6, margin: '12px 0' }}>
              {['Recommended', ...rec.alternatives.map((a) => a.offerType)].map((label, i) => (
                <button key={i} onClick={() => setTab(i)} style={{ ...tabBtn, ...(tab === i ? tabActive : {}) }}>
                  {i === 0 ? '⭐ ' : ''}{label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <InfoBox label="Offer type" value={current.offerType} />
              <InfoBox label="Discount" value={current.discount ? `${current.discount}%` : '—'} />
              <InfoBox label="Voucher" value={rec.voucherCode} mono />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={subLabel}>WhatsApp message preview</div>
              <div style={waBubble}>{current.whatsappMessage}</div>
            </div>

            {tab === 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={subLabel}>Why this offer</div>
                <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.5, margin: '4px 0 0' }}>{rec.reasoning}</p>
              </div>
            )}

            <button onClick={launch} disabled={launching} className="kin-btn" style={{ ...primaryBtn, width: '100%', opacity: launching ? 0.7 : 1 }}>
              {launching ? <><span className="kin-spinner" style={{ marginRight: 8 }} />Launching to {fmt.num(seg.count)} customers…</> : `Launch Campaign to ${fmt.num(seg.count)} customers`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function InfoBox({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '10px 12px', border: '1px solid #eef2f7' }}>
      <div style={subLabel}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: 2, fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</div>
    </div>
  );
}

// ── NLP search box ────────────────────────────────────────────────
function SearchBox() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState<{ name: string; sentCount: number } | null>(null);

  async function run() {
    if (!q.trim()) return;
    setLoading(true);
    setRes(null);
    setLaunched(null);
    try {
      setRes(await api.searchSegment(q));
    } catch (e) {
      alert('Search failed: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function launchCustom() {
    if (!res || res.count === 0) return;
    setLaunching(true);
    try {
      const voucher = 'CUST' + Math.random().toString(36).slice(2, 6).toUpperCase();
      const out = await api.launchCampaign({
        segmentType: 'custom',
        segmentSize: res.count,
        offerType: 'Percentage Discount',
        discount: 15,
        voucherCode: voucher,
        filter: res.filter,
      });
      setLaunched({ name: out.name, sentCount: out.sentCount });
    } catch (e) {
      alert('Launch failed: ' + (e as Error).message);
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div style={{ ...card, marginTop: 28 }}>
      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 4px' }}>Find a custom segment</h3>
      <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 12px' }}>
        Describe your audience in plain English — AI builds the query, then launch straight to it.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder="e.g. Tier 3 women over 30 who spent more than 10000"
          style={input}
        />
        <button onClick={run} disabled={loading} className="kin-btn" style={{ ...primaryBtn, minWidth: 100 }}>
          {loading ? <span className="kin-spinner" /> : 'Search'}
        </button>
      </div>

      {res && (
        <div style={{ marginTop: 16 }} className="kin-fade">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1b6ef3' }}>{fmt.num(res.count)}</span>
            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>customers match</span>
          </div>
          {res.count > 0 && (
            <>
              <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <InfoBox label="Avg spend" value={fmt.inr(res.sample.avgSpend)} />
                <InfoBox label="Avg orders" value={String(res.sample.avgOrders)} />
                <InfoBox label="Avg age" value={String(res.sample.avgAge)} />
                <InfoBox label="Top cities" value={res.sample.topCities.map((c) => `${c.city} (${c.count})`).join(', ') || '—'} />
                <InfoBox
                  label="Channel mix"
                  value={res.sample.channelMix.map((c) => `${channelMeta[c.channel]?.label ?? c.channel} (${c.count})`).join(', ') || '—'}
                />
              </div>

              <div style={{ marginTop: 14 }}>
                {launched ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#16a34a', fontWeight: 600, fontSize: '0.9rem' }}>
                    Launched <strong>{launched.name}</strong> to {fmt.num(launched.sentCount)} customers.
                    <Link href="/campaigns" style={{ color: '#1b6ef3', fontWeight: 700 }}>View &rarr;</Link>
                  </div>
                ) : (
                  <button onClick={launchCustom} disabled={launching} className="kin-btn" style={{ ...primaryBtn, opacity: launching ? 0.7 : 1 }}>
                    {launching
                      ? <><span className="kin-spinner" style={{ marginRight: 8 }} />Launching to {fmt.num(res.count)} customers…</>
                      : `Launch Campaign to these ${fmt.num(res.count)} customers`}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SkeletonCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ ...card, height: 230 }}>
          <div style={{ height: 20, width: '50%', background: '#eef2f7', borderRadius: 6 }} />
          <div style={{ height: 40, width: '70%', background: '#eef2f7', borderRadius: 6, marginTop: 18 }} />
          <div style={{ height: 12, width: '90%', background: '#f1f5f9', borderRadius: 6, marginTop: 18 }} />
          <div style={{ height: 12, width: '80%', background: '#f1f5f9', borderRadius: 6, marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const card: React.CSSProperties = { background: 'white', border: '1px solid #eef2f7', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(15,23,42,0.04)', width: '100%' };
const pill: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: 999 };
const errorBox: React.CSSProperties = { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 16, borderRadius: 12, fontSize: '0.9rem', lineHeight: 1.5 };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 };
const modal: React.CSSProperties = { background: 'white', borderRadius: 18, padding: 24, width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(15,23,42,0.25)' };
const closeBtn: React.CSSProperties = { border: 'none', background: '#f1f5f9', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', color: '#64748b', fontSize: '0.9rem' };
const tabBtn: React.CSSProperties = { padding: '6px 12px', borderRadius: 999, border: '1px solid #e2e8f0', background: 'white', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', cursor: 'pointer' };
const tabActive: React.CSSProperties = { background: '#1b6ef3', color: 'white', border: '1px solid #1b6ef3' };
const subLabel: React.CSSProperties = { fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' };
const waBubble: React.CSSProperties = { background: '#dcf8c6', borderRadius: '4px 12px 12px 12px', padding: '12px 14px', fontSize: '0.88rem', color: '#1f2937', lineHeight: 1.5, marginTop: 6, border: '1px solid #c5eda5' };
const primaryBtn: React.CSSProperties = { background: '#1b6ef3', color: 'white', border: 'none', borderRadius: 10, padding: '11px 18px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const input: React.CSSProperties = { flex: 1, padding: '11px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none' };
