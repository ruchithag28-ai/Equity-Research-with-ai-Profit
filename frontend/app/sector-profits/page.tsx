'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Navbar from '../components/Common/Navbar';
import Footer from '../components/Common/Footer';
import { API_ENDPOINTS, buildApiUrl } from '../lib/config';

type Sector = { sector: string; totalProfitCr: number; profitGrowthPct: number; profitMarginPct: number | null; companies: number; topCompanies: { symbol: string; name: string; profitCr: number }[] };
const palette = ['#2563eb', '#3b82f6', '#60a5fa', '#0f4c81', '#1d4ed8', '#38bdf8', '#64748b', '#93c5fd'];
const money = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr`;

export default function SectorProfitsPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const profitChartData = sectors.map(item => ({
    ...item,
    previousProfitCr: item.profitGrowthPct <= -99 ? item.totalProfitCr : item.totalProfitCr / (1 + item.profitGrowthPct / 100),
  }));
  useEffect(() => { fetch(buildApiUrl(API_ENDPOINTS.SECTOR_PROFITS), { cache: 'no-store' }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Could not load profit data'); setSectors(data.sectors || []); setSource(data.source || ''); }).catch(err => setError(err.message)); }, []);

  return <div className="min-h-screen bg-slate-50 text-slate-900"><Navbar onLogout={() => { localStorage.removeItem('token'); window.location.href = '/login'; }} /><main className="mx-auto max-w-7xl px-4 py-9 sm:px-6">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Company financials</p><h1 className="mt-1 text-3xl font-bold">Sector Profits</h1><p className="mt-2 text-slate-600">Compare profit, annual growth, margins, and leading listed companies.</p></div><a href={buildApiUrl(API_ENDPOINTS.PROFIT_REPORT)} className="rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800">Download Report</a></div>
    {source && <p className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">Data: {source}. Figures are INR crore for the latest annual financial year.</p>}
    {error && <p className="mb-5 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
    <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-1 text-lg font-bold">Annual profit comparison by sector</h2><p className="mb-3 text-xs text-slate-500">Previous annual profit compared with the latest available year.</p><div className="h-80">{sectors.length > 0 && <ResponsiveContainer><BarChart data={profitChartData} margin={{ top: 8, right: 8, bottom: 12, left: 4 }}><CartesianGrid stroke="#e5e7eb" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="sector" angle={-20} textAnchor="end" height={58} tick={{ fill: '#475569', fontSize: 11 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} /><YAxis tickFormatter={value => `₹${(Number(value) / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 10, borderColor: '#cbd5e1' }} /><Legend /><Bar dataKey="previousProfitCr" name="Previous year" fill="#0F2340" radius={[4, 4, 0, 0]} /><Bar dataKey="totalProfitCr" name="Latest year" fill="#C9A227" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>}</div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-bold">Share of sector profit</h2><div className="h-80">{sectors.length > 0 && <ResponsiveContainer><PieChart><Pie data={sectors} dataKey="totalProfitCr" nameKey="sector" outerRadius={112} label={({ name, percent }) => `${name} ${(Number(percent) * 100).toFixed(0)}%`}>{sectors.map((entry, index) => <Cell key={entry.sector} fill={index % 2 === 0 ? '#0F2340' : palette[index % palette.length]} stroke="#ffffff" strokeWidth={2} />)}</Pie><Tooltip formatter={(v) => money(Number(v))} /><Legend /></PieChart></ResponsiveContainer>}</div></section></div>
    <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr>{['Sector', 'Total profit', 'Growth', 'Profit margin', 'Top 3 profitable companies'].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{sectors.map(item => <tr key={item.sector}><td className="px-4 py-4 font-semibold">{item.sector}</td><td className="px-4 py-4">{money(item.totalProfitCr)}</td><td className={`px-4 py-4 ${item.profitGrowthPct >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{item.profitGrowthPct.toFixed(1)}%</td><td className="px-4 py-4">{item.profitMarginPct == null ? '—' : `${item.profitMarginPct.toFixed(1)}%`}</td><td className="px-4 py-4">{item.topCompanies.map(company => <Link key={company.symbol} className="mr-3 text-blue-700 hover:underline" href={`/companies/${company.symbol}`}>{company.symbol}</Link>)}</td></tr>)}</tbody></table></div></section>
    <p className="mt-4 text-xs text-slate-500">Financial statement data can be delayed. Sample estimates are explicitly labelled when live statements are unavailable. This page is for research, not investment advice.</p>
  </main><Footer /></div>;
}
