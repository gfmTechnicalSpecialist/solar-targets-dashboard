import React from 'react';
import {
  Sun,
  Zap,
  Banknote,
  TrendingUp,
  Activity,
  ShieldCheck,
  Leaf,
  Target,
  CheckCircle,
  AlertCircle,
  BatteryCharging,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSite } from '../context/SiteContext';

const OverviewTab: React.FC = () => {
  const { siteData } = useSite();
  const { dailyData, currentMetrics, financialMetrics, systemHealth, hourlyData } = siteData;
  const last7 = dailyData.slice(-7);
  const totalSolar = dailyData.reduce((s, d) => s + d.solarProduction, 0);
  const totalLoad = dailyData.reduce((s, d) => s + d.loadConsumption, 0);
  const autarky = Math.min(Math.round((totalSolar / totalLoad) * 100), 100);
  const monthlyProgress = Math.round((currentMetrics.monthlyProduction / currentMetrics.monthlyTarget) * 100);
  const capacityPct = Math.round((currentMetrics.currentGeneration / currentMetrics.systemCapacity) * 100);

  const statusColor =
    systemHealth.uptime >= 99 ? 'var(--success)' : systemHealth.uptime >= 95 ? 'var(--warning)' : 'var(--danger)';

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label}</p>
          <p style={{ color: 'var(--chart-solar)' }}>Solar: {payload[0]?.value} kWh</p>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="page-kicker">Overview</p>
          <h1>Dashboard</h1>
          <p className="page-subtitle">At-a-glance system performance summary</p>
        </div>
      </section>

      {/* System status banner */}
      <section className="overview-status-bar">
        <div className="status-bar-item">
          <Activity size={14} />
          <span>System Status:</span>
          <strong style={{ color: statusColor }}>{systemHealth.status}</strong>
        </div>
        <div className="status-bar-item">
          <BatteryCharging size={14} />
          <span>Uptime:</span>
          <strong style={{ color: statusColor }}>{systemHealth.uptime}%</strong>
        </div>
        <div className="status-bar-item">
          <Zap size={14} />
          <span>Current Output:</span>
          <strong>{currentMetrics.currentGeneration} kW</strong>
        </div>
        <div className="status-bar-item">
          <ShieldCheck size={14} />
          <span>Capacity:</span>
          <strong>{capacityPct}%</strong>
        </div>
      </section>

      {/* Big KPI tiles */}
      <section className="overview-kpi-grid">
        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <Sun size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">{currentMetrics.todayProduction} kWh</div>
            <div className="overview-kpi-label">Today's Production</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
            <Target size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">{monthlyProgress}%</div>
            <div className="overview-kpi-label">Monthly Target</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
            <Banknote size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">R{financialMetrics.monthlyEarnings}</div>
            <div className="overview-kpi-label">Monthly Earnings</div>
          </div>
        </article>

        <article className="overview-kpi-tile">
          <div className="overview-kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">{autarky}%</div>
            <div className="overview-kpi-label">Self-Sufficiency</div>
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
          <div className="overview-kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <Leaf size={20} />
          </div>
          <div>
            <div className="overview-kpi-value">{financialMetrics.carbonOffset} t</div>
            <div className="overview-kpi-label">CO₂ Offset (Year)</div>
          </div>
        </article>
      </section>

      {/* Two-column: 7-day trend + target/financial summary */}
      <section className="overview-panels">
        <article className="chart-card">
          <h3>7-Day Production Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={last7}>
              <defs>
                <linearGradient id="overviewGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-solar)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-solar)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="dateLabel" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="solarProduction"
                stroke="var(--chart-solar)"
                strokeWidth={2.5}
                fill="url(#overviewGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </article>

        <article className="chart-card overview-summary-card">
          <h3>Quick Summary</h3>
          <div className="overview-summary-list">
            <div className="overview-summary-row">
              <span><Sun size={13} /> Today's Peak</span>
              <strong>{currentMetrics.peakGeneration} kW</strong>
            </div>
            <div className="overview-summary-row">
              <span><Activity size={13} /> Monthly Production</span>
              <strong>{currentMetrics.monthlyProduction.toLocaleString()} kWh</strong>
            </div>
            <div className="overview-summary-row">
              <span><Target size={13} /> Monthly Target</span>
              <strong>{currentMetrics.monthlyTarget.toLocaleString()} kWh</strong>
            </div>
            <div className="overview-summary-row">
              <span><Banknote size={13} /> Yearly Earnings</span>
              <strong>R{financialMetrics.yearlyEarnings.toLocaleString()}</strong>
            </div>
            <div className="overview-summary-row">
              <span><TrendingUp size={13} /> Projected Annual</span>
              <strong>R{financialMetrics.projectedAnnualSavings.toLocaleString()}</strong>
            </div>
            <div className="overview-summary-row">
              <span>
                {monthlyProgress >= 95 ? <CheckCircle size={13} /> : <AlertCircle size={13} />} Status
              </span>
              <strong style={{ color: monthlyProgress >= 85 ? 'var(--success)' : 'var(--danger)' }}>
                {monthlyProgress >= 95 ? 'Ahead' : monthlyProgress >= 85 ? 'On Track' : 'Behind'}
              </strong>
            </div>
          </div>
        </article>
      </section>

      {/* Today power curve mini */}
      <section className="overview-panels">
        <article className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3>Today's Power Curve (kW)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={hourlyData}>
              <defs>
                <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-production)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--chart-production)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="hour" stroke="var(--text-muted)" fontSize={10} tickLine={false} interval={2} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <Area
                type="monotone"
                dataKey="solarKw"
                stroke="var(--chart-production)"
                strokeWidth={2}
                fill="url(#powerGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </article>
      </section>

      {/* Alerts */}
      {systemHealth.alerts.length > 0 && (
        <section className="overview-alerts">
          <h3>Active Alerts</h3>
          {systemHealth.alerts.map((alert, i) => (
            <div className={`overview-alert overview-alert-${alert.type}`} key={i}>
              <AlertCircle size={14} />
              <span>{alert.message}</span>
            </div>
          ))}
        </section>
      )}
    </>
  );
};

export default OverviewTab;
