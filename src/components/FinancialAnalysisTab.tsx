import React, { useState } from 'react';
import {
  Banknote,
  TrendingUp,
  PiggyBank,
  Leaf,
  Clock,
  DollarSign,
  BarChart2,
  Calendar,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { useSite } from '../context/SiteContext';

const CURRENT_YEAR = new Date().getFullYear().toString();

const FinancialAnalysisTab: React.FC = () => {
  const { siteData } = useSite();
  const { financialMetrics, allTimeStats, monthlyDataByYear } = siteData;
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);

  const recoveryPct = Math.min(
    Math.round((financialMetrics.investmentRecovered / financialMetrics.totalInvestment) * 100),
    100,
  );

  const availableYears = Object.keys(monthlyDataByYear).sort((a, b) => b.localeCompare(a));

  const monthlyEarnings = (monthlyDataByYear[selectedYear] ?? []).map((m) => ({
    month: m.month,
    earnings: m.earnings,
    production: m.production,
  }));

  const yearlyEarnings = Object.entries(monthlyDataByYear)
    .map(([year, months]) => ({
      year,
      earnings: months.reduce((s, m) => s + m.earnings, 0),
      production: months.reduce((s, m) => s + m.production, 0),
    }))
    .sort((a, b) => a.year.localeCompare(b.year));

  const MonthlyTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label}</p>
          <p style={{ color: 'var(--success)' }}>Earnings: R{payload[0]?.value?.toLocaleString()}</p>
          <p style={{ color: 'var(--chart-solar)' }}>Production: {payload[1]?.value?.toLocaleString()} kWh</p>
        </div>
      );
    }
    return null;
  };

  const YearlyTooltip = ({ active, payload, label }: any) => {
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
          <p className="page-kicker">Financials</p>
          <h1>Financial Analysis</h1>
          <p className="page-subtitle">Revenue, ROI, investment recovery and cost savings overview</p>
        </div>
      </section>

      {/* KPI tiles */}
      <section className="overview-kpi-grid">
        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <Banknote size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">R{financialMetrics.monthlyEarnings.toLocaleString()}</div>
            <div className="overview-kpi-label">Monthly Earnings</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
            <DollarSign size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">R{financialMetrics.yearlyEarnings.toLocaleString()}</div>
            <div className="overview-kpi-label">Yearly Earnings</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">{financialMetrics.roi}%</div>
            <div className="overview-kpi-label">Annual ROI</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>
            <Clock size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">{financialMetrics.paybackPeriod} yrs</div>
            <div className="overview-kpi-label">Payback Period</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <PiggyBank size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">R{financialMetrics.projectedAnnualSavings.toLocaleString()}</div>
            <div className="overview-kpi-label">Projected Annual Savings</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
            <Leaf size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">{allTimeStats.totalCarbonOffset} t</div>
            <div className="overview-kpi-label">Lifetime CO₂ Offset</div>
          </div>
        </article>
      </section>

      {/* Investment recovery */}
      <section className="chart-section">
        <div className="chart-card">
          <div className="chart-card-header">
            <h2><PiggyBank size={16} /> Investment Recovery</h2>
          </div>
          <div style={{ padding: '0 1.5rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                R{financialMetrics.investmentRecovered.toLocaleString()} recovered
              </span>
              <span style={{ fontWeight: 700, color: 'var(--success)' }}>{recoveryPct}%</span>
            </div>
            <div className="progress-track" style={{ height: 12, borderRadius: 6 }}>
              <div
                className="progress-fill"
                style={{
                  width: `${recoveryPct}%`,
                  background: 'linear-gradient(90deg, var(--success), var(--info))',
                  borderRadius: 6,
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>R0</span>
              <span>Total investment: R{financialMetrics.totalInvestment.toLocaleString()}</span>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="overview-kpi-tile" style={{ margin: 0 }}>
                <div className="overview-kpi-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                  <Banknote size={18} />
                </div>
                <div>
                  <div className="overview-kpi-value" style={{ fontSize: '1.1rem' }}>R{allTimeStats.totalEarnings.toLocaleString()}</div>
                  <div className="overview-kpi-label">Total Lifetime Earnings</div>
                </div>
              </div>
              <div className="overview-kpi-tile" style={{ margin: 0 }}>
                <div className="overview-kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                  <TrendingUp size={18} />
                </div>
                <div>
                  <div className="overview-kpi-value" style={{ fontSize: '1.1rem' }}>{allTimeStats.lifetimeRoi}%</div>
                  <div className="overview-kpi-label">Lifetime ROI</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Monthly earnings chart */}
      <section className="chart-section">
        <div className="chart-card">
          <div className="chart-card-header">
            <h2><BarChart2 size={16} /> Monthly Earnings</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: '0.8rem',
                }}
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyEarnings} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(v) => `R${v}`} />
              <Tooltip content={<MonthlyTooltip />} />
              <Bar dataKey="earnings" fill="var(--success)" radius={[3, 3, 0, 0]} name="Earnings" />
              <Bar dataKey="production" fill="var(--chart-solar)" radius={[3, 3, 0, 0]} name="Production (kWh)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Yearly earnings trend */}
      <section className="chart-section">
        <div className="chart-card">
          <div className="chart-card-header">
            <h2><TrendingUp size={16} /> Yearly Earnings Trend</h2>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={yearlyEarnings} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<YearlyTooltip />} />
              <Area
                type="monotone"
                dataKey="earnings"
                stroke="var(--success)"
                strokeWidth={2}
                fill="url(#earningsGradient)"
                name="Earnings"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
};

export default FinancialAnalysisTab;
