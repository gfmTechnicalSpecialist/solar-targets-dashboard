import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarDays, ChevronDown, RefreshCw, AlertTriangle, Target, Loader2, Sun, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import {
  BarChart,
  Bar,
  Line,
  Area,
  AreaChart,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { fetchDailyProduction, fetchDailyIrradiance, type DailyProductionPoint, type DailyIrradiancePoint } from '../api/higeco';
import targetsConfig from '../data/targets.json';

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  return day === 0 || day === 6;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDefaultCustomRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

interface WeeklyPoint {
  weekLabel: string;
  avgProductionKwh: number;
  avgLoadKwh: number;
  avgLoadDuringSolarKwh: number;
  avgLoadOutsideSolarKwh: number;
  days: number;
}

function aggregateWeekly(data: DailyProductionPoint[]): WeeklyPoint[] {
  const weeks: Map<string, DailyProductionPoint[]> = new Map();
  for (const d of data) {
    const dt = new Date(d.date + 'T12:00:00');
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(dt);
    monday.setDate(diff);
    const weekKey = toIsoDate(monday);
    if (!weeks.has(weekKey)) weeks.set(weekKey, []);
    weeks.get(weekKey)!.push(d);
  }
  const result: WeeklyPoint[] = [];
  const sorted = Array.from(weeks.entries()).sort(([a], [b]) => a.localeCompare(b));
  for (const [weekStart, points] of sorted) {
    const n = points.length;
    const ms = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date(weekStart + 'T12:00:00');
    const label = `${ms[d.getMonth()]} ${d.getDate().toString().padStart(2, '0')}`;
    const totalProd = points.reduce((s, p) => s + p.productionKwh, 0);
    const totalLoad = points.reduce((s, p) => s + p.loadKwh, 0);
    const totalLoadSolar = points.reduce((s, p) => s + p.loadDuringSolarKwh, 0);
    result.push({
      weekLabel: `Wk ${label}`,
      avgProductionKwh: Math.round(totalProd / n * 10) / 10,
      avgLoadKwh: Math.round(totalLoad / n * 10) / 10,
      avgLoadDuringSolarKwh: Math.round(totalLoadSolar / n * 10) / 10,
      avgLoadOutsideSolarKwh: Math.round((totalLoad - totalLoadSolar) / n * 10) / 10,
      days: n,
    });
  }
  return result;
}

interface WeeklyIrradiancePoint {
  weekLabel: string;
  avgProductionKwh: number;
  avgIrradiance: number;
  days: number;
}

function aggregateWeeklyIrradiance(
  irradianceData: { dateLabel: string; date: string; productionKwh: number; irradiance: number }[],
): WeeklyIrradiancePoint[] {
  const weeks: Map<string, typeof irradianceData> = new Map();
  for (const d of irradianceData) {
    const dt = new Date(d.date + 'T12:00:00');
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(dt);
    monday.setDate(diff);
    const weekKey = toIsoDate(monday);
    if (!weeks.has(weekKey)) weeks.set(weekKey, []);
    weeks.get(weekKey)!.push(d);
  }
  const result: WeeklyIrradiancePoint[] = [];
  const sorted = Array.from(weeks.entries()).sort(([a], [b]) => a.localeCompare(b));
  for (const [weekStart, points] of sorted) {
    const n = points.length;
    const ms = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date(weekStart + 'T12:00:00');
    const label = `${ms[d.getMonth()]} ${d.getDate().toString().padStart(2, '0')}`;
    const totalProd = points.reduce((s, p) => s + p.productionKwh, 0);
    const totalIrr = points.reduce((s, p) => s + p.irradiance, 0);
    result.push({
      weekLabel: `Wk ${label}`,
      avgProductionKwh: Math.round(totalProd / n * 10) / 10,
      avgIrradiance: Math.round(totalIrr / n * 100) / 100,
      days: n,
    });
  }
  return result;
}

const ByDayTab: React.FC = () => {
  const { user } = useAuth();
  const { siteId, siteLabel: globalSiteLabel } = useSite();
  const activeSite: 'parc-du-cap' | 'centurion' =
    siteId === 'centurion' ? 'centurion' : 'parc-du-cap';
  const [range, setRange] = useState<'7' | '15' | '30' | 'custom'>('30');
  const defaults = getDefaultCustomRange();
  const [customStartDate, setCustomStartDate] = useState(defaults.startDate);
  const [customEndDate, setCustomEndDate] = useState(defaults.endDate);
  const [data, setData] = useState<DailyProductionPoint[]>([]);
  const [irradianceRaw, setIrradianceRaw] = useState<DailyIrradiancePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Daily production target from config file
  const siteTargets = (targetsConfig as Record<string, Record<string, number>>)[siteId] ?? {};
  const dailyTarget = siteTargets['dailyTarget'] ?? 0;

  const siteLabel = siteId === 'all' ? 'All Sites' : globalSiteLabel;
  const customRangeValid = Boolean(customStartDate && customEndDate && customStartDate <= customEndDate);
  const customDaysCount = customRangeValid
    ? Math.floor((new Date(customEndDate + 'T00:00:00').getTime() - new Date(customStartDate + 'T00:00:00').getTime()) / 86400000) + 1
    : 0;
  const daysCount = range === 'custom' ? customDaysCount : Number(range);
  const showLongRangeWarning = daysCount > 30;

  const loadData = useCallback(async () => {
    if (!user?.token) return;
    if (range === 'custom' && !customRangeValid) {
      setError('Please select a valid custom date range.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      let result: DailyProductionPoint[];
      let irrResult: DailyIrradiancePoint[] | null = null;
      const dateOptions = range === 'custom'
        ? { startDate: customStartDate, endDate: customEndDate }
        : undefined;
      if (siteId === 'all') {
        const [pdc, cen, irrPdc, irrCen] = await Promise.all([
          fetchDailyProduction(user.token, daysCount, 'parc-du-cap', dateOptions),
          fetchDailyProduction(user.token, daysCount, 'centurion', dateOptions),
          fetchDailyIrradiance(user.token, daysCount, 'parc-du-cap', dateOptions),
          fetchDailyIrradiance(user.token, daysCount, 'centurion', dateOptions),
        ]);
        result = pdc.map((p, i) => ({
          date: p.date,
          dateLabel: p.dateLabel,
          productionKwh: Math.round((p.productionKwh + (cen[i]?.productionKwh ?? 0)) * 10) / 10,
          loadKwh: Math.round((p.loadKwh + (cen[i]?.loadKwh ?? 0)) * 10) / 10,
          loadDuringSolarKwh: Math.round((p.loadDuringSolarKwh + (cen[i]?.loadDuringSolarKwh ?? 0)) * 10) / 10,
        }));
        // Average irradiance across sites that have it
        const sources = [irrPdc, irrCen].filter(Boolean) as DailyIrradiancePoint[][];
        if (sources.length > 0) {
          irrResult = sources[0].map((p, i) => ({
            date: p.date,
            dateLabel: p.dateLabel,
            irradianceKwhM2: Math.round(sources.reduce((s, src) => s + (src[i]?.irradianceKwhM2 ?? 0), 0) / sources.length * 100) / 100,
          }));
        }
      } else {
        const [prod, irr] = await Promise.all([
          fetchDailyProduction(user.token, daysCount, activeSite, dateOptions),
          fetchDailyIrradiance(user.token, daysCount, activeSite, dateOptions),
        ]);
        result = prod;
        irrResult = irr;
      }
      setData(result);
      setIrradianceRaw(irrResult ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [
    user?.token,
    daysCount,
    siteId,
    activeSite,
    range,
    customStartDate,
    customEndDate,
    customRangeValid,
  ]);

  // Auto-fetch only for preset ranges; custom requires explicit Go button
  const [committedRange, setCommittedRange] = useState<string>(`${range}`);
  useEffect(() => {
    if (range !== 'custom') {
      loadData();
    }
  }, [range, user?.token, siteId, activeSite]);

  // Also reload when site changes while on custom (user already committed)
  useEffect(() => {
    if (range === 'custom' && committedRange === 'custom-go') {
      loadData();
    }
  }, [siteId, activeSite]);

  const today = new Date().toISOString().slice(0, 10);
  const completedDays = data.filter((d) => d.date !== today);
  const totalProduction = data.reduce((s, d) => s + d.productionKwh, 0);
  const totalLoad = data.reduce((s, d) => s + d.loadKwh, 0);

  // Enrich data with load split: during solar vs outside solar
  const enrichedData = data.map(d => ({
    ...d,
    loadOutsideSolarKwh: Math.round((d.loadKwh - d.loadDuringSolarKwh) * 10) / 10,
  }));
  const avgLoadDuringSolar = data.length > 0 ? Math.round(data.reduce((s, d) => s + d.loadDuringSolarKwh, 0) / data.length * 10) / 10 : 0;
  const avgLoadOutsideSolar = data.length > 0 ? Math.round(data.reduce((s, d) => s + (d.loadKwh - d.loadDuringSolarKwh), 0) / data.length * 10) / 10 : 0;
  const avgProduction = data.length > 0 ? Math.round((totalProduction / data.length) * 10) / 10 : 0;
  const avgLoad = data.length > 0 ? Math.round((totalLoad / data.length) * 10) / 10 : 0;
  const bestDay = completedDays.length > 0 ? completedDays.reduce((best, d) => (d.productionKwh > best.productionKwh ? d : best), completedDays[0]) : null;
  const worstDay = completedDays.length > 0 ? completedDays.reduce((worst, d) => (d.productionKwh < worst.productionKwh ? d : worst), completedDays[0]) : null;

  // Merge production + irradiance data by date
  const irradianceMap = new Map(irradianceRaw.map(d => [d.date, d.irradianceKwhM2]));
  const irradianceData = enrichedData.map(d => ({
    dateLabel: d.dateLabel,
    date: d.date,
    productionKwh: d.productionKwh,
    irradiance: irradianceMap.get(d.date) ?? 0,
  }));
  const hasIrradiance = irradianceRaw.length > 0;

  // Irradiance summary stats
  const avgIrradiance = hasIrradiance && irradianceRaw.length > 0
    ? Math.round(irradianceRaw.reduce((s, d) => s + d.irradianceKwhM2, 0) / irradianceRaw.length * 100) / 100
    : null;
  const bestDayIrr = bestDay ? (irradianceMap.get(bestDay.date) ?? null) : null;
  const worstDayIrr = worstDay ? (irradianceMap.get(worstDay.date) ?? null) : null;

  // Weekly aggregation for large datasets
  const isLargeDataset = daysCount > 90;
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const activeViewMode = isLargeDataset ? 'weekly' : daysCount <= 30 ? 'daily' : viewMode;
  const weeklyData = useMemo(() => aggregateWeekly(data), [data]);

  // Weekly irradiance aggregation for large datasets
  const [irrViewMode, setIrrViewMode] = useState<'daily' | 'weekly'>('daily');
  const activeIrrViewMode = isLargeDataset ? 'weekly' : daysCount <= 30 ? 'daily' : irrViewMode;
  const weeklyIrradianceData = useMemo(() => aggregateWeeklyIrradiance(irradianceData), [irradianceData]);

  const WeeklyTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const prod = payload.find((p: any) => p.dataKey === 'avgProductionKwh')?.value ?? 0;
      const loadSolar = payload.find((p: any) => p.dataKey === 'avgLoadDuringSolarKwh')?.value ?? 0;
      const loadOther = payload.find((p: any) => p.dataKey === 'avgLoadOutsideSolarKwh')?.value ?? 0;
      const totalLoad = loadSolar + loadOther;
      const week = weeklyData.find((w) => w.weekLabel === label);
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label} ({week?.days ?? 0} days)</p>
          <p style={{ color: 'var(--chart-solar)' }}>Avg Solar: {Math.round(prod)} kWh/day</p>
          <p style={{ color: 'var(--chart-load-solar)' }}>Avg Load (solar hrs): {Math.round(loadSolar)} kWh/day</p>
          <p style={{ color: 'var(--chart-load)' }}>Avg Load (non-solar): {Math.round(loadOther)} kWh/day</p>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Avg Total Load: {Math.round(totalLoad)} kWh/day</p>
        </div>
      );
    }
    return null;
  };

  const IrradianceTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const prod = payload.find((p: any) => p.dataKey === 'productionKwh')?.value ?? 0;
      const irr = payload.find((p: any) => p.dataKey === 'irradiance')?.value ?? 0;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label}</p>
          <p style={{ color: 'var(--chart-solar)' }}>Solar Production: {Math.round(prod)} kWh</p>
          <p style={{ color: 'var(--chart-production)' }}>Irradiance (GHI): {irr} kWh/m²</p>
        </div>
      );
    }
    return null;
  };

  const WeeklyIrradianceTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const prod = payload.find((p: any) => p.dataKey === 'avgProductionKwh')?.value ?? 0;
      const irr = payload.find((p: any) => p.dataKey === 'avgIrradiance')?.value ?? 0;
      const week = weeklyIrradianceData.find((w) => w.weekLabel === label);
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label} ({week?.days ?? 0} days)</p>
          <p style={{ color: 'var(--chart-solar)' }}>Avg Solar: {Math.round(prod)} kWh/day</p>
          <p style={{ color: 'var(--chart-production)' }}>Avg Irradiance: {irr} kWh/m²</p>
        </div>
      );
    }
    return null;
  };

  const BarTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const solar = payload.find((p: any) => p.dataKey === 'productionKwh')?.value ?? 0;
      const loadSolar = payload.find((p: any) => p.dataKey === 'loadDuringSolarKwh')?.value ?? 0;
      const loadOther = payload.find((p: any) => p.dataKey === 'loadOutsideSolarKwh')?.value ?? 0;
      const totalLoad = loadSolar + loadOther;
      const coverageSolarHrs = loadSolar > 0 ? Math.round((solar / loadSolar) * 1000) / 10 : 0;
      const coverageTotal = totalLoad > 0 ? Math.round((solar / totalLoad) * 1000) / 10 : 0;
      const point = data.find((d) => d.dateLabel === label);
      const isWe = point ? isWeekend(point.date) : false;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label}{isWe ? ' (Weekend)' : ''}</p>
          <p style={{ color: 'var(--chart-solar)' }}>Solar: {Math.round(solar)} kWh</p>
          <p style={{ color: 'var(--chart-load-solar)' }}>Load (solar hrs): {Math.round(loadSolar)} kWh</p>
          <p style={{ color: 'var(--chart-load)' }}>Load (non-solar): {Math.round(loadOther)} kWh</p>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Total Load: {Math.round(totalLoad)} kWh</p>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>PV Coverage (solar hrs): {coverageSolarHrs}%</p>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>PV Coverage (total load): {coverageTotal}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="page-kicker">History</p>
          <h1>By Day</h1>
          <p className="page-subtitle">Daily production vs load — {siteLabel} (Total Active Power)</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              background: 'var(--surface-hover)',
              border: 'none',
              borderRadius: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <label className="page-select">
            <CalendarDays size={14} />
            <span>Range</span>
            <div className="select-wrap">
              <select value={range} onChange={(e) => setRange(e.target.value as '7' | '15' | '30' | 'custom')}>
                <option value="7">Last 7 Days</option>
                <option value="15">Last 15 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="custom">Custom Dates</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </label>
          {range === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>From</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  style={{
                    background: 'var(--surface-hover)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    borderRadius: 8,
                    padding: '6px 8px',
                    fontSize: '0.8rem',
                  }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>To</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  style={{
                    background: 'var(--surface-hover)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    borderRadius: 8,
                    padding: '6px 8px',
                    fontSize: '0.8rem',
                  }}
                />
              </label>
              <button
                onClick={() => { setCommittedRange('custom-go'); loadData(); }}
                disabled={loading || !customRangeValid}
                style={{
                  background: 'var(--chart-solar)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 16px',
                  cursor: customRangeValid ? 'pointer' : 'not-allowed',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  opacity: loading || !customRangeValid ? 0.5 : 1,
                }}
              >
                Go
              </button>
            </div>
          )}
        </div>
      </section>

      {showLongRangeWarning && (
        <section style={{
          padding: '12px 16px',
          background: 'rgba(245, 158, 11, 0.12)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--warning, #d97706)',
          fontSize: '0.85rem',
          marginBottom: 16,
        }}>
          <AlertTriangle size={16} />
          Selected timeline is more than 30 days. This might take a while because of how much data is required.
        </section>
      )}

      {error && (
        <section style={{
          padding: '12px 16px',
          background: 'var(--danger-bg, rgba(239,68,68,0.1))',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--danger)',
          fontSize: '0.85rem',
          marginBottom: 16,
        }}>
          <AlertTriangle size={16} />
          {error}
        </section>
      )}

      {/* Summary tiles */}
      <section className="overview-kpi-grid">
        <article className="overview-kpi-tile" style={{ borderLeft: '4px solid var(--chart-solar)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, width: '100%' }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12,
              background: 'rgba(245, 158, 11, 0.12)',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <Sun size={22} style={{ color: 'var(--chart-solar)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="overview-kpi-value">{loading ? '—' : `${avgProduction.toLocaleString()} kWh`}</div>
              <div className="overview-kpi-label">Avg Daily Production</div>
              {!loading && avgIrradiance !== null && (
                <div style={{ marginTop: 8, padding: '4px 8px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 6, fontSize: '0.75rem', color: 'var(--chart-production)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  ☀ {avgIrradiance} kWh/m² avg irradiance
                </div>
              )}
            </div>
          </div>
        </article>
        <article className="overview-kpi-tile" style={{ borderLeft: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, width: '100%' }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12,
              background: 'rgba(34, 197, 94, 0.12)',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <TrendingUp size={22} style={{ color: 'var(--success)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="overview-kpi-value" style={{ color: 'var(--success)' }}>
                {loading || !bestDay ? '—' : `${bestDay.productionKwh.toLocaleString()} kWh`}
              </div>
              <div className="overview-kpi-label">
                Peak Production{bestDay ? ` (${bestDay.dateLabel})` : ''}
              </div>
              {!loading && bestDayIrr !== null && (
                <div style={{ marginTop: 8, padding: '4px 8px', background: 'rgba(34, 197, 94, 0.08)', borderRadius: 6, fontSize: '0.75rem', color: 'var(--chart-production)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  ☀ {bestDayIrr} kWh/m²
                </div>
              )}
            </div>
          </div>
        </article>
        <article className="overview-kpi-tile" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, width: '100%' }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.12)',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <TrendingDown size={22} style={{ color: 'var(--danger)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="overview-kpi-value" style={{ color: 'var(--danger)' }}>
                {loading || !worstDay ? '—' : `${worstDay.productionKwh.toLocaleString()} kWh`}
              </div>
              <div className="overview-kpi-label">
                Lowest Production{worstDay ? ` (${worstDay.dateLabel})` : ''}
              </div>
              {!loading && worstDayIrr !== null && (
                <div style={{ marginTop: 8, padding: '4px 8px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 6, fontSize: '0.75rem', color: 'var(--chart-production)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  ☀ {worstDayIrr} kWh/m²
                </div>
              )}
            </div>
          </div>
        </article>
        <article className="overview-kpi-tile" style={{ borderLeft: '4px solid var(--chart-load)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, width: '100%' }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12,
              background: 'rgba(99, 102, 241, 0.12)',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <Zap size={22} style={{ color: 'var(--chart-load)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="overview-kpi-value" style={{ color: 'var(--chart-load)' }}>
                {loading ? '—' : `${avgLoad.toLocaleString()} kWh`}
              </div>
              <div className="overview-kpi-label">Avg Daily Consumption</div>
            </div>
          </div>
        </article>
      </section>

      {/* Production chart — adaptive display */}
      <section className="detail-grid" style={{ marginTop: 0 }}>
        <article className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              {activeViewMode === 'weekly' ? `Weekly Avg Solar Production vs Load — ${siteLabel}` : `Daily Solar Production vs Load — ${siteLabel}`}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {daysCount > 30 && daysCount <= 90 && (
                <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  <button
                    onClick={() => setViewMode('daily')}
                    style={{
                      padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: viewMode === 'daily' ? 'var(--chart-solar)' : 'var(--surface-hover)',
                      color: viewMode === 'daily' ? '#fff' : 'var(--text-secondary)',
                    }}
                  >Daily</button>
                  <button
                    onClick={() => setViewMode('weekly')}
                    style={{
                      padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: viewMode === 'weekly' ? 'var(--chart-solar)' : 'var(--surface-hover)',
                      color: viewMode === 'weekly' ? '#fff' : 'var(--text-secondary)',
                    }}
                  >Weekly</button>
                </div>
              )}
              {isLargeDataset && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Aggregated to weekly averages ({weeklyData.length} weeks)
                </span>
              )}
              {dailyTarget > 0 && (
                <span
                  style={{
                    background: 'var(--chart-solar)',
                    borderRadius: 8,
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  <Target size={14} />
                  Target: {dailyTarget.toLocaleString()} kWh
                </span>
              )}
            </div>
          </div>
          {loading && data.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)', gap: 12 }}>
              <Loader2 size={28} className="spin" style={{ color: 'var(--chart-solar)' }} />
              Loading data from Higeco…
            </div>
          ) : data.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)' }}>
              No data available for this range.
            </div>
          ) : activeViewMode === 'weekly' ? (
            /* ── WEEKLY AREA CHART ── */
            <div style={{ position: 'relative' }}>
              {loading && (
                <div className="chart-loading-overlay">
                  <div className="chart-loading-inner">
                    <Loader2 size={22} className="spin" />
                    Loading…
                  </div>
                </div>
              )}
              <ResponsiveContainer width="100%" height={370}>
                <AreaChart data={weeklyData} margin={{ bottom: 50, left: 10 }}>
                  <defs>
                    <linearGradient id="gradSolar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-solar)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--chart-solar)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradLoad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-load)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--chart-load)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="weekLabel"
                    stroke="var(--text-muted)"
                    fontSize={10}
                    tickLine={false}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    label={{ value: 'kWh/day', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)', fontSize: 11 } }}
                  />
                  <Tooltip content={<WeeklyTooltip />} />
                  {dailyTarget > 0 && (
                    <ReferenceLine y={dailyTarget} stroke="var(--chart-target)" strokeWidth={2} strokeDasharray="8 4" />
                  )}
                  <Area dataKey="avgLoadKwh" name="Avg Load" stroke="var(--chart-load)" fill="url(#gradLoad)" strokeWidth={2} dot={false} />
                  <Area dataKey="avgProductionKwh" name="Avg Solar" stroke="var(--chart-solar)" fill="url(#gradSolar)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--chart-solar)' }} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="chart-legend" style={{ marginTop: 12 }}>
                <div className="legend-item">
                  <div className="legend-dot" style={{ backgroundColor: 'var(--chart-solar)', opacity: 0.92 }} />
                  <span>Avg Solar Production (kWh/day)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-dot" style={{ backgroundColor: 'var(--chart-load)', opacity: 0.7 }} />
                  <span>Avg Total Load (kWh/day)</span>
                </div>
                {dailyTarget > 0 && (
                  <div className="legend-item">
                    <div className="legend-dot" style={{ backgroundColor: 'var(--chart-target)', width: 20, height: 2, borderRadius: 0 }} />
                    <span>Daily Target ({dailyTarget.toLocaleString()} kWh)</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {loading && (
                <div className="chart-loading-overlay">
                  <div className="chart-loading-inner">
                    <Loader2 size={22} className="spin" />
                    Switching site…
                  </div>
                </div>
              )}
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={enrichedData} barGap={2} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  {/* Weekend shading */}
                  {enrichedData.map((d) =>
                    isWeekend(d.date) ? (
                      <ReferenceArea
                        key={d.date}
                        x1={d.dateLabel}
                        x2={d.dateLabel}
                        fill="#f1f5f9"
                        fillOpacity={0.7}
                        ifOverflow="extendDomain"
                      />
                    ) : null,
                  )}
                  <XAxis
                    dataKey="dateLabel"
                    stroke="var(--text-muted)"
                    fontSize={10}
                    tickLine={false}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    tick={({ x, y, payload }: any) => {
                      const point = data.find((d) => d.dateLabel === payload.value);
                      const isWe = point ? isWeekend(point.date) : false;
                      return (
                        <text
                          x={x}
                          y={y + 4}
                          textAnchor="end"
                          fontSize={10}
                          fill={isWe ? '#6366f1' : 'var(--text-muted)'}
                          fontWeight={isWe ? 600 : 400}
                          transform={`rotate(-45, ${x}, ${y + 4})`}
                        >
                          {payload.value}{isWe ? ' *' : ''}
                        </text>
                      );
                    }}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)', fontSize: 11 } }}
                  />
                  <Tooltip content={<BarTooltip />} />
                  {dailyTarget > 0 && (
                    <ReferenceLine
                      y={dailyTarget}
                      stroke="var(--chart-target)"
                      strokeWidth={2}
                      strokeDasharray="8 4"
                    />
                  )}
                  <Bar dataKey="loadDuringSolarKwh" stackId="load" name="Load (solar hrs)" fill="var(--chart-load-solar)" opacity={0.85} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="loadOutsideSolarKwh" stackId="load" name="Load (non-solar)" fill="var(--chart-load)" opacity={0.7} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="productionKwh" fill="var(--chart-solar)" opacity={0.92} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="chart-legend" style={{ marginTop: 12 }}>
                <div className="legend-item">
                  <div className="legend-dot" style={{ backgroundColor: 'var(--chart-solar)', opacity: 0.92 }} />
                  <span>Solar Production — Avg {avgProduction} kWh</span>
                </div>
                <div className="legend-item">
                  <div className="legend-dot" style={{ backgroundColor: 'var(--chart-load-solar)', opacity: 0.7 }} />
                  <span>Load (solar hrs) — Avg {avgLoadDuringSolar} kWh</span>
                </div>
                <div className="legend-item">
                  <div className="legend-dot" style={{ backgroundColor: 'var(--chart-load)', opacity: 0.55 }} />
                  <span>Load (non-solar) — Avg {avgLoadOutsideSolar} kWh</span>
                </div>
                {dailyTarget > 0 && (
                  <div className="legend-item">
                    <div className="legend-dot" style={{ backgroundColor: 'var(--chart-target)', width: 20, height: 2, borderRadius: 0 }} />
                    <span>Daily Target ({dailyTarget.toLocaleString()} kWh)</span>
                  </div>
                )}
                <div className="legend-item">
                  <div className="legend-dot" style={{ backgroundColor: 'var(--chart-weekend)', border: '1px solid var(--border-subtle)', width: 14, height: 14, borderRadius: 2 }} />
                  <span>Weekend</span>
                </div>
              </div>
            </div>
          )}
        </article>
      </section>

      {/* Irradiance vs Accumulated Production — adaptive display */}
      <section className="detail-grid" style={{ marginTop: 24 }}>
        <article className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              {activeIrrViewMode === 'weekly' ? `Weekly Avg Irradiance vs Production — ${siteLabel}` : `Solar Irradiance vs Accumulated Production — ${siteLabel}`}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {daysCount > 30 && daysCount <= 90 && (
                <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                  <button
                    onClick={() => setIrrViewMode('daily')}
                    style={{
                      padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: irrViewMode === 'daily' ? 'var(--chart-production)' : 'var(--surface-hover)',
                      color: irrViewMode === 'daily' ? '#fff' : 'var(--text-secondary)',
                    }}
                  >Daily</button>
                  <button
                    onClick={() => setIrrViewMode('weekly')}
                    style={{
                      padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: irrViewMode === 'weekly' ? 'var(--chart-production)' : 'var(--surface-hover)',
                      color: irrViewMode === 'weekly' ? '#fff' : 'var(--text-secondary)',
                    }}
                  >Weekly</button>
                </div>
              )}
              {isLargeDataset && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Aggregated to weekly averages ({weeklyIrradianceData.length} weeks)
                </span>
              )}
              {!hasIrradiance && !loading && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No weather station data for this site</span>
              )}
            </div>
          </div>
          {data.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)' }}>
              No data available for this range.
            </div>
          ) : activeIrrViewMode === 'weekly' ? (
            /* ── WEEKLY IRRADIANCE AREA CHART ── */
            <div style={{ position: 'relative' }}>
              {loading && (
                <div className="chart-loading-overlay">
                  <div className="chart-loading-inner">
                    <Loader2 size={22} className="spin" />
                    Loading…
                  </div>
                </div>
              )}
              <ResponsiveContainer width="100%" height={370}>
                <AreaChart data={weeklyIrradianceData} margin={{ bottom: 50, left: 10 }}>
                  <defs>
                    <linearGradient id="gradIrrSolar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-solar)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--chart-solar)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradIrr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-production)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--chart-production)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="weekLabel"
                    stroke="var(--text-muted)"
                    fontSize={10}
                    tickLine={false}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                  />
                  <YAxis
                    yAxisId="kwh"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    label={{ value: 'kWh/day', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)', fontSize: 11 } }}
                  />
                  <YAxis
                    yAxisId="irr"
                    orientation="right"
                    stroke="var(--chart-production)"
                    fontSize={11}
                    tickLine={false}
                    label={{ value: 'kWh/m²', angle: 90, position: 'insideRight', style: { fill: 'var(--chart-production)', fontSize: 11 } }}
                  />
                  <Tooltip content={<WeeklyIrradianceTooltip />} />
                  <Area yAxisId="kwh" dataKey="avgProductionKwh" name="Avg Solar" stroke="var(--chart-solar)" fill="url(#gradIrrSolar)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--chart-solar)' }} />
                  <Area yAxisId="irr" dataKey="avgIrradiance" name="Avg Irradiance" stroke="var(--chart-production)" fill="url(#gradIrr)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="chart-legend" style={{ marginTop: 12 }}>
                <div className="legend-item">
                  <div className="legend-dot" style={{ backgroundColor: 'var(--chart-solar)', opacity: 0.92 }} />
                  <span>Avg Solar Production (kWh/day)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-line" style={{ backgroundColor: 'var(--chart-production)' }} />
                  <span>Avg Irradiance — GHI (kWh/m²)</span>
                </div>
              </div>
            </div>
          ) : (
            /* ── DAILY IRRADIANCE COMPOSED CHART ── */
            <div>
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={irradianceData} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="dateLabel"
                    stroke="var(--text-muted)"
                    fontSize={10}
                    tickLine={false}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    tick={({ x, y, payload }: any) => {
                      const point = data.find((d) => d.dateLabel === payload.value);
                      const isWe = point ? isWeekend(point.date) : false;
                      return (
                        <text
                          x={x}
                          y={y + 4}
                          textAnchor="end"
                          fontSize={10}
                          fill={isWe ? '#6366f1' : 'var(--text-muted)'}
                          fontWeight={isWe ? 600 : 400}
                          transform={`rotate(-45, ${x}, ${y + 4})`}
                        >
                          {payload.value}{isWe ? ' *' : ''}
                        </text>
                      );
                    }}
                  />
                  <YAxis
                    yAxisId="kwh"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)', fontSize: 11 } }}
                  />
                  <YAxis
                    yAxisId="irr"
                    orientation="right"
                    stroke="var(--chart-production)"
                    fontSize={11}
                    tickLine={false}
                    label={{ value: 'kWh/m²', angle: 90, position: 'insideRight', style: { fill: 'var(--chart-production)', fontSize: 11 } }}
                  />
                  <Tooltip content={<IrradianceTooltip />} />
                  <Bar yAxisId="kwh" dataKey="productionKwh" name="Solar Production" fill="var(--chart-solar)" opacity={0.85} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="irr" dataKey="irradiance" name="Irradiance (GHI)" stroke="var(--chart-production)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--chart-production)' }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="chart-legend" style={{ marginTop: 12 }}>
                <div className="legend-item">
                  <div className="legend-dot" style={{ backgroundColor: 'var(--chart-solar)', opacity: 0.85 }} />
                  <span>Accumulated Solar Production (kWh)</span>
                </div>
                <div className="legend-item">
                  <div className="legend-line" style={{ backgroundColor: 'var(--chart-production)' }} />
                  <span>Solar Irradiance — GHI (kWh/m²)</span>
                </div>
              </div>
            </div>
          )}
        </article>
      </section>

    </>
  );
};

export default ByDayTab;
