import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import TopNav from './components/Nav';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'KIN — AI-Native Mini CRM',
  description: 'Every AI decision comes with a visible reason.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <TopNav />
        <main style={{ maxWidth: 1240, margin: '0 auto', padding: '36px 32px 72px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
