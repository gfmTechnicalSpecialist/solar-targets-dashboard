import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSite } from '../context/SiteContext';

const IrradianceVsProduction: React.FC = () => {
  const { siteData } = useSite();
  const { dailyData } = siteData;
  const chartData = dailyData.slice(-15);

  const colors = {
    irradiance: 'var(--chart-solar)',
    production: 'var(--chart-production)',
    grid: 'var(--chart-grid)',
    axis: 'var(--chart-axis)',
    muted: 'var(--text-muted)',
    success: 'var(--success)',
  };

  // Performance ratio: actual production vs theoretical (irradiance × capacity × area factor)
  // Simplified: we compare the correlation between irradiance and production
  const avgIrradiance = +(chartData.reduce((s, d) => s + d.irradiance, 0) / chartData.length).toFixed(2);
  const avgProduction = Math.round(chartData.reduce((s, d) => s + d.solarProduction, 0) / chartData.length);

  // Simple performance ratio estimate: production / (irradiance * system_kw * hours_factor)
  // Using a simplified model: expected = irradiance * 10 (for 10kW system)
  const avgExpected = avgIrradiance * 10;
  const performanceRatio = Math.round((avgProduction / avgExpected) * 100);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const irr = payload.find((p: any) => p.dataKey === 'irradiance')?.value || 0;
      const prod = payload.find((p: any) => p.dataKey === 'solarProduction')?.value || 0;
      const expected = (irr * 10).toFixed(0);
      const ratio = Math.round((prod / (irr * 10)) * 100);

      return (
        <div className="custom-tooltip">
          <p className="tooltip-title">{label}</p>
          <p style={{ color: colors.irradiance }}>Irradiance: {irr} kWh/m²</p>
          <p style={{ color: colors.production }}>Production: {prod} kWh</p>
          <p style={{ color: colors.muted }}>Expected: ~{expected} kWh</p>
          <p style={{ fontWeight: 700, color: ratio >= 80 ? colors.success : colors.irradiance, marginTop: '4px' }}>
            Performance: {ratio}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-card">
      <h3>Solar Irradiance vs Production</h3>

      <div className="chart-summary" style={{ marginBottom: '20px', marginTop: 0 }}>
        <div className="chart-summary-item">
          <div className="chart-summary-label">
            Avg Irradiance
          </div>
          <div className="chart-summary-value" style={{ color: colors.irradiance }}>
            {avgIrradiance} kWh/m²
          </div>
        </div>
        <div className="chart-summary-item">
          <div className="chart-summary-label">
            Avg Production
          </div>
          <div className="chart-summary-value" style={{ color: colors.production }}>
            {avgProduction} kWh
          </div>
        </div>
        <div className="chart-summary-item">
          <div className="chart-summary-label">
            Performance Ratio
          </div>
          <div className="chart-summary-value" style={{ color: performanceRatio >= 80 ? colors.success : colors.irradiance }}>
            {performanceRatio}%
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
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
            yAxisId="production"
            stroke={colors.muted}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: colors.axis }}
            label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { fill: colors.muted, fontSize: 11 } }}
          />
          <YAxis
            yAxisId="irradiance"
            orientation="right"
            stroke={colors.muted}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: colors.axis }}
            domain={[0, 8]}
            label={{ value: 'kWh/m²', angle: 90, position: 'insideRight', style: { fill: colors.muted, fontSize: 11 } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            yAxisId="production"
            dataKey="solarProduction"
            fill={colors.production}
            opacity={0.6}
            radius={[4, 4, 0, 0]}
            name="Production"
          />
          <Line
            yAxisId="irradiance"
            type="monotone"
            dataKey="irradiance"
            stroke={colors.irradiance}
            strokeWidth={2.5}
            dot={{ fill: colors.irradiance, strokeWidth: 0, r: 3 }}
            name="Irradiance"
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="chart-legend" style={{ marginTop: '12px' }}>
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: colors.production, opacity: 0.6 }} />
          <span>Solar Production (kWh)</span>
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ backgroundColor: colors.irradiance }} />
          <span>Irradiance (kWh/m²)</span>
        </div>
      </div>
    </div>
  );
};

export default IrradianceVsProduction;
