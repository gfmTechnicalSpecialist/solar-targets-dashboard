import React, { useState } from 'react';
import { Download, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { useSite } from '../context/SiteContext';

type ExportFormat = 'daily' | 'monthly' | 'metrics' | 'financial';

const CsvDownloadTab: React.FC = () => {
  const { siteData } = useSite();
  const { dailyData, monthlyDataByYear, currentMetrics, financialMetrics } = siteData;
  const [downloaded, setDownloaded] = useState<Record<string, boolean>>({});

  const triggerDownload = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloaded((prev) => ({ ...prev, [filename]: true }));
  };

  const exportDaily = () => {
    const header = 'Date,Solar Production (kWh),Load Consumption (kWh),Target (kWh),Net Export (kWh),Efficiency (%),Irradiance (kWh/m²),Load Coverage (%)\n';
    const rows = dailyData
      .map(
        (d) =>
          `${d.date},${d.solarProduction},${d.loadConsumption},${d.target},${d.netExport},${d.efficiency},${d.irradiance},${d.loadCoverage}`,
      )
      .join('\n');
    triggerDownload('solar-daily-data.csv', header + rows);
  };

  const exportMonthly = () => {
    const header = 'Year,Month,Production (kWh),Target (kWh),Consumption (kWh),Net Export (kWh),Coverage (%),Irradiance (kWh/m²),Earnings (R)\n';
    const rows = Object.entries(monthlyDataByYear)
      .flatMap(([year, months]) =>
        months.map(
          (m) =>
            `${year},${m.month},${m.production},${m.target},${m.consumption},${m.netExport},${m.coverage},${m.irradiance},${m.earnings}`,
        ),
      )
      .join('\n');
    triggerDownload('solar-monthly-data.csv', header + rows);
  };

  const exportMetrics = () => {
    const header = 'Metric,Value,Unit\n';
    const rows = [
      `Today Production,${currentMetrics.todayProduction},kWh`,
      `Monthly Production,${currentMetrics.monthlyProduction},kWh`,
      `Yearly Production,${currentMetrics.yearlyProduction},kWh`,
      `Monthly Target,${currentMetrics.monthlyTarget},kWh`,
      `Yearly Target,${currentMetrics.yearlyTarget},kWh`,
      `Current Generation,${currentMetrics.currentGeneration},kW`,
      `Peak Generation,${currentMetrics.peakGeneration},kW`,
      `System Capacity,${currentMetrics.systemCapacity},kW`,
    ].join('\n');
    triggerDownload('solar-production-metrics.csv', header + rows);
  };

  const exportFinancial = () => {
    const header = 'Metric,Value,Unit\n';
    const rows = [
      `Monthly Earnings,${financialMetrics.monthlyEarnings},R`,
      `Yearly Earnings,${financialMetrics.yearlyEarnings},R`,
      `Projected Annual Savings,${financialMetrics.projectedAnnualSavings},R`,
      `Investment Recovered,${financialMetrics.investmentRecovered},R`,
      `Total Investment,${financialMetrics.totalInvestment},R`,
      `Payback Period,${financialMetrics.paybackPeriod},years`,
      `ROI,${financialMetrics.roi},%`,
      `Carbon Offset,${financialMetrics.carbonOffset},tons CO2`,
    ].join('\n');
    triggerDownload('solar-financial-metrics.csv', header + rows);
  };

  const exports: Array<{
    key: ExportFormat;
    label: string;
    description: string;
    filename: string;
    rowCount: string;
    handler: () => void;
  }> = [
    {
      key: 'daily',
      label: 'Daily Production Data',
      description: 'Day-by-day solar production, load consumption, targets, efficiency, irradiance, and load coverage for the last 30 days.',
      filename: 'solar-daily-data.csv',
      rowCount: `${dailyData.length} rows`,
      handler: exportDaily,
    },
    {
      key: 'monthly',
      label: 'Monthly Aggregated Data',
      description: 'Monthly production, consumption, targets, coverage, and earnings aggregated by year — covering all available years.',
      filename: 'solar-monthly-data.csv',
      rowCount: `${Object.keys(monthlyDataByYear).length * 12} rows`,
      handler: exportMonthly,
    },
    {
      key: 'metrics',
      label: 'Production Metrics',
      description: 'Current system production metrics including daily, monthly, yearly production figures, targets, and capacity utilization.',
      filename: 'solar-production-metrics.csv',
      rowCount: '8 rows',
      handler: exportMetrics,
    },
    {
      key: 'financial',
      label: 'Financial Metrics',
      description: 'Financial performance data including earnings, ROI, investment recovery, payback period, and carbon offset figures.',
      filename: 'solar-financial-metrics.csv',
      rowCount: '8 rows',
      handler: exportFinancial,
    },
  ];

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="page-kicker">Data</p>
          <h1>CSV Download</h1>
          <p className="page-subtitle">Export solar performance data for external analysis and reporting</p>
        </div>
      </section>

      <section className="csv-grid">
        {exports.map((exp) => (
          <article className="csv-card" key={exp.key}>
            <div className="csv-card-icon">
              <FileSpreadsheet size={24} />
            </div>
            <div className="csv-card-body">
              <h3>{exp.label}</h3>
              <p>{exp.description}</p>
              <div className="csv-card-meta">
                <span className="csv-filename">{exp.filename}</span>
                <span className="csv-rows">{exp.rowCount}</span>
              </div>
            </div>
            <button
              className={`csv-download-btn ${downloaded[exp.filename] ? 'csv-downloaded' : ''}`}
              onClick={exp.handler}
            >
              {downloaded[exp.filename] ? (
                <>
                  <CheckCircle size={14} />
                  <span>Downloaded</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Download</span>
                </>
              )}
            </button>
          </article>
        ))}
      </section>

      <section className="csv-footer-note">
        <p>
          All exports use UTF-8 encoding with comma-separated values. Dates follow ISO 8601 format.
          Open with Excel, Google Sheets, or any data analysis tool.
        </p>
      </section>
    </>
  );
};

export default CsvDownloadTab;
