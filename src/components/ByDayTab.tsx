import React, { useState, useEffect, useCallback } from 'react';
import { CalendarDays, ChevronDown, RefreshCw, AlertTriangle, Target, Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
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
import { fetchDailyProduction, type DailyProductionPoint } from '../api/higeco';
import targetsConfig from '../data/targets.json';

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  return day === 0 || day === 6;
}

const ByDayTab: React.FC = () => {
  const { user } = useAuth();
  const { siteId, siteLabel: globalSiteLabel } = useSite();
  const activeSite: 'parc-du-cap' | 'centurion' =
    siteId === 'centurion' ? 'centurion' : 'parc-du-cap';
  const [range, setRange] = useState<'7' | '15' | '30'>('30');
  const [data, setData] = useState<DailyProductionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Daily production target from config file
  const siteTargets = (targetsConfig as Record<string, Record<string, number>>)[siteId] ?? {};
  const dailyTarget = siteTargets['dailyTarget'] ?? 0;

  const siteLabel = siteId === 'all' ? 'All Sites' : globalSiteLabel;
  const daysCount = Number(range);

  const loadData = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    setError('');
    try {
      let result: DailyProductionPoint[];
      if (siteId === 'all') {
        const [pdc, cen] = await Promise.all([
          fetchDailyProduction(user.token, daysCount, 'parc-du-cap'),
          fetchDailyProduction(user.token, daysCount, 'centurion'),
        ]);
        result = pdc.map((p, i) => ({
          date: p.date,
          dateLabel: p.dateLabel,
          productionKwh: Math.round((p.productionKwh + (cen[i]?.productionKwh ?? 0)) * 10) / 10,
          loadKwh: Math.round((p.loadKwh + (cen[i]?.loadKwh ?? 0)) * 10) / 10,
          loadDuringSolarKwh: Math.round((p.loadDuringSolarKwh + (cen[i]?.loadDuringSolarKwh ?? 0)) * 10) / 10,
        }));
      } else {
        result = await fetchDailyProduction(user.token, daysCount, activeSite);
      }
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user?.token, daysCount, siteId, activeSite]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const BarTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const solar = payload.find((p: any) => p.dataKey === 'productionKwh')?.value ?? 0;
      const loadSolar = payload.find((p: any) => p.dataKey === 'loadDuringSolarKwh')?.value ?? 0;
      const loadOther = payload.find((p: any) => p.dataKey === 'loadOutsideSolarKwh')?.value ?? 0;
      const totalLoad = loadSolar + loadOther;
      const coverage = totalLoad > 0 ? Math.round((solar / totalLoad) * 1000) / 10 : 0;
      const point = data.find((d) => d.dateLabel === label);
      const isWe = point ? isWeekend(point.date) : false;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label}{isWe ? ' (Weekend)' : ''}</p>
          <p style={{ color: 'var(--chart-solar)' }}>Solar: {Math.round(solar)} kWh</p>
          <p style={{ color: 'var(--chart-load-solar)' }}>Load (solar hrs): {Math.round(loadSolar)} kWh</p>
          <p style={{ color: 'var(--chart-load)' }}>Load (non-solar): {Math.round(loadOther)} kWh</p>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Total Load: {Math.round(totalLoad)} kWh</p>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>PV Coverage: {coverage}%</p>
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
              <select value={range} onChange={(e) => setRange(e.target.value as '7' | '15' | '30')}>
                <option value="7">Last 7 Days</option>
                <option value="15">Last 15 Days</option>
                <option value="30">Last 30 Days</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </label>
        </div>
      </section>

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
        <article className="overview-kpi-tile">
          <div>
            <div className="overview-kpi-value">{loading ? '—' : `${avgProduction} kWh`}</div>
            <div className="overview-kpi-label">Avg Daily Production</div>
          </div>
        </article>
        <article className="overview-kpi-tile">
          <div>
            <div className="overview-kpi-value" style={{ color: 'var(--chart-load)' }}>
              {loading ? '—' : `${avgLoad} kWh`}
            </div>
            <div className="overview-kpi-label">Avg Daily Consumption</div>
          </div>
        </article>
        <article className="overview-kpi-tile">
          <div>
            <div className="overview-kpi-value" style={{ color: 'var(--success)' }}>
              {loading || !bestDay ? '—' : `${bestDay.productionKwh} kWh`}
            </div>
            <div className="overview-kpi-label">
              Best Day{bestDay ? ` (${bestDay.dateLabel})` : ''}
            </div>
          </div>
        </article>
        <article className="overview-kpi-tile">
          <div>
            <div className="overview-kpi-value" style={{ color: 'var(--danger)' }}>
              {loading || !worstDay ? '—' : `${worstDay.productionKwh} kWh`}
            </div>
            <div className="overview-kpi-label">
              Worst Day{worstDay ? ` (${worstDay.dateLabel})` : ''}
            </div>
          </div>
        </article>
      </section>

      {/* Production bars — REAL DATA */}
      <section className="detail-grid" style={{ marginTop: 0 }}>
        <article className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Daily Solar Production vs Load</h3>
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
          {loading && data.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)', gap: 12 }}>
              <Loader2 size={28} className="spin" style={{ color: 'var(--chart-solar)' }} />
              Loading data from Higeco…
            </div>
          ) : data.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)' }}>
              No data available for this range.
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
                  <Bar dataKey="loadDuringSolarKwh" stackId="load" name="Load (solar hrs)" fill="var(--chart-load-solar)" opacity={0.7} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="loadOutsideSolarKwh" stackId="load" name="Load (non-solar)" fill="var(--chart-load)" opacity={0.55} radius={[3, 3, 0, 0]} />
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


    </>
  );
};

export default ByDayTab;
