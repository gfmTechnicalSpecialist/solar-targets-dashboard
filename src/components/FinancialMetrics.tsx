import React from 'react';
import { useSite } from '../context/SiteContext';
import { Leaf, Banknote, PiggyBank, Clock } from 'lucide-react';

const FinancialMetrics: React.FC = () => {
  const { siteData } = useSite();
  const { financialMetrics } = siteData;
  const recoveryPercentage = (financialMetrics.investmentRecovered / financialMetrics.totalInvestment) * 100;

  return (
    <div className="metric-card metric-card--enhanced">
      <h3><Banknote size={18} /> Financial Performance</h3>

      <div className="metric-hero">
        <div className="metric-hero-value">R{financialMetrics.monthlyEarnings.toLocaleString()}<span className="metric-hero-unit"></span></div>
        <div className="metric-hero-label">This Month's Savings</div>
      </div>

      <div className="metric-row-group">
        <div className="metric-stat-row">
          <div className="metric-stat-icon" style={{ color: 'var(--chart-solar)' }}>
            <Leaf size={16} />
          </div>
          <div className="metric-stat-detail">
            <span className="metric-stat-title">CO₂ Offset</span>
            <span className="metric-stat-sub">This year</span>
          </div>
          <div className="metric-stat-number">
            {financialMetrics.carbonOffset} tons
          </div>
        </div>

        <div className="metric-stat-row">
          <div className="metric-stat-icon" style={{ color: 'var(--info)' }}>
            <Clock size={16} />
          </div>
          <div className="metric-stat-detail">
            <span className="metric-stat-title">Payback Period</span>
          </div>
          <div className="metric-stat-number">
            {financialMetrics.paybackPeriod} years
          </div>
        </div>
      </div>

      <div className="metric-capacity-bar">
        <div className="metric-capacity-header">
          <PiggyBank size={14} />
          <span>Investment Recovery</span>
          <strong style={{ color: 'var(--success)' }}>{Math.round(recoveryPercentage)}%</strong>
        </div>
        <div className="progress-track" style={{ height: 8 }}>
          <div
            className="progress-fill"
            style={{
              width: `${Math.min(recoveryPercentage, 100)}%`,
              background: 'linear-gradient(90deg, var(--success), var(--info))',
            }}
          />
        </div>
        <div className="metric-capacity-footer">
          R{financialMetrics.investmentRecovered.toLocaleString()} of R{financialMetrics.totalInvestment.toLocaleString()}
        </div>
      </div>
    </div>
  );
};

export default FinancialMetrics;