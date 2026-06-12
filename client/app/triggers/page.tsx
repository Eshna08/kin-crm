'use client';
import { useEffect, useState } from 'react';
import { api, type TriggerRule } from '../../lib/api';

// Human-readable copy + styling per event type (kept on the frontend — no schema change).
const RULE_META: Record<string, { accent: string; description: string; tooltip: string }> = {
  abandoned_cart: {
    accent: '#2563EB',
    description: "Customer added items but didn't checkout",
    tooltip: 'Fires when a customer adds items to their cart but leaves without completing checkout.',
  },
  post_purchase: {
    accent: '#0891B2',
    description: 'Purchase detected — loyalty points added, remind them to redeem before expiry',
    tooltip: 'Fires right after a purchase to confirm loyalty points and nudge the customer to redeem them before they expire.',
  },
  app_reengagement: {
    accent: '#0D9488',
    description: 'Birthday coming up or festival season — send a personalised discount before the moment passes',
    tooltip: "Fires ahead of a customer's birthday or a festival season to send a timely, personalised discount.",
  },
};

const ORDER = ['abandoned_cart', 'post_purchase', 'app_reengagement'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function AutomationsPage() {
  const [rules, setRules] = useState<TriggerRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api.getRules()
      .then((r) => setRules([...r].sort((a, b) => ORDER.indexOf(a.eventType) - ORDER.indexOf(b.eventType))))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function simulate(rule: TriggerRule) {
    if (!rule.isActive) { showToast(`${rule.name} is paused — turn it on first`); return; }
    setBusy(rule.id);
    await sleep(1000); // "Firing..." for 1s
    try {
      const out = await api.simulateTrigger(rule.eventType);
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, firedCount: r.firedCount + 1, lastFiredAt: new Date().toISOString() } : r)));
      setFlashId(rule.id);
      setTimeout(() => setFlashId((cur) => (cur === rule.id ? null : cur)), 1000); // green flash 1s
      const who = out.customerName ? ` — message sent to ${out.customerName}` : ' — message queued';
      showToast(`⚡ ${rule.name} triggered${who} (see Campaigns)`);
    } catch (e) {
      showToast('Could not fire: ' + (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function toggle(rule: TriggerRule) {
    const next = !rule.isActive;
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, isActive: next } : r)));
    try {
      await api.toggleRule(rule.id, next);
    } catch {
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, isActive: !next } : r)));
      showToast('Could not update rule');
    }
  }

  return (
    <div className="kin-fade">
      <header style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>Automations</h1>
        <p style={{ color: '#64748b', marginTop: 6, fontSize: '0.95rem' }}>
          Messages that send themselves — triggered the moment a customer behaves a certain way.
        </p>
      </header>

      {error && <div style={errorBox}>Couldn&apos;t load automations: {error}. Is the server running on <code>{process.env.NEXT_PUBLIC_API_URL}</code>?</div>}
      {loading && <div style={{ color: '#94a3b8' }}><span className="kin-spinner" /> Loading…</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {rules.map((rule) => {
          const meta = RULE_META[rule.eventType] ?? { accent: '#2563EB', description: '', tooltip: '' };
          const flashing = flashId === rule.id;
          return (
            <div
              key={rule.id}
              className="kin-autocard"
              style={{
                background: 'white',
                borderRadius: 12,
                padding: 24,
                border: `1px solid ${flashing ? '#22C55E' : '#E2E8F0'}`,
                borderLeft: `4px solid ${flashing ? '#22C55E' : meta.accent}`,
              }}
            >
              {/* Top: name + info + toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{rule.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: rule.isActive ? '#22C55E' : '#CBD5E1' }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: rule.isActive ? '#16A34A' : '#94A3B8' }}>{rule.isActive ? 'Active' : 'Paused'}</span>
                  </span>
                  <Toggle on={rule.isActive} onClick={() => toggle(rule)} />
                </div>
              </div>

              {/* Description */}
              <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.5, margin: '12px 0 0' }}>{meta.description}</p>

              {/* Metrics */}
              <div style={{ display: 'flex', gap: 28, margin: '22px 0' }}>
                <div>
                  <div style={metricLabel}>Fired</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>{rule.firedCount}</div>
                </div>
                <div>
                  <div style={metricLabel}>Last fired</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginTop: 8, color: rule.lastFiredAt ? '#475569' : '#94A3B8' }}>
                    {rule.lastFiredAt ? timeAgo(rule.lastFiredAt) : 'Not fired yet'}
                  </div>
                </div>
              </div>

              {/* Simulate button — outline */}
              <button
                onClick={() => simulate(rule)}
                disabled={busy === rule.id}
                style={{
                  width: '100%', height: 40, borderRadius: 8, cursor: busy === rule.id ? 'default' : 'pointer',
                  background: 'white', border: '1px solid #2563EB', color: '#2563EB',
                  fontWeight: 700, fontSize: '0.86rem', transition: 'background 0.15s ease',
                  opacity: busy === rule.id ? 0.75 : 1,
                }}
                onMouseEnter={(e) => { if (busy !== rule.id) (e.currentTarget as HTMLElement).style.background = '#EFF5FF'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'white'; }}
              >
                {busy === rule.id ? 'Firing…' : 'Simulate Event'}
              </button>
            </div>
          );
        })}
      </div>

      {toast && <div style={toastStyle} className="kin-fade">{toast}</div>}
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="toggle"
      style={{ width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? '#2563EB' : '#CBD5E1', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
    >
      <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: 999, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </button>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const metricLabel: React.CSSProperties = { fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' };
const errorBox: React.CSSProperties = { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 16, borderRadius: 12, fontSize: '0.9rem', marginBottom: 16 };
const toastStyle: React.CSSProperties = { position: 'fixed', bottom: 28, right: 28, background: '#0f172a', color: 'white', padding: '12px 18px', borderRadius: 12, fontSize: '0.88rem', fontWeight: 600, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 200, maxWidth: 360 };
