import React from 'react';
import {
  Sun,
  Banknote,
  Leaf,
  TrendingUp,
  Zap,
  Calendar,
  Award,
} from 'lucide-react';
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
} from 'recharts';
import { useSite } from '../context/SiteContext';

const AllTimeTab: React.FC = () => {
  const { siteData } = useSite();
  const { allTimeStats, monthlyDataByYear } = siteData;
  // Build yearly summary data
  const yearlyData = Object.entries(monthlyDataByYear)
    .map(([year, months]) => ({
      year,
      production: months.reduce((s, m) => s + m.production, 0),
      consumption: months.reduce((s, m) => s + m.consumption, 0),
      earnings: months.reduce((s, m) => s + m.earnings, 0),
      target: months.reduce((s, m) => s + m.target, 0),
    }))
    .sort((a, b) => a.year.localeCompare(b.year));

  const YearTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const prod = payload.find((p: any) => p.dataKey === 'production')?.value ?? 0;
      const cons = payload.find((p: any) => p.dataKey === 'consumption')?.value ?? 0;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label}</p>
          <p style={{ color: 'var(--chart-solar)' }}>Production: {prod.toLocaleString()} kWh</p>
          <p style={{ color: 'var(--chart-load)' }}>Consumption: {cons.toLocaleString()} kWh</p>
          <p style={{ color: prod >= cons ? 'var(--success)' : 'var(--danger)', fontWeight: 700, marginTop: 4 }}>
            Net: {(prod - cons).toLocaleString()} kWh
          </p>
        </div>
      );
    }
    return null;
  };

  const EarnTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label}</p>
          <p style={{ color: 'var(--success)' }}>Earnings: R{payload[0]?.value?.toLocaleString()}</p>
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
          <h1>All Time</h1>
          <p className="page-subtitle">Lifetime cumulative performance since system commissioning</p>
        </div>
      </section>

      {/* Big lifetime KPIs */}
      <section className="overview-kpi-grid alltime-kpi-grid">
        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <Sun size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">{allTimeStats.totalProduction.toLocaleString()}</div>
            <div className="overview-kpi-label">Total Production (kWh)</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
            <Banknote size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">R{allTimeStats.totalEarnings.toLocaleString()}</div>
            <div className="overview-kpi-label">Total Earnings</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <Leaf size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">{allTimeStats.totalCarbonOffset} t</div>
            <div className="overview-kpi-label">CO₂ Offset (Lifetime)</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">{allTimeStats.lifetimeRoi}%</div>
            <div className="overview-kpi-label">Lifetime ROI</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
            <Calendar size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">{allTimeStats.systemAge} yrs</div>
            <div className="overview-kpi-label">System Age</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <Zap size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">{allTimeStats.peakPower} kW</div>
            <div className="overview-kpi-label">All-Time Peak</div>
          </div>
        </article>
      </section>

      {/* Records */}
      <section className="detail-grid" style={{ marginTop: 0 }}>
        <article className="mini-panel">
          <h3><Award size={16} /> Best Month</h3>
          <div className="mini-panel-row">
            <div>
              <div className="mini-label">{allTimeStats.bestMonth.month}</div>
              <div className="mini-value">{allTimeStats.bestMonth.production}<span className="mini-unit">kWh</span></div>
            </div>
          </div>
          <p className="mini-meta">Highest monthly production recorded across all years.</p>
        </article>
        <article className="mini-panel">
          <h3><Award size={16} /> Best Day</h3>
          <div className="mini-panel-row">
            <div>
              <div className="mini-label">{allTimeStats.bestDay.date}</div>
              <div className="mini-value">{allTimeStats.bestDay.production}<span className="mini-unit">kWh</span></div>
            </div>
          </div>
          <p className="mini-meta">Highest single-day production. Avg daily: {allTimeStats.avgDailyProduction} kWh.</p>
        </article>
      </section>

      {/* Yearly production vs consumption */}
      <section className="detail-grid" style={{ marginTop: 18 }}>
        <article className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3>Yearly Production vs Consumption</h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={yearlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="year" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)', fontSize: 11 } }}
              />
              <Tooltip content={<YearTooltip />} />
              <Bar dataKey="production" fill="var(--chart-solar)" opacity={0.7} radius={[4, 4, 0, 0]} />
              <Bar dataKey="consumption" fill="var(--chart-load)" opacity={0.45} radius={[4, 4, 0, 0]} />
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
              <div className="legend-dot" style={{ backgroundColor: 'var(--chart-solar)', opacity: 0.7 }} />
              <span>Production</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: 'var(--chart-load)', opacity: 0.45 }} />
              <span>Consumption</span>
            </div>
            <div className="legend-item">
              <div className="legend-line" style={{ backgroundColor: 'var(--chart-target)' }} />
              <span>Target</span>
            </div>
          </div>
        </article>
      </section>

      {/* Yearly earnings */}
      <section className="detail-grid" style={{ marginTop: 18 }}>
        <article className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3>Annual Earnings (R)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={yearlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="year" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <Tooltip content={<EarnTooltip />} />
              <Bar dataKey="earnings" fill="var(--success)" opacity={0.7} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>

      {/* Bottom aggregate */}
      <section className="chart-summary" style={{ marginTop: 18 }}>
        <div className="chart-summary-item">
          <div className="chart-summary-label">Avg Daily Production</div>
          <div className="chart-summary-value" style={{ color: 'var(--chart-solar)' }}>
            {allTimeStats.avgDailyProduction} kWh
          </div>
        </div>
        <div className="chart-summary-item">
          <div className="chart-summary-label">Avg Monthly Coverage</div>
          <div className="chart-summary-value" style={{ color: 'var(--success)' }}>
            {allTimeStats.avgMonthlyCoverage}%
          </div>
        </div>
        <div className="chart-summary-item">
          <div className="chart-summary-label">Total Consumption</div>
          <div className="chart-summary-value" style={{ color: 'var(--chart-load)' }}>
            {allTimeStats.totalConsumption.toLocaleString()} kWh
          </div>
        </div>
      </section>
    </>
  );
};

export default AllTimeTab;
