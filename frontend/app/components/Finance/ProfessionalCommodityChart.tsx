'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { buildApiUrl, API_ENDPOINTS } from '../../lib/config';

type ChartPoint = { date: string; value: number; open?: number; high?: number; low?: number };
type ChartMode = 'Line' | 'Area' | 'Candle' | 'Bar';
const ranges = [{ label: '1D', days: 1 }, { label: '7D', days: 7 }, { label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '1Y', days: 365 }, { label: '5Y', days: 1825 }];
const modes: ChartMode[] = ['Line', 'Area', 'Candle', 'Bar'];
const GOLD = '#C9A227';
const GREEN = '#16A34A';
const RED = '#DC2626';

const formatPrice = (value: number, currency: string) => `${currency === 'INR' ? '₹' : '$'}${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const asDate = (value: string) => new Date(value.length === 10 ? `${value}T12:00:00` : value);
const formatAxisDate = (value: string, days: number) => {
  const date = asDate(value);
  return days === 1
    ? date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
};
const formatLongDate = (value: string) => asDate(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: value.length > 10 ? '2-digit' : undefined, minute: value.length > 10 ? '2-digit' : undefined, timeZone: 'UTC' });

function CandleShape(props: { x?: number; width?: number; payload?: ChartPoint; domain?: [number, number]; chartHeight?: number }) {
  const { x = 0, width = 8, payload } = props;
  if (!payload || payload.high == null || payload.low == null || payload.open == null) return null;
  // Candle values are plotted against a fixed price domain set on the chart.
  const domain = props.domain;
  if (!domain) return null;
  const [min, max] = domain;
  const plotTop = 18;
  const plotHeight = (props.chartHeight || 320) - 54;
  const y = (price: number) => plotTop + ((max - price) / Math.max(max - min, 0.0001)) * plotHeight;
  const close = payload.value;
  const color = close >= payload.open ? GREEN : RED;
  const bodyTop = Math.min(y(payload.open), y(close));
  const bodyHeight = Math.max(2, Math.abs(y(payload.open) - y(close)));
  const bodyWidth = Math.max(3, Math.min(12, width * 0.55));
  return <g>
    <line x1={x + width / 2} x2={x + width / 2} y1={y(payload.high)} y2={y(payload.low)} stroke={color} strokeWidth={1.4} />
    <rect x={x + (width - bodyWidth) / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} rx={1} />
  </g>;
}

function StatsCard({ label, value, currency }: { label: string; value: number; currency: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-sm font-bold tabular-nums text-slate-900">{formatPrice(value, currency)}</div></div>;
}

export default function ProfessionalCommodityChart({ commodity, currency, title, height: customHeight, unit }: { commodity: 'gold' | 'oil'; currency: 'INR' | 'USD'; title: string; height?: number; unit?: 'ounce' | 'gram' }) {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [priceSource, setPriceSource] = useState('');
  const [isSample, setIsSample] = useState(false);
  const [days, setDays] = useState(30);
  const [mode, setMode] = useState<ChartMode>('Area');
  const [forecast, setForecast] = useState<ChartPoint[]>([]);
  const [customDays, setCustomDays] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const url = new URL(buildApiUrl(API_ENDPOINTS.COMMODITIES_TIMESERIES));
        url.searchParams.set('commodity', commodity);
        url.searchParams.set('currency', currency);
        url.searchParams.set('days', String(days));
        if (unit) url.searchParams.set('unit', unit);
        const response = await fetch(url.toString(), { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.detail || `Price request failed (${response.status})`);
        const result: ChartPoint[] = (data.points || []).map((point: ChartPoint) => ({ ...point, value: Number(point.value), open: Number(point.open ?? point.value), high: Number(point.high ?? point.value), low: Number(point.low ?? point.value) }));
        if (!cancelled) {
          setPoints(result);
          setPriceSource(data.source || 'Price provider');
          setIsSample(Boolean(data.isSample));
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load price data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const timer = window.setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [commodity, currency, days, unit]);

  const stats = useMemo(() => {
    const values = points.map(point => point.value);
    if (!values.length) return { high: 0, low: 0, average: 0, changePct: 0, min: 0, max: 1 };
    const first = values[0];
    const last = values[values.length - 1];
    const min = Math.min(...points.map(point => point.low ?? point.value));
    const max = Math.max(...points.map(point => point.high ?? point.value));
    return { high: max, low: min, average: values.reduce((total, value) => total + value, 0) / values.length, changePct: first ? ((last - first) / first) * 100 : 0, min, max };
  }, [points]);
  const latest = points.at(-1);
  const currencyMark = currency === 'INR' ? '₹' : '$';
  const padding = Math.max((stats.max - stats.min) * 0.08, stats.max * 0.001);
  const domain: [number, number] = [Math.max(0, stats.min - padding), stats.max + padding];
  const chartHeight = customHeight || 320;
  const gradientId = `gold-area-${commodity}-${currency}`;
  const chartData = [...points, ...forecast.map(point => ({ ...point, open: undefined, high: undefined, low: undefined, value: null as unknown as number, forecastValue: point.value }))];
  const chartColor = commodity === 'gold' ? GOLD : stats.changePct >= 0 ? GREEN : RED;
  const selectedRange = ranges.find(range => range.days === days)?.label || `${days}D`;
  const chartTitle = title.replace(/Last 30 days/i, `Last ${selectedRange}`);
  const yAxisTick = (value: number) => `${currencyMark}${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const tick = (value: string) => formatAxisDate(value, days);
  const tooltip = ({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    const index = points.findIndex(point => point.date === row.date);
    const previous = index > 0 ? points[index - 1].value : row.open ?? row.value;
    const change = previous ? ((row.value - previous) / previous) * 100 : 0;
    return <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"><div className="font-semibold text-slate-600">Date: {formatLongDate(row.date)}</div><div className="mt-1 font-bold text-slate-900">Price: {formatPrice(row.value, currency)}{commodity === 'gold' && unit === 'gram' ? '/g' : ''}</div><div className={change >= 0 ? 'text-green-700' : 'text-red-700'}>Change: {change >= 0 ? '+' : ''}{change.toFixed(2)}%</div></div>;
  };

  function makeForecast(daysAhead: number) {
    if (points.length < 2) return;
    const tail = points.slice(-Math.min(points.length, 14));
    const lastPoint = tail[tail.length - 1];
    const step = (lastPoint.value - tail[0].value) / Math.max(tail.length - 1, 1);
    const lastDate = asDate(lastPoint.date);
    const generated = Array.from({ length: daysAhead }, (_, index) => {
      const date = new Date(lastDate);
      date.setUTCDate(date.getUTCDate() + index + 1);
      return { date: date.toISOString().slice(0, 10), value: Number((lastPoint.value + step * (index + 1)).toFixed(2)) };
    });
    setForecast(generated);
  }

  return <div className="finance-chart-panel" style={{ border: '1px solid #dbe2ea', background: '#fff', color: '#111827', borderRadius: 16, padding: 16 }}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">{chartTitle}</h2>{latest && <div className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{formatPrice(latest.value, currency)}{commodity === 'gold' && unit === 'gram' ? ' / gram' : ''} <span className={stats.changePct >= 0 ? 'text-green-700' : 'text-red-700'}>{stats.changePct >= 0 ? '+' : ''}{stats.changePct.toFixed(2)}%</span></div>}</div>
      <div className="flex flex-wrap gap-1.5" aria-label="Chart time range">{ranges.map(range => <button key={range.label} type="button" onClick={() => { setDays(range.days); setForecast([]); }} className={`chart-control ${days === range.days ? 'chart-control-active' : ''}`}>{range.label}</button>)}</div>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-lg"><StatsCard label="High" value={stats.high} currency={currency} /><StatsCard label="Low" value={stats.low} currency={currency} /><StatsCard label="Average" value={stats.average} currency={currency} /></div>
    <div className="mt-4 flex flex-wrap items-center gap-1.5" aria-label="Chart type">{modes.map(chartMode => <button key={chartMode} type="button" onClick={() => setMode(chartMode)} className={`chart-control ${mode === chartMode ? 'chart-control-active' : ''}`}>{chartMode}</button>)}</div>
    {loading && <div className="py-16 text-center text-slate-500">Loading price history…</div>}
    {error && <div className="my-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {!loading && !error && points.length > 0 && <div className="mt-2 w-full" style={{ height: chartHeight }}>
      {mode === 'Candle' ? <ResponsiveContainer width="100%" height="100%"><BarChart data={points} margin={{ top: 18, right: 20, bottom: 6, left: 8 }}><CartesianGrid stroke="#e5e7eb" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="date" tickFormatter={tick} minTickGap={34} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} /><YAxis domain={domain} tickFormatter={yAxisTick} width={78} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip content={tooltip} /><Bar dataKey="value" shape={<CandleShape domain={domain} chartHeight={chartHeight} />} isAnimationActive={false} /></BarChart></ResponsiveContainer>
        : <ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 18, right: 20, bottom: 6, left: 8 }}><defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColor} stopOpacity={0.34} /><stop offset="95%" stopColor={chartColor} stopOpacity={0.015} /></linearGradient></defs><CartesianGrid stroke="#e5e7eb" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="date" tickFormatter={tick} minTickGap={34} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} /><YAxis domain={domain} tickFormatter={yAxisTick} width={78} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip content={tooltip} />{mode === 'Bar' ? <Bar dataKey="value" fill={commodity === 'gold' ? '#0F2340' : chartColor} radius={[3, 3, 0, 0]} /> : mode === 'Area' ? <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2.5} fill={`url(#${gradientId})`} activeDot={{ r: 4 }} connectNulls={false} /> : <Line type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls={false} />}{forecast.length > 0 && <Line dataKey="forecastValue" name="Trend estimate" stroke="#64748b" strokeDasharray="5 4" dot={false} connectNulls />}</ComposedChart></ResponsiveContainer>}
    </div>}
    {isSample && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">Illustrative smooth sample data — not a live gold quote.</p>}
    {priceSource && <p className="mt-2 text-xs text-slate-500">Source: {priceSource} · Latest available: {latest ? formatLongDate(latest.date) : '—'}</p>}
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3"><span className="text-xs font-semibold text-slate-500">Forecast</span><button type="button" onClick={() => makeForecast(3)} className="chart-control">3 days</button><button type="button" onClick={() => makeForecast(4)} className="chart-control">4 days</button><input value={customDays} onChange={event => setCustomDays(event.target.value)} placeholder="Days" inputMode="numeric" className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900" /><button type="button" onClick={() => { const value = Number.parseInt(customDays, 10); if (value > 0 && value <= 30) makeForecast(value); }} className="chart-control">Predict</button>{forecast.length > 0 && <button type="button" onClick={() => setForecast([])} className="chart-control">Clear</button>}</div>
  </div>;
}
