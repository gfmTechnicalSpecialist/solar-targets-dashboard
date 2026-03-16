import React from 'react';
import { useSite } from '../context/SiteContext';
import { Sun, Zap, Activity, BatteryCharging } from 'lucide-react';

const SolarMetrics: React.FC = () => {
  const { siteData } = useSite();
  const { currentMetrics } = siteData;
  const capacityPct = Math.round((currentMetrics.currentGeneration / currentMetrics.systemCapacity) * 100);
  const isHealthy = currentMetrics.currentGeneration / currentMetrics.systemCapacity > 0.8;

  return (
    <div className="metric-card metric-card--enhanced">
      <h3><Sun size={18} /> Solar Production</h3>

      <div className="metric-hero">
        <div className="metric-hero-value">{currentMetrics.todayProduction}<span className="metric-hero-unit">kWh</span></div>
        <div className="metric-hero-label">Today's Production</div>
      </div>

      <div className="metric-row-group">
        <div className="metric-stat-row">
          <div className="metric-stat-icon" style={{ color: isHealthy ? 'var(--success)' : 'var(--danger)' }}>
            <Zap size={16} />
          </div>
          <div className="metric-stat-detail">
            <span className="metric-stat-title">Current Output</span>
            <span className="metric-stat-sub">Peak: {currentMetrics.peakGeneration} kW</span>
          </div>
          <div className="metric-stat-number" style={{ color: isHealthy ? 'var(--success)' : 'var(--danger)' }}>
            {currentMetrics.currentGeneration} kW
          </div>
        </div>

        <div className="metric-stat-row">
          <div className="metric-stat-icon" style={{ color: 'var(--info)' }}>
            <Activity size={16} />
          </div>
          <div className="metric-stat-detail">
            <span className="metric-stat-title">Monthly Production</span>
          </div>
          <div className="metric-stat-number">
            {currentMetrics.monthlyProduction.toLocaleString()} kWh
          </div>
        </div>
      </div>

      <div className="metric-capacity-bar">
        <div className="metric-capacity-header">
          <BatteryCharging size={14} />
          <span>Capacity Utilization</span>
          <strong style={{ color: isHealthy ? 'var(--success)' : 'var(--danger)' }}>{capacityPct}%</strong>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${Math.min(capacityPct, 100)}%`,
              background: isHealthy
                ? 'linear-gradient(90deg, var(--success), var(--success))'
                : 'linear-gradient(90deg, var(--danger), var(--danger))',
            }}
          />
        </div>
        <div className="metric-capacity-footer">
          {currentMetrics.currentGeneration} kW of {currentMetrics.systemCapacity} kW capacity
        </div>
      </div>
    </div>
  );
};

export default SolarMetrics;