'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Common/Navbar';
import Footer from '../../components/Common/Footer';
import { API_ENDPOINTS, buildApiUrl } from '../../lib/config';

type Quote = {
  region: string;
  name: string;
  ticker: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  currency: string;
  marketState: string;
  observedAt: string | null;
  available: boolean;
};

const sectorMatch: Record<string, string[]> = {
  technology: ['IT'],
  finance: ['Bank'],
  healthcare: ['Pharma'],
  health: ['Pharma'],
  energy: ['Energy'],
  retail: ['FMCG'],
  manufacturing: ['Auto', 'Metal'],
  'real estate': ['Realty'],
  transportation: ['Auto'],
  media: ['Media'],
};

export default function SectorClient({ sector }: { sector: string }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const label = sector.replace(/-/g, ' ');
  const matches = useMemo(() => sectorMatch[label.toLowerCase()] || [], [label]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const url = new URL(buildApiUrl(API_ENDPOINTS.SECTOR_PERFORMANCE));
        url.searchParams.set('region', 'india');
        const response = await fetch(url.toString(), { cache: 'no-store' });
        if (!response.ok) throw new Error(`Market data request failed (${response.status})`);
        const result = await response.json();
        if (!cancelled) setQuotes(Array.isArray(result?.items) ? result.items : []);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load NSE sector data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const relevant = quotes.filter((quote) => matches.some((match) => quote.name.toLowerCase().includes(match.toLowerCase())));

  return <div className="min-h-screen bg-gray-50 dark:bg-black">
    <Navbar onLogout={() => { localStorage.removeItem('token'); }} />
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-cyan-600">NSE sector index data</p>
      <h1 className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{label} sector</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">Latest available index price and daily performance from the market data provider.</p>
      {loading && <p className="mt-6 rounded-lg bg-white p-4 text-gray-600 dark:bg-gray-900">Loading latest quote…</p>}
      {error && <p className="mt-6 rounded-lg bg-rose-50 p-4 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {!loading && !error && relevant.length === 0 && <p className="mt-6 rounded-lg bg-white p-4 text-gray-600 dark:bg-gray-900">No direct NSE sector index mapping is available for this category.</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {relevant.map((quote) => <article key={quote.ticker} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{quote.name}</h2>
          <p className="text-xs text-gray-500">{quote.ticker} · {quote.marketState}</p>
          <p className="mt-5 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{quote.available && quote.price != null ? `${quote.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${quote.currency}` : 'Quote unavailable'}</p>
          <p className={`mt-2 font-semibold ${(quote.changePct || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{quote.available && quote.changePct != null ? `${quote.changePct >= 0 ? '+' : ''}${quote.changePct.toFixed(2)}% today` : 'No daily change available'}</p>
          {quote.observedAt && <p className="mt-2 text-xs text-gray-500">Provider time: {new Date(quote.observedAt).toLocaleString()}</p>}
        </article>)}
      </div>
      <Link href="/sectors" className="mt-8 inline-block font-semibold text-cyan-700 hover:underline dark:text-cyan-400">Compare all Indian and global sectors</Link>
    </main>
    <Footer />
  </div>;
}
