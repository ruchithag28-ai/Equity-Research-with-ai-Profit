'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '../components/Common/Navbar';
import Footer from '../components/Common/Footer';
import { API_ENDPOINTS, buildApiUrl } from '../lib/config';

type SectorQuote = {
  region: 'india' | 'global';
  name: string;
  ticker: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  currency: string;
  marketState: string;
  observedAt: string | null;
  source: string;
  isSample?: boolean;
  available: boolean;
  error?: string;
};

type PerformanceResponse = {
  items: SectorQuote[];
  updatedAt: string;
  source: string;
  globalNote: string;
  sampleFallbackUsed?: boolean;
  sampleNote?: string | null;
};

const fmt = (value: number | null, digits = 2) =>
  value == null ? '—' : value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export default function SectorsPage() {
  const [region, setRegion] = useState<'both' | 'india' | 'global'>('both');
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const url = new URL(buildApiUrl(API_ENDPOINTS.SECTOR_PERFORMANCE));
        url.searchParams.set('region', region);
        const response = await fetch(url.toString(), { cache: 'no-store' });
        if (!response.ok) throw new Error(`Market data request failed (${response.status})`);
        const result = await response.json();
        if (!cancelled) setData({ ...result, items: Array.isArray(result?.items) ? result.items : [] });
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load sector data. Check the backend connection.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [region]);

  const india = useMemo(() => (data?.items || []).filter((item) => item.region === 'india'), [data]);
  const global = useMemo(() => (data?.items || []).filter((item) => item.region === 'global'), [data]);
  const maxAbs = Math.max(0.1, ...(data?.items || []).map((item) => Math.abs(item.changePct || 0)));

  const table = (title: string, items: SectorQuote[]) => (
    <section className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-950 dark:text-gray-400">
            <tr><th className="px-5 py-3">Sector</th><th className="px-5 py-3">Latest price</th><th className="px-5 py-3">Daily change</th><th className="px-5 py-3">Daily %</th><th className="px-5 py-3">Market</th><th className="px-5 py-3">Provider time</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item) => {
              const positive = (item.changePct || 0) >= 0;
              const barWidth = item.changePct == null ? 0 : Math.max(2, Math.abs(item.changePct) / maxAbs * 100);
              return <tr key={`${item.region}-${item.ticker}`}>
                <td className="px-5 py-4"><div className="font-semibold text-gray-900 dark:text-white">{item.name}</div><div className="text-xs text-gray-500">{item.ticker}</div></td>
                <td className="px-5 py-4 tabular-nums">{item.available ? `${fmt(item.price)} ${item.currency}` : 'Unavailable'}</td>
                <td className={`px-5 py-4 tabular-nums ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>{item.available ? `${positive ? '+' : ''}${fmt(item.change)}` : '—'}</td>
                <td className="px-5 py-4"><div className="flex items-center gap-2"><span className={`w-16 shrink-0 tabular-nums ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>{item.available ? `${positive ? '+' : ''}${fmt(item.changePct, 2)}%` : '—'}</span><div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className={`h-full ${positive ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${barWidth}%` }} /></div></div></td>
                <td className="px-5 py-4 text-gray-600 dark:text-gray-300">{item.marketState.replaceAll('_', ' ')}</td>
                <td className="px-5 py-4 text-xs text-gray-500">{item.isSample ? 'Illustrative fallback' : item.observedAt ? new Date(item.observedAt).toLocaleString() : 'No quote'}</td>
              </tr>;
            })}
            {items.length === 0 && <tr><td className="px-5 py-6 text-gray-500" colSpan={6}>No sector quotes available.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );

  return <div className="min-h-screen bg-gray-50 dark:bg-black">
    <Navbar onLogout={() => { localStorage.removeItem('token'); }} />
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold uppercase tracking-wide text-cyan-600">Market overview</p><h1 className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">Sector performance</h1><p className="mt-2 text-gray-600 dark:text-gray-400">Latest available values and daily moves from the data provider.</p></div>
        <div className="flex gap-2">{(['both', 'india', 'global'] as const).map((value) => <button key={value} onClick={() => setRegion(value)} className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${region === value ? 'bg-cyan-600 text-white' : 'border border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'}`}>{value === 'both' ? 'Compare' : value}</button>)}</div>
      </div>
      {data && <p className="mb-5 text-xs text-gray-500">Provider: {data.source} · Last checked {new Date(data.updatedAt).toLocaleString()}</p>}
      {data?.sampleFallbackUsed && <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-950">{data.sampleNote || 'Illustrative fallback values are shown because live NSE sector quotes were unavailable. They are not current market prices.'}</div>}
      {error && <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}
      {loading && <div className="mb-5 rounded-lg bg-white p-4 text-gray-600 dark:bg-gray-900 dark:text-gray-300">Loading latest sector quotes…</div>}
      {region !== 'global' && table('Indian NSE sector indices', india)}
      {region !== 'india' && table('Global sector comparison', global)}
      {region !== 'india' && <p className="mb-6 text-xs text-gray-500">{data?.globalNote || 'Global sectors are represented by State Street Select Sector SPDR ETF prices.'}</p>}
      <Link className="text-sm font-semibold text-cyan-700 hover:underline dark:text-cyan-400" href="/dashboard">Back to dashboard</Link>
    </main>
    <Footer />
  </div>;
}
