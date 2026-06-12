'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type IconProps = { active?: boolean };

function UsersIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.5" cy="6" r="2.4" /><path d="M2 15c0-2.3 2-4 4.5-4s4.5 1.7 4.5 4" />
      <path d="M12 4.2A2.3 2.3 0 0 1 12 8.6" /><path d="M13 11.2c1.7.3 3 1.7 3 3.8" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 2 9 16l-2-6-6-2 15-6Z" /><path d="M16 2 7 10" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 15.5h13" /><rect x="3.5" y="9" width="2.4" height="4.5" rx="0.6" /><rect x="7.8" y="5.5" width="2.4" height="8" rx="0.6" /><rect x="12.1" y="2.5" width="2.4" height="11" rx="0.6" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 1.5 3.5 10H8l-1 6.5L14.5 8H10l0-6.5Z" />
    </svg>
  );
}

const links: { href: string; label: string; Icon: (p: IconProps) => React.ReactElement }[] = [
  { href: '/opportunities', label: 'Revenue Opportunities', Icon: UsersIcon },
  { href: '/campaigns', label: 'Campaigns', Icon: SendIcon },
  { href: '/analytics', label: 'Growth Engine', Icon: ChartIcon },
  { href: '/triggers', label: 'Automations', Icon: BoltIcon },
];

function KinLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="kinGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1B6EF3" /><stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#kinGrad)" />
      <path d="M14 11 V29" stroke="white" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M27 11 L16.5 20 L27 29" stroke="white" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="27" cy="11" r="2.4" fill="#9DC3FF" /><circle cx="27" cy="29" r="2.4" fill="#9DC3FF" />
    </svg>
  );
}

export default function TopNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(15,23,42,0.07)',
      }}
    >
      <div className="kin-nav-inner">
        {/* Logo */}
        <Link href="/opportunities" onClick={() => setOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <KinLogo />
          <span style={{ fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-0.04em', color: '#0F172A' }}>KIN</span>
        </Link>

        {/* Center links (desktop) */}
        <nav className="kin-nav-links">
          {links.map((l) => {
            const active = path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className={`kin-nav-link${active ? ' active' : ''}`}>
                <l.Icon active={active} />
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: CTA + mobile menu button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <a href="https://agentic-marketing.getxeno.com/" target="_blank" rel="noopener noreferrer" className="kin-nav-cta kin-btn">
            <span className="kin-nav-cta-text">Built on Xeno</span>
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>&rarr;</span>
          </a>
          <button className="kin-nav-menu-btn" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#334155" strokeWidth="1.8" strokeLinecap="round">
              {open ? <><path d="M5 5l10 10" /><path d="M15 5l-10 10" /></> : <><path d="M3 6h14" /><path d="M3 10h14" /><path d="M3 14h14" /></>}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <nav className="kin-nav-mobile kin-fade">
          {links.map((l) => {
            const active = path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={`kin-nav-mlink${active ? ' active' : ''}`}>
                <l.Icon active={active} />
                {l.label}
              </Link>
            );
          })}
          <a
            href="https://agentic-marketing.getxeno.com/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontWeight: 700, fontSize: '0.9rem', padding: '12px', borderRadius: 10, color: 'white', textDecoration: 'none', background: 'linear-gradient(135deg, #FF7A1A, #F4520B)' }}
          >
            Built on Xeno &rarr;
          </a>
        </nav>
      )}
    </header>
  );
}
