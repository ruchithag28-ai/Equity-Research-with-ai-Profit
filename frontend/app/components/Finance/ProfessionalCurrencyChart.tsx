'use client';

import { useEffect, useMemo, useState } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildApiUrl, API_ENDPOINTS } from '../../lib/config';

type Point = { date: string; value: number };
type Mode = 'Line' | 'Area' | 'Bar';
const periods = [{ label: '7D', days: 7 }, { label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '1Y', days: 365 }, { label: '5Y', days: 1825 }];
const price = (value: number, symbol: string) => `${symbol === 'INR' ? '₹' : symbol === 'EUR' ? '€' : '$'}${value.toLocaleString('en-IN', { maximumFractionDigits: 4 })}`;

export default function ProfessionalCurrencyChart({ base, symbol, title }: { base: string; symbol: string; title?: string }) {
  const [points, setPoints] = useState<Point[]>([]);
  const [days, setDays] = useState(90);
  const [mode, setMode] = useState<Mode>('Area');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showExplain, setShowExplain] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const end = new Date();
        const start = new Date(end);
        start.setUTCDate(end.getUTCDate() - days);
        const url = new URL(buildApiUrl(API_ENDPOINTS.FOREX_TIMESERIES));
        url.searchParams.set('base', base);
        url.searchParams.set('symbols', symbol);
        url.searchParams.set('start_date', start.toISOString().slice(0, 10));
        url.searchParams.set('end_date', end.toISOString().slice(0, 10));
        const response = await fetch(url.toString(), { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.detail || 'Currency price provider is unavailable');
        const rates = data?.rates || {};
        const series = Object.keys(rates).sort().map(date => ({ date, value: Number(rates[date]?.[symbol]) })).filter(point => Number.isFinite(point.value));
        if (!cancelled) setPoints(series);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load exchange rates');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [base, symbol, days]);

  const stats = useMemo(() => {
    if (!points.length) return { min: 0, max: 1, average: 0, change: 0 };
    const values = points.map(point => point.value);
    const first = values[0], last = values[values.length - 1];
    return { min: Math.min(...values), max: Math.max(...values), average: values.reduce((sum, value) => sum + value, 0) / values.length, change: first ? (last - first) / first * 100 : 0 };
  }, [points]);
  const latest = points[points.length - 1];
  const padding = Math.max((stats.max - stats.min) * .08, stats.max * .001);
  const domain: [number, number] = [Math.max(0, stats.min - padding), stats.max + padding];
  const chartColor = stats.change >= 0 ? '#16A34A' : '#DC2626';
  const gradientId = `fx-area-${base}-${symbol}`;
  const tick = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  const tip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => active && payload?.length ? <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"><div className="font-semibold text-slate-500">Date: {label ? tick(label) : '—'}</div><div className="mt-1 font-bold text-slate-900">Rate: {price(payload[0].value, symbol)}</div></div> : null;

  return <div className="finance-chart-panel" style={{ border: '1px solid #dbe2ea', background: '#fff', color: '#111827', borderRadius: 16, padding: 14 }}>
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-bold text-slate-900">{title || `${base}/${symbol}`}</div><div className="flex items-center gap-2">{latest && <span className="text-xs font-bold tabular-nums text-slate-900">{price(latest.value, symbol)}</span>}<span className={`text-xs font-bold ${stats.change >= 0 ? 'text-green-700' : 'text-red-700'}`}>{stats.change >= 0 ? '+' : ''}{stats.change.toFixed(2)}%</span></div></div>
    <div className="mt-3 grid grid-cols-3 gap-2"><Stat label="High" value={stats.max} symbol={symbol} /><Stat label="Low" value={stats.min} symbol={symbol} /><Stat label="Average" value={stats.average} symbol={symbol} /></div>
    <div className="mt-3 flex flex-wrap gap-1">{periods.map(period => <button type="button" key={period.label} onClick={() => setDays(period.days)} className={`chart-control ${days === period.days ? 'chart-control-active' : ''}`}>{period.label}</button>)}<span className="mx-1 border-l border-slate-200" />{(['Line', 'Area', 'Bar'] as Mode[]).map(item => <button type="button" key={item} onClick={() => setMode(item)} className={`chart-control ${mode === item ? 'chart-control-active' : ''}`}>{item}</button>)}<button type="button" onClick={() => setShowExplain(value => !value)} className="chart-control">{showExplain ? 'Hide' : 'Explain'}</button></div>
    {loading && <div className="py-10 text-center text-sm text-slate-500">Loading…</div>}{error && <div className="my-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {!loading && !error && <div className="mt-2 h-56 w-full"><ResponsiveContainer><ComposedChart data={points} margin={{ top: 10, right: 8, bottom: 2, left: 0 }}><defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColor} stopOpacity={.28} /><stop offset="100%" stopColor={chartColor} stopOpacity={.02} /></linearGradient></defs><CartesianGrid stroke="#e5e7eb" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="date" tickFormatter={tick} minTickGap={26} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} /><YAxis domain={domain} width={65} tickFormatter={value => price(Number(value), symbol)} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={tip} />{mode === 'Area' ? <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 3 }} /> : mode === 'Bar' ? <Bar dataKey="value" fill="#0F2340" radius={[2, 2, 0, 0]} /> : <Line type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />}</ComposedChart></ResponsiveContainer></div>}
    {!loading && !error && latest && <div className="mt-2 text-[11px] text-slate-500">Latest {tick(latest.date)} · {days} day history</div>}
    {showExplain && <p className="mt-2 text-xs text-slate-600">{stats.change >= 0 ? 'The exchange rate rose' : 'The exchange rate fell'} {Math.abs(stats.change).toFixed(2)}% over the selected period.</p>}
  </div>;
}

function Stat({ label, value, symbol }: { label: string; value: number; symbol: string }) { return <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5"><p className="text-[10px] uppercase text-slate-500">{label}</p><p className="text-xs font-bold tabular-nums text-slate-900">{price(value, symbol)}</p></div>; }
