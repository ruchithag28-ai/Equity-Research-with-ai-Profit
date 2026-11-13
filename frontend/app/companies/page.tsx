'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '../components/Common/Navbar';
import Footer from '../components/Common/Footer';
import { API_ENDPOINTS, buildApiUrl } from '../lib/config';

type Company = { symbol: string; name: string; sector: string; latestProfitCr: number; profitGrowthPct: number; profitMarginPct: number | null; dataSource: string };
export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { fetch(buildApiUrl(API_ENDPOINTS.TOP_PROFITABLE), { cache: 'no-store' }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Could not load companies'); setCompanies(data.companies || []); setSource(data.source || ''); }).catch(err => setError(err.message)); }, []);
  return <div className="min-h-screen bg-slate-50 text-slate-900"><Navbar onLogout={() => { localStorage.removeItem('token'); window.location.href = '/login'; }} /><main className="mx-auto max-w-6xl px-4 py-9 sm:px-6"><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">NSE financials</p><h1 className="mt-1 text-3xl font-bold">Most Profitable Companies</h1><p className="mt-2 text-slate-600">Top 10 companies ranked by latest annual net profit.</p>{source && <p className="mt-5 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{source} · INR crore</p>}{error && <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}<section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Sector</th><th className="px-4 py-3">Latest profit (₹ Cr)</th><th className="px-4 py-3">Growth</th><th className="px-4 py-3">Margin</th><th className="px-4 py-3">Source</th></tr></thead><tbody className="divide-y divide-slate-100">{companies.map((company, index) => <tr key={company.symbol}><td className="px-4 py-4 font-bold">{index + 1}</td><td className="px-4 py-4"><Link href={`/companies/${company.symbol}`} className="font-semibold text-blue-700 hover:underline">{company.name} ({company.symbol})</Link></td><td className="px-4 py-4">{company.sector}</td><td className="px-4 py-4 tabular-nums">{company.latestProfitCr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td><td className="px-4 py-4">{company.profitGrowthPct.toFixed(1)}%</td><td className="px-4 py-4">{company.profitMarginPct == null ? '—' : `${company.profitMarginPct.toFixed(1)}%`}</td><td className="px-4 py-4 text-xs text-slate-500">{company.dataSource}</td></tr>)}</tbody></table></div></section><p className="mt-4 text-xs text-slate-500">Use each company page for annual and quarterly profit details. Estimates are identified in the source column.</p></main><Footer /></div>;
}
