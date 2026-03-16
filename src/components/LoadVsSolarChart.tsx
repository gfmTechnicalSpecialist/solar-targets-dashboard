import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSite } from '../context/SiteContext';

const LoadVsSolarChart: React.FC = () => {
  const { siteData } = useSite();
  const { dailyData } = siteData;
  const chartData = dailyData.slice(-15);

  const colors = {
    solar: 'var(--chart-solar)',
    load: 'var(--chart-load)',
    net: 'var(--chart-net)',
    grid: 'var(--chart-grid)',
    axis: 'var(--chart-axis)',
    muted: 'var(--text-muted)',
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const production = payload.find((p: any) => p.dataKey === 'solarProduction')?.value || 0;
      const load = payload.find((p: any) => p.dataKey === 'loadConsumption')?.value || 0;
      const netExport = production - load;

      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label}</p>
          <p style={{ color: colors.solar }}>Solar: {production} kWh</p>
          <p style={{ color: colors.load }}>Load: {load} kWh</p>
          <p style={{ fontWeight: 700, color: netExport >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: '4px' }}>
            Net: {netExport > 0 ? '+' : ''}{netExport} kWh {netExport >= 0 ? '(Export)' : '(Import)'}
          </p>
        </div>
      );
    }
    return null;
  };

  const avgSolar = Math.round(chartData.reduce((s, d) => s + d.solarProduction, 0) / chartData.length);
  const avgLoad = Math.round(chartData.reduce((s, d) => s + d.loadConsumption, 0) / chartData.length);
  const avgNet = Math.round(chartData.reduce((s, d) => s + d.netExport, 0) / chartData.length);

  return (
    <div className="chart-card">
      <h3>Consumption Details</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData}>
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
          <Bar
            dataKey="loadConsumption"
            fill={colors.load}
            opacity={0.55}
            radius={[3, 3, 0, 0]}
            name="Load Consumption"
          />
          <Bar
            dataKey="solarProduction"
            fill={colors.solar}
            opacity={0.7}
            radius={[3, 3, 0, 0]}
            name="Solar Production"
          />
          <Line
            type="monotone"
            dataKey="netExport"
            stroke={colors.net}
            strokeWidth={2.5}
            dot={{ fill: colors.net, strokeWidth: 0, r: 3 }}
            name="Net Export"
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="chart-summary">
        <div className="chart-summary-item">
          <div className="chart-summary-label">
            <div className="legend-dot" style={{ backgroundColor: colors.solar, opacity: 0.7 }} />
            Solar Production
          </div>
          <div className="chart-summary-value" style={{ color: colors.solar }}>
            {avgSolar} kWh avg
          </div>
        </div>
        <div className="chart-summary-item">
          <div className="chart-summary-label">
            <div className="legend-dot" style={{ backgroundColor: colors.load, opacity: 0.55 }} />
            Load Consumption
          </div>
          <div className="chart-summary-value" style={{ color: colors.load }}>
            {avgLoad} kWh avg
          </div>
        </div>
        <div className="chart-summary-item">
          <div className="chart-summary-label">
            <div className="legend-line" style={{ backgroundColor: colors.net }} />
            Net Export
          </div>
          <div className="chart-summary-value" style={{ color: avgNet >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {avgNet} kWh avg
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadVsSolarChart;