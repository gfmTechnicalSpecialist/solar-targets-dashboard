import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useSite } from '../context/SiteContext';
import { ShieldCheck, TrendingUp, TrendingDown } from 'lucide-react';

const LoadCoverage: React.FC = () => {
  const { siteData } = useSite();
  const { dailyData } = siteData;
  const chartData = dailyData.slice(-15);

  const colors = {
    good: 'var(--success)',
    mid: 'var(--warning)',
    low: 'var(--danger)',
    grid: 'var(--chart-grid)',
    axis: 'var(--chart-axis)',
    muted: 'var(--text-muted)',
  };

  const getBarColor = (coverage: number) => {
    if (coverage >= 80) return colors.good;
    if (coverage >= 60) return colors.mid;
    return colors.low;
  };

  // Monthly average
  const totalSolar = dailyData.reduce((s, d) => s + d.solarProduction, 0);
  const totalLoad = dailyData.reduce((s, d) => s + d.loadConsumption, 0);
  const monthlyCoverage = Math.min(Math.round((totalSolar / totalLoad) * 100), 100);

  // Today
  const today = dailyData[dailyData.length - 1];
  const todayCoverage = today.loadCoverage;

  // 7-day trend
  const last7 = dailyData.slice(-7);
  const prev7 = dailyData.slice(-14, -7);
  const avg7 = Math.round(last7.reduce((s, d) => s + d.loadCoverage, 0) / last7.length);
  const avgPrev7 = Math.round(prev7.reduce((s, d) => s + d.loadCoverage, 0) / prev7.length);
  const trendDelta = avg7 - avgPrev7;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const coverage = payload[0].value;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label}</p>
          <p style={{ color: getBarColor(coverage), fontWeight: 600 }}>
            Coverage: {coverage}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-card">
      <h3>Load Coverage by Solar</h3>

      <div className="chart-summary" style={{ marginBottom: '20px', marginTop: 0 }}>
        <div className="chart-summary-item">
          <div className="chart-summary-label">
            <ShieldCheck size={13} /> Today
          </div>
          <div className="chart-summary-value" style={{ color: getBarColor(todayCoverage), fontSize: '1.15rem' }}>
            {todayCoverage}%
          </div>
        </div>
        <div className="chart-summary-item">
          <div className="chart-summary-label">
            <ShieldCheck size={13} /> Monthly Avg
          </div>
          <div className="chart-summary-value" style={{ color: getBarColor(monthlyCoverage), fontSize: '1.15rem' }}>
            {monthlyCoverage}%
          </div>
        </div>
        <div className="chart-summary-item">
          <div className="chart-summary-label">
            {trendDelta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />} 7-Day Trend
          </div>
          <div className="chart-summary-value" style={{ color: trendDelta >= 0 ? colors.good : colors.low, fontSize: '1.15rem' }}>
            {trendDelta > 0 ? '+' : ''}{trendDelta}%
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            dataKey="dateLabel"
            stroke={colors.muted}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: colors.axis }}
          />
          <YAxis
            stroke={colors.muted}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: colors.axis }}
            domain={[0, 100]}
            label={{ value: '%', angle: -90, position: 'insideLeft', style: { fill: colors.muted, fontSize: 11 } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="loadCoverage" radius={[4, 4, 0, 0]} name="Load Coverage">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.loadCoverage)} opacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="chart-legend" style={{ marginTop: '12px' }}>
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: colors.good }} />
          <span>≥ 80% (Good)</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: colors.mid }} />
          <span>60–79% (Fair)</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: colors.low }} />
          <span>&lt; 60% (Low)</span>
        </div>
      </div>
    </div>
  );
};

export default LoadCoverage;
