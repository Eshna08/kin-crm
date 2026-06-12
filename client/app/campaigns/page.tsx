'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { api, fmt, statusColor, channelMeta, type Campaign, type FeedItem } from '../../lib/api';

const SEG_LABEL: Record<string, string> = {
  dormant_buyers: 'Dormant Buyers',
  high_value_lapsed: 'High-Value Lapsed',
  one_time_buyers: 'One-Time Buyers',
  custom: 'Custom Segment',
  abandoned_cart: 'Automation · Abandoned Cart',
  post_purchase: 'Automation · Points Earned',
  app_reengagement: 'Automation · Special Occasion',
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [simulating, setSimulating] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.getCampaigns();
      setCampaigns(list);
      if (!selected && list.length) setSelected(list[0].id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  // Poll the live feed for the selected campaign every 2 seconds.
  useEffect(() => {
    if (!selected) return;
    const tick = () => api.getFeed(selected).then(setFeed).catch(() => {});
    tick();
    pollRef.current = setInterval(tick, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected]);

  async function simulate(id: string) {
    setSimulating(id);
    try {
      await api.simulateCampaign(id);
      setSelected(id);
      await load();
    } catch (e) {
      alert('Simulation failed: ' + (e as Error).message);
    } finally {
      setSimulating(null);
    }
  }

  const selectedCampaign = campaigns.find((c) => c.id === selected) ?? null;

  return (
    <div className="kin-fade">
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>Campaigns</h1>
        <p style={{ color: '#64748b', marginTop: 6, fontSize: '0.95rem' }}>Launch, simulate delivery, and watch messages land in real time.</p>
      </header>

      {error && <div style={errorBox}>Couldn&apos;t load campaigns: {error}. Is the server running on <code>{process.env.NEXT_PUBLIC_API_URL}</code>?</div>}
      {loading && <div style={{ color: '#94a3b8' }}><span className="kin-spinner" /> Loading…</div>}

      {!loading && !campaigns.length && (
        <div style={{ ...card, textAlign: 'center', padding: 40, color: '#64748b' }}>
          No campaigns yet. Head to <strong>Revenue Opportunities</strong> and launch one.
        </div>
      )}

      {!!campaigns.length && (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#64748b' }}>
                {['Name', 'Segment', 'Size', 'Status', 'Sent', 'Delivered', 'Opened', 'Clicked', 'Revenue', ''].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer', background: selected === c.id ? '#f5f9ff' : 'white' }}
                >
                  <td style={{ ...td, fontWeight: 600, whiteSpace: 'normal', minWidth: 170, maxWidth: 240 }}>{c.name}</td>
                  <td style={td}>{SEG_LABEL[c.segmentType] ?? c.segmentType}</td>
                  <td style={td}>{fmt.num(c.segmentSize)}</td>
                  <td style={td}><StatusBadge status={c.status} /></td>
                  <td style={td}>{fmt.num(c.sentCount)}</td>
                  <td style={td}>{fmt.num(c.deliveredCount)}</td>
                  <td style={td}>{fmt.num(c.openedCount)}</td>
                  <td style={td}>{fmt.num(c.clickedCount)}</td>
                  <td style={{ ...td, fontWeight: 700, color: '#16a34a' }}>{fmt.inrShort(c.revenue)}</td>
                  <td style={td}>
                    <button
                      onClick={(e) => { e.stopPropagation(); simulate(c.id); }}
                      disabled={simulating === c.id}
                      className="kin-btn"
                      style={{ ...smallBtn, opacity: simulating === c.id ? 0.6 : 1 }}
                    >
                      {simulating === c.id ? 'Simulating…' : 'Simulate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {selectedCampaign && (
        <div style={{ ...card, marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Live Feed · {selectedCampaign.name}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '2px 0 0' }}>Auto-refreshing every 2s</p>
            </div>
            <span className="kin-live" style={{ ...pulse }}>● live</span>
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {feed.length === 0 && <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: 12 }}>No messages yet.</div>}
            {feed.map((f) => (
              <div key={f.id} style={feedRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={avatar}>{f.customerName.charAt(0)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{f.customerName}</span>
                      <ChannelTag channel={f.channel} />
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 480 }}>{f.message}</div>
                  </div>
                </div>
                <StatusBadge status={f.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChannelTag({ channel }: { channel: string }) {
  const m = channelMeta[channel] ?? { label: channel, color: '#94a3b8' };
  return (
    <span style={{ fontSize: '0.66rem', fontWeight: 700, color: m.color, background: `${m.color}16`, padding: '2px 7px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
      {m.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = statusColor[status] ?? '#94a3b8';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.74rem', fontWeight: 700, color, background: `${color}16`, padding: '3px 9px', borderRadius: 999, textTransform: 'capitalize' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />{status}
    </span>
  );
}

const card: React.CSSProperties = { background: 'white', border: '1px solid #eef2f7', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' };
const th: React.CSSProperties = { padding: '12px 14px', fontWeight: 600, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '12px 14px', whiteSpace: 'nowrap' };
const smallBtn: React.CSSProperties = { background: '#1b6ef3', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' };
const errorBox: React.CSSProperties = { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 16, borderRadius: 12, fontSize: '0.9rem', marginBottom: 16 };
const feedRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #eef2f7' };
const avatar: React.CSSProperties = { width: 30, height: 30, borderRadius: 999, background: 'linear-gradient(135deg,#1b6ef3,#7c3aed)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 };
const pulse: React.CSSProperties = { color: '#22c55e', fontSize: '0.78rem', fontWeight: 700 };
