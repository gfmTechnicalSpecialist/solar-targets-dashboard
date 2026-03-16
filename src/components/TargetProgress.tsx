import React from 'react';
import { useSite } from '../context/SiteContext';
import { Target, CheckCircle, AlertCircle, TrendingUp, CalendarCheck } from 'lucide-react';

const TargetProgress: React.FC = () => {
  const { siteData } = useSite();
  const { currentMetrics, monthlyDataByYear } = siteData;
  const monthlyProgress = (currentMetrics.monthlyProduction / currentMetrics.monthlyTarget) * 100;

  // Get current and last month data
  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentMonthIdx = now.getMonth();
  const yearData = monthlyDataByYear[currentYear] ?? [];

  // Last month (handle Jan → previous Dec)
  let lastMonthData: { production: number; target: number; month: string } | null = null;
  if (currentMonthIdx === 0) {
    const prevYearData = monthlyDataByYear[String(now.getFullYear() - 1)];
    if (prevYearData?.length) lastMonthData = prevYearData[11];
  } else if (yearData.length > currentMonthIdx - 1) {
    lastMonthData = yearData[currentMonthIdx - 1];
  }
  const lastMonthProgress = lastMonthData ? (lastMonthData.production / lastMonthData.target) * 100 : null;

  const getBarColor = (progress: number) => {
    if (progress >= 85) return 'var(--success)';
    if (progress >= 70) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getStatusLabel = (progress: number) => {
    if (progress >= 95) return { text: 'Ahead of Target', cls: 'status-ahead', icon: <CheckCircle size={14} /> };
    if (progress >= 85) return { text: 'On Track', cls: 'status-on-track', icon: <TrendingUp size={14} /> };
    return { text: 'Behind Target', cls: 'status-behind', icon: <AlertCircle size={14} /> };
  };

  const status = getStatusLabel(monthlyProgress);

  return (
    <div className="metric-card metric-card--enhanced">
      <h3><Target size={18} /> Target Progress</h3>

      <div className="metric-target-block">
        <div className="metric-target-header">
          <span className="metric-target-label">Current Month</span>
          <span className="metric-target-pct" style={{ color: getBarColor(monthlyProgress) }}>
            {Math.round(monthlyProgress)}%
          </span>
        </div>
        <div className="progress-track" style={{ height: 8 }}>
          <div
            className="progress-fill"
            style={{
              width: `${Math.min(monthlyProgress, 100)}%`,
              background: `linear-gradient(90deg, ${getBarColor(monthlyProgress)}, ${getBarColor(monthlyProgress)})`,
            }}
          />
        </div>
        <div className="metric-target-detail">
          <span>{currentMetrics.monthlyProduction.toLocaleString()} kWh</span>
          <span className="metric-target-of">of {currentMetrics.monthlyTarget.toLocaleString()} kWh</span>
        </div>
      </div>

      {lastMonthData && lastMonthProgress !== null && (
        <div className="metric-target-block">
          <div className="metric-target-header">
            <span className="metric-target-label">
              <CalendarCheck size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
              Last Month ({lastMonthData.month})
            </span>
            <span className="metric-target-pct" style={{ color: getBarColor(lastMonthProgress) }}>
              {Math.round(lastMonthProgress)}%
            </span>
          </div>
          <div className="progress-track" style={{ height: 8 }}>
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(lastMonthProgress, 100)}%`,
                background: `linear-gradient(90deg, ${getBarColor(lastMonthProgress)}, ${getBarColor(lastMonthProgress)})`,
              }}
            />
          </div>
          <div className="metric-target-detail">
            <span>{lastMonthData.production.toLocaleString()} kWh</span>
            <span className="metric-target-of">of {lastMonthData.target.toLocaleString()} kWh</span>
          </div>
        </div>
      )}

      <div className="metric-status-badge">
        <div className={`status-indicator ${status.cls}`}>
          {status.icon}
          {status.text}
        </div>
      </div>
    </div>
  );
};

export default TargetProgress;