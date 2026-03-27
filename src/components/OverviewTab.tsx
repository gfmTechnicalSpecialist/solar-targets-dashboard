import React, { useEffect, useState } from 'react';
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
  Calendar,
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSite } from '../context/SiteContext';

const OverviewTab: React.FC = () => {
  const { siteId, siteData } = useSite();
  const { dailyData, currentMetrics, financialMetrics, systemHealth, hourlyData } = siteData;
  const last7 = dailyData.slice(-7);
  const totalSolar = dailyData.reduce((s, d) => s + d.solarProduction, 0);
  const totalLoad = dailyData.reduce((s, d) => s + d.loadConsumption, 0);
  const autarky = Math.min(Math.round((totalSolar / totalLoad) * 100), 100);
  const capacityPct = Math.round((currentMetrics.currentGeneration / currentMetrics.systemCapacity) * 100);

  // Cumulative current month production from daily data
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthProduction = dailyData
    .filter(d => d.date.startsWith(currentMonthStr))
    .reduce((sum, d) => sum + d.solarProduction, 0);

  // Persist current month cumulative total
  const productionKey = `monthlyGeneration_${siteId}_${currentMonthStr}`;
  useEffect(() => {
    localStorage.setItem(productionKey, String(currentMonthProduction));
  }, [productionKey, currentMonthProduction]);

  // Previous month stored production
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const prevKey = `monthlyGeneration_${siteId}_${prevMonthStr}`;
  const prevMonthName = prevDate.toLocaleString('default', { month: 'long' });

  const [prevMonthProduction, setPrevMonthProduction] = useState<number | null>(() => {
    const stored = localStorage.getItem(prevKey);
    return stored ? Number(stored) : null;
  });

  useEffect(() => {
    const stored = localStorage.getItem(prevKey);
    if (stored) {
      setPrevMonthProduction(Number(stored));
    } else {
      // Seed from dailyData if it contains previous month days
      const fromDaily = dailyData
        .filter(d => d.date.startsWith(prevMonthStr))
        .reduce((sum, d) => sum + d.solarProduction, 0);
      if (fromDaily > 0) {
        localStorage.setItem(prevKey, String(fromDaily));
        setPrevMonthProduction(fromDaily);
      } else {
        setPrevMonthProduction(null);
      }
    }
  }, [prevKey, prevMonthStr, dailyData]);

  const monthlyProgress = currentMetrics.monthlyTarget > 0
    ? Math.round((currentMonthProduction / currentMetrics.monthlyTarget) * 100)
    : 0;
  const prevMonthProgress = prevMonthProduction !== null && currentMetrics.monthlyTarget > 0
    ? Math.round((prevMonthProduction / currentMetrics.monthlyTarget) * 100)
    : null;

  // Hourly data: total vs active production (>= 0.1 kW)
  const productionThreshold = 0.1;
  const hourlyProductionData = hourlyData.map(h => ({
    hour: h.hour,
    totalSolar: h.solarKw,
    activeSolar: h.solarKw >= productionThreshold ? h.solarKw : 0,
    producing: h.solarKw >= productionThreshold,
  }));
  const totalDailySolar = hourlyData.reduce((s, h) => s + h.solarKw, 0);
  const activeDailySolar = hourlyData
    .filter(h => h.solarKw >= productionThreshold)
    .reduce((s, h) => s + h.solarKw, 0);
  const activeHoursCount = hourlyData.filter(h => h.solarKw >= productionThreshold).length;

  // 7-day production vs target data
  const last7WithTarget = last7.map(d => ({
    dateLabel: d.dateLabel,
    solarProduction: d.solarProduction,
    target: d.target,
    loadConsumption: d.loadConsumption,
  }));
  const avgProduction7 = Math.round(last7.reduce((s, d) => s + d.solarProduction, 0) / last7.length);
  const avgTarget7 = Math.round(last7.reduce((s, d) => s + d.target, 0) / last7.length);
  const avgLoad7 = Math.round(last7.reduce((s, d) => s + d.loadConsumption, 0) / last7.length);

  // 7-day energy source breakdown: solar-covered load vs grid vs excess exported
  const last7EnergyBreakdown = last7.map(d => {
    const solarCovered = Math.min(d.solarProduction, d.loadConsumption);
    const gridUsed = Math.max(d.loadConsumption - d.solarProduction, 0);
    const excessExported = Math.max(d.solarProduction - d.loadConsumption, 0);
    return {
      dateLabel: d.dateLabel,
      solarCovered: Math.round(solarCovered),
      gridUsed: Math.round(gridUsed),
      excessExported: Math.round(excessExported),
    };
  });
  const avgSolarCovered = Math.round(last7EnergyBreakdown.reduce((s, d) => s + d.solarCovered, 0) / last7EnergyBreakdown.length);
  const avgGridUsed = Math.round(last7EnergyBreakdown.reduce((s, d) => s + d.gridUsed, 0) / last7EnergyBreakdown.length);
  const avgExported = Math.round(last7EnergyBreakdown.reduce((s, d) => s + d.excessExported, 0) / last7EnergyBreakdown.length);

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

        {prevMonthProduction !== null && (
          <article className="overview-kpi-tile">
            <div className="overview-kpi-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
              <Calendar size={20} />
            </div>
            <div>
              <div className="overview-kpi-value">{prevMonthProduction.toLocaleString()} kWh</div>
              <div className="overview-kpi-label">{prevMonthName} Production{prevMonthProgress !== null ? ` (${prevMonthProgress}%)` : ''}</div>
            </div>
          </article>
        )}

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
              <strong>{currentMonthProduction.toLocaleString()} kWh</strong>
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

      {/* Solar Production vs Active Hours */}
      <section className="overview-panels">
        <article className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3>Today's Total Solar vs Active Production Hours</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={hourlyProductionData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="hour" stroke="var(--text-muted)" fontSize={10} tickLine={false} interval={2} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false}
                label={{ value: 'kW', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)', fontSize: 11 } }}
              />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (active && payload?.length) {
                    const total = payload.find((p: any) => p.dataKey === 'totalSolar')?.value ?? 0;
                    const active_ = payload.find((p: any) => p.dataKey === 'activeSolar')?.value ?? 0;
                    return (
                      <div className="custom-tooltip">
                        <p className="tooltip-title">{label}</p>
                        <p style={{ color: 'var(--chart-solar)' }}>Total: {total} kW</p>
                        <p style={{ color: 'var(--success)' }}>Active ({'>'}= 0.1 kW): {active_} kW</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                          {total < productionThreshold ? 'Below threshold' : 'Producing'}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="totalSolar"
                name="Total Solar"
                fill="var(--chart-solar)"
                opacity={0.35}
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="activeSolar"
                name="Active Production"
                fill="var(--success)"
                opacity={0.85}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="chart-summary">
            <div className="chart-summary-item">
              <div className="chart-summary-label">
                <div className="legend-dot" style={{ backgroundColor: 'var(--chart-solar)', opacity: 0.35 }} />
                Total Daily Solar
              </div>
              <div className="chart-summary-value" style={{ color: 'var(--chart-solar)' }}>
                {totalDailySolar.toFixed(1)} kW
              </div>
            </div>
            <div className="chart-summary-item">
              <div className="chart-summary-label">
                <div className="legend-dot" style={{ backgroundColor: 'var(--success)', opacity: 0.85 }} />
                Active Production ({'≥'} 0.1 kW)
              </div>
              <div className="chart-summary-value" style={{ color: 'var(--success)' }}>
                {activeDailySolar.toFixed(1)} kW
              </div>
            </div>
            <div className="chart-summary-item">
              <div className="chart-summary-label">
                Active Hours
              </div>
              <div className="chart-summary-value">
                {activeHoursCount}h of 24h
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* 7-Day Production vs Target */}
      <section className="overview-panels">
        <article className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3>7-Day Production vs Target</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={last7WithTarget} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="dateLabel" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false}
                label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)', fontSize: 11 } }}
              />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (active && payload?.length) {
                    const prod = payload.find((p: any) => p.dataKey === 'solarProduction')?.value ?? 0;
                    const tgt = payload.find((p: any) => p.dataKey === 'target')?.value ?? 0;
                    const load = payload.find((p: any) => p.dataKey === 'loadConsumption')?.value ?? 0;
                    const pct = tgt > 0 ? Math.round((prod / tgt) * 100) : 0;
                    return (
                      <div className="custom-tooltip">
                        <p className="tooltip-title">{label}</p>
                        <p style={{ color: 'var(--chart-solar)' }}>Production: {prod} kWh</p>
                        <p style={{ color: 'var(--chart-load)' }}>Load: {load} kWh</p>
                        <p style={{ color: 'var(--warning)' }}>Target: {tgt} kWh</p>
                        <p style={{ fontWeight: 700, color: pct >= 85 ? 'var(--success)' : 'var(--danger)', marginTop: 4 }}>
                          {pct}% of target
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="solarProduction"
                name="Solar Production"
                fill="var(--chart-solar)"
                opacity={0.75}
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="loadConsumption"
                name="Load Consumption"
                fill="var(--chart-load)"
                opacity={0.55}
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="target"
                name="Daily Target"
                fill="var(--warning)"
                opacity={0.4}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="chart-summary">
            <div className="chart-summary-item">
              <div className="chart-summary-label">
                <div className="legend-dot" style={{ backgroundColor: 'var(--chart-solar)', opacity: 0.75 }} />
                Avg Production
              </div>
              <div className="chart-summary-value" style={{ color: 'var(--chart-solar)' }}>
                {avgProduction7} kWh
              </div>
            </div>
            <div className="chart-summary-item">
              <div className="chart-summary-label">
                <div className="legend-dot" style={{ backgroundColor: 'var(--chart-load)', opacity: 0.55 }} />
                Avg Load
              </div>
              <div className="chart-summary-value" style={{ color: 'var(--chart-load)' }}>
                {avgLoad7} kWh
              </div>
            </div>
            <div className="chart-summary-item">
              <div className="chart-summary-label">
                <div className="legend-dot" style={{ backgroundColor: 'var(--warning)', opacity: 0.4 }} />
                Avg Target
              </div>
              <div className="chart-summary-value" style={{ color: 'var(--warning)' }}>
                {avgTarget7} kWh
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* 7-Day Energy Source Breakdown */}
      <section className="overview-panels">
        <article className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3>7-Day Energy Source Breakdown</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={last7EnergyBreakdown} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="dateLabel" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false}
                label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-muted)', fontSize: 11 } }}
              />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (active && payload?.length) {
                    const solar = payload.find((p: any) => p.dataKey === 'solarCovered')?.value ?? 0;
                    const grid = payload.find((p: any) => p.dataKey === 'gridUsed')?.value ?? 0;
                    const exported = payload.find((p: any) => p.dataKey === 'excessExported')?.value ?? 0;
                    const totalLoad = solar + grid;
                    const coveragePct = totalLoad > 0 ? Math.round((solar / totalLoad) * 100) : 0;
                    return (
                      <div className="custom-tooltip">
                        <p className="tooltip-title">{label}</p>
                        <p style={{ color: 'var(--success)' }}>Solar Covered: {solar} kWh</p>
                        <p style={{ color: 'var(--danger)' }}>Grid Used: {grid} kWh</p>
                        <p style={{ color: 'var(--chart-solar)' }}>Excess Exported: {exported} kWh</p>
                        <p style={{ fontWeight: 700, color: coveragePct >= 70 ? 'var(--success)' : 'var(--warning)', marginTop: 4 }}>
                          {coveragePct}% solar coverage
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="solarCovered"
                name="Solar Covered"
                stackId="load"
                fill="var(--success)"
                opacity={0.8}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="gridUsed"
                name="Grid Used"
                stackId="load"
                fill="var(--danger)"
                opacity={0.55}
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="excessExported"
                name="Excess Exported"
                fill="var(--chart-solar)"
                opacity={0.6}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="chart-summary">
            <div className="chart-summary-item">
              <div className="chart-summary-label">
                <div className="legend-dot" style={{ backgroundColor: 'var(--success)', opacity: 0.8 }} />
                Avg Solar Covered
              </div>
              <div className="chart-summary-value" style={{ color: 'var(--success)' }}>
                {avgSolarCovered} kWh
              </div>
            </div>
            <div className="chart-summary-item">
              <div className="chart-summary-label">
                <div className="legend-dot" style={{ backgroundColor: 'var(--danger)', opacity: 0.55 }} />
                Avg Grid Used
              </div>
              <div className="chart-summary-value" style={{ color: 'var(--danger)' }}>
                {avgGridUsed} kWh
              </div>
            </div>
            <div className="chart-summary-item">
              <div className="chart-summary-label">
                <div className="legend-dot" style={{ backgroundColor: 'var(--chart-solar)', opacity: 0.6 }} />
                Avg Exported
              </div>
              <div className="chart-summary-value" style={{ color: 'var(--chart-solar)' }}>
                {avgExported} kWh
              </div>
            </div>
          </div>
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
