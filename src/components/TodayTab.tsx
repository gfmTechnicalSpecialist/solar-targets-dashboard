import React, { useEffect, useState, useCallback } from 'react';
import {
  Sun,
  Zap,
  TrendingUp,
  Clock3,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { fetchTodaySolarData, type PowerDataPoint } from '../api/higeco';

interface ChartPoint {
  time: string;
  powerKw: number;
}

interface AllSitesChartPoint {
  time: string;
  parcDuCapKw: number | undefined;
  centurionKw: number | undefined;
}

function toSASTTimeString(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function toChartData(points: PowerDataPoint[]): ChartPoint[] {
  return points.map((p) => ({
    time: toSASTTimeString(p.timestamp),
    powerKw: p.powerKw,
  }));
}

function toAllSitesChartData(pdc: PowerDataPoint[], cen: PowerDataPoint[]): AllSitesChartPoint[] {
  // Floor timestamps to the start of each minute so both sites align.
  // Deduplicate within each site by keeping the last value per minute.
  const floorToMin = (ts: number) => Math.floor(ts / 60) * 60;

  const pdcByMin = new Map<number, number>();
  for (const p of pdc) pdcByMin.set(floorToMin(p.timestamp), p.powerKw);

  const cenByMin = new Map<number, number>();
  for (const p of cen) cenByMin.set(floorToMin(p.timestamp), p.powerKw);

  // Collect all unique minutes from both sites
  const allMinutes = new Set<number>([...pdcByMin.keys(), ...cenByMin.keys()]);

  return Array.from(allMinutes)
    .sort((a, b) => a - b)
    .map((ts) => ({
      time: toSASTTimeString(ts),
      parcDuCapKw: pdcByMin.get(ts),
      centurionKw: cenByMin.get(ts),
    }));
}

const TodayTab: React.FC = () => {
  const { user } = useAuth();
  const { siteId, siteLabel } = useSite();
  const [data, setData] = useState<ChartPoint[]>([]);
  const [allSitesData, setAllSitesData] = useState<AllSitesChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const activeSite: 'parc-du-cap' | 'centurion' =
    siteId === 'centurion' ? 'centurion' : 'parc-du-cap';
  const isAllSites = siteId === 'all';

  const loadData = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    setError('');
    try {
      if (isAllSites) {
        const [pdc, cen] = await Promise.all([
          fetchTodaySolarData(user.token, 'parc-du-cap'),
          fetchTodaySolarData(user.token, 'centurion'),
        ]);
        setAllSitesData(toAllSitesChartData(pdc, cen));
        setData([]);
      } else {
        const raw = await fetchTodaySolarData(user.token, activeSite);
        setData(toChartData(raw));
        setAllSitesData([]);
      }
      setLastUpdated(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user?.token, siteId, activeSite, isAllSites]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  const chartPoints = isAllSites ? allSitesData : data;
  const sampleHours = chartPoints.length > 1 ? 300 / 3600 : 0;

  // KPI helpers for single-site
  const currentOutput = data.length > 0 ? data[data.length - 1].powerKw : 0;
  const peakPoint = data.reduce<ChartPoint | null>(
    (max, p) => (!max || p.powerKw > max.powerKw ? p : max),
    null
  );
  const estimatedEnergy = (data.reduce((s, p) => s + p.powerKw, 0) * sampleHours).toFixed(1);

  // KPI helpers for all-sites (handle undefined from sparse data)
  const pdcLast = allSitesData.length > 0 ? [...allSitesData].reverse().find(p => p.parcDuCapKw !== undefined) : undefined;
  const cenLast = allSitesData.length > 0 ? [...allSitesData].reverse().find(p => p.centurionKw !== undefined) : undefined;
  const pdcCurrent = pdcLast?.parcDuCapKw ?? 0;
  const cenCurrent = cenLast?.centurionKw ?? 0;
  const pdcPeak = allSitesData.reduce<AllSitesChartPoint | null>(
    (max, p) => (!max || (p.parcDuCapKw ?? 0) > (max.parcDuCapKw ?? 0) ? p : max), null);
  const cenPeak = allSitesData.reduce<AllSitesChartPoint | null>(
    (max, p) => (!max || (p.centurionKw ?? 0) > (max.centurionKw ?? 0) ? p : max), null);
  const pdcEnergy = (allSitesData.reduce((s, p) => s + (p.parcDuCapKw ?? 0), 0) * sampleHours).toFixed(1);
  const cenEnergy = (allSitesData.reduce((s, p) => s + (p.centurionKw ?? 0), 0) * sampleHours).toFixed(1);

  const currentHour = parseInt(
    new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: 'numeric', hour12: false }),
    10
  );
  const isGenerating = currentHour >= 6 && currentHour <= 19;

  const PowerTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      if (isAllSites) {
        const pdcRaw = payload.find((p: any) => p.dataKey === 'parcDuCapKw')?.value;
        const cenRaw = payload.find((p: any) => p.dataKey === 'centurionKw')?.value;
        const pdc = typeof pdcRaw === 'number' ? pdcRaw : null;
        const cen = typeof cenRaw === 'number' ? cenRaw : null;
        return (
          <div className="custom-tooltip">
            <p className="tooltip-title">{label}</p>
            <p style={{ color: 'var(--chart-solar)' }}>Parc du Cap: {pdc !== null ? `${pdc.toFixed(1)} kW` : '—'}</p>
            <p style={{ color: 'var(--chart-load-solar)' }}>Centurion: {cen !== null ? `${cen.toFixed(1)} kW` : '—'}</p>
            <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Combined: {((pdc ?? 0) + (cen ?? 0)).toFixed(1)} kW</p>
          </div>
        );
      }
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label}</p>
          <p style={{ color: 'var(--chart-solar)' }}>
            Power: {payload[0].value.toFixed(1)} kW
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="page-kicker">Real-Time</p>
          <h1>Today</h1>
          <p className="page-subtitle">
            Live solar generation — {siteId === 'all' ? 'All Sites' : siteLabel} (Total Active Power)
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastUpdated && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Updated {lastUpdated.toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', hour12: false })} SAST
            </span>
          )}
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
          <div className={`status-indicator ${isGenerating ? 'status-on-track' : 'status-behind'}`}>
            {isGenerating ? <Sun size={14} /> : <Clock3 size={14} />}
            {isGenerating ? 'Generating' : 'After Hours'}
          </div>
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

      {/* KPIs */}
      {isAllSites ? (
        <section className="overview-kpi-grid today-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <article className="overview-kpi-tile">
            <div className="overview-kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
              <Sun size={20} />
            </div>
            <div>
              <div className="overview-kpi-value">{loading ? '—' : `${pdcEnergy} kWh`}</div>
              <div className="overview-kpi-label">Parc du Cap — Est. Energy</div>
            </div>
          </article>
          <article className="overview-kpi-tile">
            <div className="overview-kpi-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
              <Zap size={20} />
            </div>
            <div>
              <div className="overview-kpi-value">{loading ? '—' : `${pdcCurrent.toFixed(1)} kW`}</div>
              <div className="overview-kpi-label">Parc du Cap — Latest</div>
            </div>
          </article>
          <article className="overview-kpi-tile">
            <div className="overview-kpi-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="overview-kpi-value">{loading || !pdcPeak ? '—' : `${(pdcPeak.parcDuCapKw ?? 0).toFixed(1)} kW`}</div>
              <div className="overview-kpi-label">Parc du Cap — Peak{pdcPeak ? ` @ ${pdcPeak.time}` : ''}</div>
            </div>
          </article>
          <article className="overview-kpi-tile">
            <div className="overview-kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
              <Sun size={20} />
            </div>
            <div>
              <div className="overview-kpi-value">{loading ? '—' : `${cenEnergy} kWh`}</div>
              <div className="overview-kpi-label">Centurion — Est. Energy</div>
            </div>
          </article>
          <article className="overview-kpi-tile">
            <div className="overview-kpi-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
              <Zap size={20} />
            </div>
            <div>
              <div className="overview-kpi-value">{loading ? '—' : `${cenCurrent.toFixed(1)} kW`}</div>
              <div className="overview-kpi-label">Centurion — Latest</div>
            </div>
          </article>
          <article className="overview-kpi-tile">
            <div className="overview-kpi-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="overview-kpi-value">{loading || !cenPeak ? '—' : `${(cenPeak.centurionKw ?? 0).toFixed(1)} kW`}</div>
              <div className="overview-kpi-label">Centurion — Peak{cenPeak ? ` @ ${cenPeak.time}` : ''}</div>
            </div>
          </article>
        </section>
      ) : (
      <section className="overview-kpi-grid today-kpi-grid">
        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <Sun size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">
              {loading ? '—' : `${estimatedEnergy} kWh`}
            </div>
            <div className="overview-kpi-label">Est. Energy Today</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
            <Zap size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">
              {loading ? '—' : `${currentOutput.toFixed(1)} kW`}
            </div>
            <div className="overview-kpi-label">Latest Reading</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">
              {loading || !peakPoint ? '—' : `${peakPoint.powerKw.toFixed(1)} kW`}
            </div>
            <div className="overview-kpi-label">
              Peak{peakPoint ? ` @ ${peakPoint.time}` : ''}
            </div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <Clock3 size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">
              {loading ? '—' : data.length.toLocaleString()}
            </div>
            <div className="overview-kpi-label">Data Points</div>
          </div>
        </article>
      </section>
      )}

      {/* Power Curve Chart */}
      <section className="detail-grid">
        <article className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3>Solar Power — Total Active Power (kW)</h3>
          {loading && chartPoints.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 300,
              color: 'var(--text-muted)',
            }}>
              Loading data from Higeco…
            </div>
          ) : chartPoints.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 300,
              color: 'var(--text-muted)',
            }}>
              No data available for today yet.
            </div>
          ) : isAllSites ? (
            <>
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={allSitesData}>
                  <defs>
                    <linearGradient id="todayPdcGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-solar)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--chart-solar)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="todayCenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-load-solar)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--chart-load-solar)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="time"
                    stroke="var(--text-muted)"
                    fontSize={10}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={40}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    label={{
                      value: 'kW',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fill: 'var(--text-muted)', fontSize: 11 },
                    }}
                  />
                  <Tooltip content={<PowerTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="parcDuCapKw"
                    stroke="var(--chart-solar)"
                    strokeWidth={2}
                    fill="url(#todayPdcGrad)"
                    dot={false}
                    connectNulls
                    name="Parc du Cap"
                  />
                  <Area
                    type="monotone"
                    dataKey="centurionKw"
                    stroke="var(--chart-load-solar)"
                    strokeWidth={2}
                    fill="url(#todayCenGrad)"
                    dot={false}
                    connectNulls
                    name="Centurion"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="chart-legend" style={{ marginTop: 12 }}>
                <div className="legend-item">
                  <div className="legend-line" style={{ backgroundColor: 'var(--chart-solar)' }} />
                  <span>Parc du Cap</span>
                </div>
                <div className="legend-item">
                  <div className="legend-line" style={{ backgroundColor: 'var(--chart-load-solar)' }} />
                  <span>Centurion</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="todaySolarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-solar)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--chart-solar)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="time"
                    stroke="var(--text-muted)"
                    fontSize={10}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={40}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    label={{
                      value: 'kW',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fill: 'var(--text-muted)', fontSize: 11 },
                    }}
                  />
                  <Tooltip content={<PowerTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="powerKw"
                    stroke="var(--chart-solar)"
                    strokeWidth={2}
                    fill="url(#todaySolarGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="chart-legend" style={{ marginTop: 12 }}>
                <div className="legend-item">
                  <div className="legend-line" style={{ backgroundColor: 'var(--chart-solar)' }} />
                  <span>Total Active Power (kW)</span>
                </div>
              </div>
            </>
          )}
        </article>
      </section>
    </>
  );
};

export default TodayTab;
