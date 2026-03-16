import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Cell,
} from 'recharts';
import { useSite } from '../context/SiteContext';

const ByMonthTab: React.FC = () => {
  const { siteData } = useSite();
  const { monthlyDataByYear } = siteData;
  const availableYears = Object.keys(monthlyDataByYear).sort();
  const [selectedYear, setSelectedYear] = useState(availableYears[availableYears.length - 1]);
  const data = monthlyDataByYear[selectedYear] ?? [];

  const totalProduction = data.reduce((s, m) => s + m.production, 0);
  const totalTarget = data.reduce((s, m) => s + m.target, 0);
  const totalConsumption = data.reduce((s, m) => s + m.consumption, 0);
  const totalEarnings = data.reduce((s, m) => s + m.earnings, 0);
  const bestMonth = data.reduce((best, m) => (m.production > best.production ? m : best), data[0]);
  const avgCoverage = Math.round(data.reduce((s, m) => s + m.coverage, 0) / data.length);

  const ProdTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const prod = payload.find((p: any) => p.dataKey === 'production')?.value ?? 0;
      const tgt = payload.find((p: any) => p.dataKey === 'target')?.value ?? 0;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label} {selectedYear}</p>
          <p style={{ color: 'var(--chart-solar)' }}>Production: {prod.toLocaleString()} kWh</p>
          <p style={{ color: 'var(--chart-target)' }}>Target: {tgt.toLocaleString()} kWh</p>
          <p style={{ color: prod >= tgt ? 'var(--success)' : 'var(--danger)', fontWeight: 700, marginTop: 4 }}>
            {Math.round((prod / tgt) * 100)}% of target
          </p>
        </div>
      );
    }
    return null;
  };

  const ConTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const prod = payload.find((p: any) => p.dataKey === 'production')?.value ?? 0;
      const cons = payload.find((p: any) => p.dataKey === 'consumption')?.value ?? 0;
      const net = prod - cons;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label} {selectedYear}</p>
          <p style={{ color: 'var(--chart-solar)' }}>Solar: {prod.toLocaleString()} kWh</p>
          <p style={{ color: 'var(--chart-load)' }}>Consumption: {cons.toLocaleString()} kWh</p>
          <p style={{ color: net >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700, marginTop: 4 }}>
            Net: {net > 0 ? '+' : ''}{net.toLocaleString()} kWh
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
          <p className="page-kicker">History</p>
          <h1>By Month</h1>
          <p className="page-subtitle">Monthly production, consumption and target analysis</p>
        </div>
        <label className="page-select">
          <span>Year</span>
          <div className="select-wrap">
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
        </label>
      </section>

      {/* Annual summary */}
      <section className="overview-kpi-grid">
        <article className="overview-kpi-tile">
          <div>
            <div className="overview-kpi-value">{totalProduction.toLocaleString()}</div>
            <div className="overview-kpi-label">Annual Production (kWh)</div>
          </div>
        </article>
        <article className="overview-kpi-tile">
          <div>
            <div className="overview-kpi-value">{Math.round((totalProduction / totalTarget) * 100)}%</div>
            <div className="overview-kpi-label">Target Achievement</div>
          </div>
        </article>
        <article className="overview-kpi-tile">
          <div>
            <div className="overview-kpi-value">{bestMonth?.month}</div>
            <div className="overview-kpi-label">Best Month ({bestMonth?.production.toLocaleString()} kWh)</div>
          </div>
        </article>
        <article className="overview-kpi-tile">
          <div>
            <div className="overview-kpi-value">R{totalEarnings.toLocaleString()}</div>
            <div className="overview-kpi-label">Annual Earnings</div>
          </div>
        </article>
      </section>

      {/* Production vs Target */}
      <section className="detail-grid" style={{ marginTop: 0 }}>
        <article className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3>Monthly Production vs Target</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)', fontSize: 11 } }}
              />
              <Tooltip content={<ProdTooltip />} />
              <Bar dataKey="production" fill="var(--chart-solar)" opacity={0.75} radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="target"
                stroke="var(--chart-target)"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="chart-legend" style={{ marginTop: 12 }}>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: 'var(--chart-solar)', opacity: 0.75 }} />
              <span>Production</span>
            </div>
            <div className="legend-item">
              <div className="legend-line" style={{ backgroundColor: 'var(--chart-target)' }} />
              <span>Target</span>
            </div>
          </div>
        </article>
      </section>

      {/* Production vs Consumption */}
      <section className="detail-grid" style={{ marginTop: 18 }}>
        <article className="chart-card">
          <h3>Solar vs Consumption</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <Tooltip content={<ConTooltip />} />
              <Bar dataKey="production" fill="var(--chart-solar)" opacity={0.7} radius={[3, 3, 0, 0]} />
              <Bar dataKey="consumption" fill="var(--chart-load)" opacity={0.5} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="chart-card">
          <h3>Monthly Coverage (%)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
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
              <Bar dataKey="coverage" radius={[3, 3, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.coverage >= 80 ? 'var(--success)' : entry.coverage >= 60 ? 'var(--warning)' : 'var(--danger)'}
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
              <div className="chart-summary-label">Avg Coverage</div>
              <div className="chart-summary-value" style={{ color: avgCoverage >= 80 ? 'var(--success)' : 'var(--warning)' }}>
                {avgCoverage}%
              </div>
            </div>
            <div className="chart-summary-item">
              <div className="chart-summary-label">Total Consumption</div>
              <div className="chart-summary-value" style={{ color: 'var(--chart-load)' }}>
                {totalConsumption.toLocaleString()} kWh
              </div>
            </div>
            <div className="chart-summary-item">
              <div className="chart-summary-label">Net Balance</div>
              <div
                className="chart-summary-value"
                style={{ color: totalProduction >= totalConsumption ? 'var(--success)' : 'var(--danger)' }}
              >
                {(totalProduction - totalConsumption).toLocaleString()} kWh
              </div>
            </div>
          </div>
        </article>
      </section>
    </>
  );
};

export default ByMonthTab;
