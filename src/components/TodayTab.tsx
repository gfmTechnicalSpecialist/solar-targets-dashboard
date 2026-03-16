import React from 'react';
import {
  Sun,
  Zap,
  TrendingUp,
  BatteryCharging,
  Clock3,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useSite } from '../context/SiteContext';

const TodayTab: React.FC = () => {
  const { siteData } = useSite();
  const { currentMetrics, hourlyData } = siteData;
  const totalSolarToday = hourlyData.reduce((s, h) => s + h.solarKw, 0);
  const totalLoadToday = hourlyData.reduce((s, h) => s + h.loadKw, 0);
  const peakHour = hourlyData.reduce((max, h) => (h.solarKw > max.solarKw ? h : max), hourlyData[0]);
  const selfConsumed = hourlyData.reduce((s, h) => s + Math.min(h.solarKw, h.loadKw), 0);
  const selfConsumptionRate = Math.round((selfConsumed / Math.max(totalSolarToday, 1)) * 100);
  const currentHour = new Date().getHours();
  const isGenerating = currentHour >= 6 && currentHour <= 19;

  const PowerTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const solar = payload.find((p: any) => p.dataKey === 'solarKw')?.value ?? 0;
      const load = payload.find((p: any) => p.dataKey === 'loadKw')?.value ?? 0;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label}</p>
          <p style={{ color: 'var(--chart-solar)' }}>Solar: {solar} kW</p>
          <p style={{ color: 'var(--chart-load)' }}>Load: {load} kW</p>
          <p style={{ color: solar >= load ? 'var(--success)' : 'var(--danger)', fontWeight: 700, marginTop: 4 }}>
            Net: {(solar - load).toFixed(1)} kW
          </p>
        </div>
      );
    }
    return null;
  };

  const NetTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const net = payload[0]?.value ?? 0;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label}</p>
          <p style={{ color: net >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
            {net >= 0 ? 'Export' : 'Import'}: {Math.abs(net)} kW
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
          <p className="page-subtitle">Live performance monitoring for today's solar generation</p>
        </div>
        <div className={`status-indicator ${isGenerating ? 'status-on-track' : 'status-behind'}`}>
          {isGenerating ? <Sun size={14} /> : <Clock3 size={14} />}
          {isGenerating ? 'Generating' : 'After Hours'}
        </div>
      </section>

      {/* Today KPIs */}
      <section className="overview-kpi-grid today-kpi-grid">
        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <Sun size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">{currentMetrics.todayProduction} kWh</div>
            <div className="overview-kpi-label">Production</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
            <Zap size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">{currentMetrics.currentGeneration} kW</div>
            <div className="overview-kpi-label">Current Output</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">{currentMetrics.peakGeneration} kW</div>
            <div className="overview-kpi-label">Peak @ {peakHour.hour}</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <BatteryCharging size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">{selfConsumptionRate}%</div>
            <div className="overview-kpi-label">Self-Consumption</div>
          </div>
        </article>
      </section>

      {/* Power curve - solar vs load */}
      <section className="detail-grid">
        <article className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3>Hourly Power — Solar vs Load</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={hourlyData}>
              <defs>
                <linearGradient id="todaySolarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-solar)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-solar)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="todayLoadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-load)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--chart-load)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="hour" stroke="var(--text-muted)" fontSize={10} tickLine={false} interval={2} />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                label={{ value: 'kW', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)', fontSize: 11 } }}
              />
              <Tooltip content={<PowerTooltip />} />
              <Area
                type="monotone"
                dataKey="loadKw"
                stroke="var(--chart-load)"
                strokeWidth={2}
                fill="url(#todayLoadGrad)"
              />
              <Area
                type="monotone"
                dataKey="solarKw"
                stroke="var(--chart-solar)"
                strokeWidth={2.5}
                fill="url(#todaySolarGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="chart-legend" style={{ marginTop: 12 }}>
            <div className="legend-item">
              <div className="legend-line" style={{ backgroundColor: 'var(--chart-solar)' }} />
              <span>Solar (kW)</span>
            </div>
            <div className="legend-item">
              <div className="legend-line" style={{ backgroundColor: 'var(--chart-load)' }} />
              <span>Load (kW)</span>
            </div>
          </div>
        </article>
      </section>

      {/* Net export bar chart */}
      <section className="detail-grid" style={{ marginTop: 18 }}>
        <article className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3>Net Grid Exchange (kW)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="hour" stroke="var(--text-muted)" fontSize={10} tickLine={false} interval={2} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <ReferenceLine y={0} stroke="var(--text-muted)" strokeWidth={1} />
              <Tooltip content={<NetTooltip />} />
              <Bar dataKey="netKw" radius={[3, 3, 3, 3]} name="Net">
                {hourlyData.map((entry, i) => (
                  <rect
                    key={i}
                    fill={entry.netKw >= 0 ? 'var(--success)' : 'var(--danger)'}
                    fillOpacity={0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="chart-summary" style={{ marginTop: 12 }}>
            <div className="chart-summary-item">
              <div className="chart-summary-label">Total Generated</div>
              <div className="chart-summary-value" style={{ color: 'var(--chart-solar)' }}>
                {totalSolarToday.toFixed(1)} kWh
              </div>
            </div>
            <div className="chart-summary-item">
              <div className="chart-summary-label">Total Consumed</div>
              <div className="chart-summary-value" style={{ color: 'var(--chart-load)' }}>
                {totalLoadToday.toFixed(1)} kWh
              </div>
            </div>
            <div className="chart-summary-item">
              <div className="chart-summary-label">Net Balance</div>
              <div
                className="chart-summary-value"
                style={{ color: totalSolarToday >= totalLoadToday ? 'var(--success)' : 'var(--danger)' }}
              >
                {(totalSolarToday - totalLoadToday).toFixed(1)} kWh
              </div>
            </div>
          </div>
        </article>
      </section>
    </>
  );
};

export default TodayTab;
