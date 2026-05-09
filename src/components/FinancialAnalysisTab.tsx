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
  Zap,
  Building2,
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
import {
  DEFAULT_TOU_RATES,
  DEFAULT_DEMAND_RATE_PER_KVA,
  SERVICE_CHARGE_EXCL_VAT,
} from '../api/tou';

const CURRENT_YEAR = new Date().getFullYear().toString();

const FinancialAnalysisTab: React.FC = () => {
  const { siteData, siteId } = useSite();
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

      {/* CoCT MV TOU tariff classification — Parc du Cap only */}
      {siteId === 'parc-du-cap' && (
        <section className="chart-section">
          <div className="chart-card">
            <div className="chart-card-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Building2 size={16} /> Tariff Classification
              </h2>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', color: 'var(--info)' }}>
                CoCT MV TOU 2025/26
              </span>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Classification info */}
              <div>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Classification</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[
                    { label: 'Utility', value: 'City of Cape Town' },
                    { label: 'Category', value: 'Large Power User (TOU)' },
                    { label: 'Voltage Level', value: 'Medium Voltage (MV)' },
                    { label: 'Current Season', value: 'Low Demand (Sep – May)' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderBottom: '1px solid var(--border-subtle, var(--border))', paddingBottom: '0.35rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Rates */}
              <div>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Applied Rates (excl. VAT)</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <tbody>
                    {[
                      { label: 'Peak energy', value: `R ${DEFAULT_TOU_RATES.peak.toFixed(4)} / kWh`, color: 'var(--danger)' },
                      { label: 'Standard energy', value: `R ${DEFAULT_TOU_RATES.standard.toFixed(4)} / kWh`, color: 'var(--warning)' },
                      { label: 'Off-peak energy', value: `R ${DEFAULT_TOU_RATES.offpeak.toFixed(4)} / kWh`, color: 'var(--info)' },
                      { label: 'Demand', value: `R ${DEFAULT_DEMAND_RATE_PER_KVA.toFixed(2)} / kVA`, color: 'var(--text-primary)' },
                      { label: 'Service charge', value: `R ${SERVICE_CHARGE_EXCL_VAT.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} / month`, color: 'var(--text-primary)' },
                    ].map(({ label, value, color }) => (
                      <tr key={label} style={{ borderBottom: '1px solid var(--border-subtle, var(--border))' }}>
                        <td style={{ padding: '5px 0', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Zap size={11} style={{ color }} />{label}
                        </td>
                        <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600, color }}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

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
