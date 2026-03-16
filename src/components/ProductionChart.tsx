import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useSite } from '../context/SiteContext';

const ProductionChart: React.FC = () => {
  const { siteData } = useSite();
  const { dailyData } = siteData;
  const chartData = dailyData.slice(-15);

  const colors = {
    production: 'var(--chart-production)',
    target: 'var(--chart-target)',
    grid: 'var(--chart-grid)',
    axis: 'var(--chart-axis)',
    muted: 'var(--text-muted)',
    refLine: 'var(--primary)',
    activeDotFill: 'var(--bg-surface)',
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label}</p>
          <p style={{ color: colors.production }}>
            Production: {payload[0].value} kWh
          </p>
          <p style={{ color: colors.target }}>
            Target: {payload[1].value} kWh
          </p>
          <p style={{ color: 'var(--text-muted)' }}>
            Efficiency: {Math.round((payload[0].value / payload[1].value) * 100)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-card">
      <h3>Production Details</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <defs>
            <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.production} stopOpacity={0.3} />
              <stop offset="100%" stopColor={colors.production} stopOpacity={0} />
            </linearGradient>
          </defs>
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
            label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { fill: colors.muted, fontSize: 11 } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={65} stroke={colors.refLine} strokeDasharray="5 5" label={{ value: 'Target', fill: colors.muted, fontSize: 10 }} />
          <Line
            type="monotone"
            dataKey="solarProduction"
            stroke={colors.production}
            strokeWidth={2.5}
            dot={{ fill: colors.production, strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5, stroke: colors.production, strokeWidth: 2, fill: colors.activeDotFill }}
          />
          <Line
            type="monotone"
            dataKey="target"
            stroke={colors.target}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="chart-legend">
        <div className="legend-item">
          <div className="legend-line" style={{ backgroundColor: colors.production }} />
          <span>Actual Production</span>
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ backgroundColor: colors.target, borderTop: `2px dashed ${colors.target}`, height: 0 }} />
          <span>Daily Target</span>
        </div>
      </div>
    </div>
  );
};

export default ProductionChart;