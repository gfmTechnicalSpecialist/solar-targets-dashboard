import React, { useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts';
import { useSite } from '../context/SiteContext';

const ByDayTab: React.FC = () => {
  const { siteData } = useSite();
  const { dailyData } = siteData;
  const [range, setRange] = useState<'7' | '15' | '30'>('30');
  const daysCount = Number(range);
  const chartData = dailyData.slice(-daysCount);

  const avgProduction = Math.round(chartData.reduce((s, d) => s + d.solarProduction, 0) / chartData.length);
  const avgConsumption = Math.round(chartData.reduce((s, d) => s + d.loadConsumption, 0) / chartData.length);
  const bestDay = chartData.reduce((best, d) => (d.solarProduction > best.solarProduction ? d : best), chartData[0]);
  const worstDay = chartData.reduce((worst, d) => (d.solarProduction < worst.solarProduction ? d : worst), chartData[0]);
  const totalNet = chartData.reduce((s, d) => s + d.netExport, 0);

  const BarTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const solar = payload.find((p: any) => p.dataKey === 'solarProduction')?.value ?? 0;
      const load = payload.find((p: any) => p.dataKey === 'loadConsumption')?.value ?? 0;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label}</p>
          <p style={{ color: 'var(--chart-solar)' }}>Solar: {solar} kWh</p>
          <p style={{ color: 'var(--chart-load)' }}>Load: {load} kWh</p>
          <p style={{ color: solar >= load ? 'var(--success)' : 'var(--danger)', fontWeight: 700, marginTop: 4 }}>
            Net: {solar - load} kWh
          </p>
        </div>
      );
    }
    return null;
  };

  const EffTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label}</p>
          <p style={{ color: 'var(--chart-production)' }}>Efficiency: {payload[0]?.value}%</p>
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
          <p className="page-subtitle">Daily production and consumption breakdown</p>
        </div>
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
      </section>

      {/* Summary tiles */}
      <section className="overview-kpi-grid">
        <article className="overview-kpi-tile">
          <div>
            <div className="overview-kpi-value">{avgProduction} kWh</div>
            <div className="overview-kpi-label">Avg Daily Production</div>
          </div>
        </article>
        <article className="overview-kpi-tile">
          <div>
            <div className="overview-kpi-value">{avgConsumption} kWh</div>
            <div className="overview-kpi-label">Avg Daily Consumption</div>
          </div>
        </article>
        <article className="overview-kpi-tile">
          <div>
            <div className="overview-kpi-value" style={{ color: 'var(--success)' }}>{bestDay.solarProduction} kWh</div>
            <div className="overview-kpi-label">Best Day ({bestDay.dateLabel})</div>
          </div>
        </article>
        <article className="overview-kpi-tile">
          <div>
            <div className="overview-kpi-value" style={{ color: 'var(--danger)' }}>{worstDay.solarProduction} kWh</div>
            <div className="overview-kpi-label">Worst Day ({worstDay.dateLabel})</div>
          </div>
        </article>
      </section>

      {/* Production vs Consumption bars */}
      <section className="detail-grid" style={{ marginTop: 0 }}>
        <article className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3>Daily Production vs Consumption</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="dateLabel" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)', fontSize: 11 } }}
              />
              <Tooltip content={<BarTooltip />} />
              <Bar dataKey="solarProduction" fill="var(--chart-solar)" opacity={0.75} radius={[3, 3, 0, 0]} />
              <Bar dataKey="loadConsumption" fill="var(--chart-load)" opacity={0.55} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="chart-legend" style={{ marginTop: 12 }}>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: 'var(--chart-solar)', opacity: 0.75 }} />
              <span>Solar Production</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: 'var(--chart-load)', opacity: 0.55 }} />
              <span>Load Consumption</span>
            </div>
          </div>
        </article>
      </section>

      {/* Efficiency trend + load coverage heat */}
      <section className="detail-grid" style={{ marginTop: 18 }}>
        <article className="chart-card">
          <h3>Daily Efficiency (% of Target)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="dateLabel" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} domain={[0, 'auto']} />
              <ReferenceLine y={100} stroke="var(--success)" strokeDasharray="5 5" label={{ value: '100%', fill: 'var(--text-muted)', fontSize: 10 }} />
              <Tooltip content={<EffTooltip />} />
              <Line
                type="monotone"
                dataKey="efficiency"
                stroke="var(--chart-production)"
                strokeWidth={2.5}
                dot={{ fill: 'var(--chart-production)', strokeWidth: 0, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </article>

        <article className="chart-card">
          <h3>Load Coverage (%)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="dateLabel" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} domain={[0, 100]} />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (active && payload?.length) {
                    return (
                      <div className="custom-tooltip">
                        <p className="tooltip-title">{label}</p>
                        <p style={{ fontWeight: 600 }}>Coverage: {payload[0]?.value}%</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="loadCoverage" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.loadCoverage >= 80 ? 'var(--success)' : entry.loadCoverage >= 60 ? 'var(--warning)' : 'var(--danger)'}
                    opacity={0.75}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>

      {/* Bottom stats */}
      <section className="overview-kpi-grid" style={{ marginTop: 18 }}>
        <article className="overview-kpi-tile" style={{ gridColumn: '1 / -1' }}>
          <div className="chart-summary" style={{ width: '100%', margin: 0 }}>
            <div className="chart-summary-item">
              <div className="chart-summary-label">Total Production ({range}d)</div>
              <div className="chart-summary-value" style={{ color: 'var(--chart-solar)' }}>
                {chartData.reduce((s, d) => s + d.solarProduction, 0)} kWh
              </div>
            </div>
            <div className="chart-summary-item">
              <div className="chart-summary-label">Total Consumption ({range}d)</div>
              <div className="chart-summary-value" style={{ color: 'var(--chart-load)' }}>
                {chartData.reduce((s, d) => s + d.loadConsumption, 0)} kWh
              </div>
            </div>
            <div className="chart-summary-item">
              <div className="chart-summary-label">Net Balance ({range}d)</div>
              <div className="chart-summary-value" style={{ color: totalNet >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {totalNet} kWh
              </div>
            </div>
          </div>
        </article>
      </section>
    </>
  );
};

export default ByDayTab;
