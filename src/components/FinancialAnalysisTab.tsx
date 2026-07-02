import React from 'react';
import {
  Zap,
  Building2,
  Lock,
} from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { useAuth } from '../context/AuthContext';
import {
  getTouConfig,
} from '../api/tou';

const FinancialAnalysisTab: React.FC = () => {
  const { siteId } = useSite();
  const { isAuthenticated } = useAuth();
  const selectedTariffSite = siteId === 'centurion' || siteId === 'parc-du-cap' ? siteId : null;
  const tariffConfig = selectedTariffSite ? getTouConfig(selectedTariffSite) : null;
  const tariffMeta = selectedTariffSite === 'centurion'
    ? {
        badge: 'Tshwane 11kV TOU SEM',
        classification: [
          { label: 'Utility', value: 'City of Tshwane' },
          { label: 'Category', value: '11kV Supply Scale TOU' },
          { label: 'Voltage Level', value: '11kV' },
          { label: 'Current Season', value: tariffConfig?.season === 'winter' ? 'SEM Winter (Jun-Aug)' : 'SEM Summer (Sep-May)' },
        ],
      }
    : {
        badge: 'CoCT MV TOU 2025/26',
        classification: [
          { label: 'Utility', value: 'City of Cape Town' },
          { label: 'Category', value: 'Large Power User (TOU)' },
          { label: 'Voltage Level', value: 'Medium Voltage (MV)' },
          { label: 'Current Season', value: 'Low Demand (Sep-May)' },
        ],
      };

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="page-kicker">Financials</p>
          <h1>Financial Analysis</h1>
          <p className="page-subtitle">Revenue, ROI, investment recovery and cost savings overview</p>
        </div>
      </section>

      {/* Site tariff classification */}
      {selectedTariffSite && tariffConfig && (
        <section className="chart-section">
          <div className="chart-card">
            <div className="chart-card-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Building2 size={16} /> Tariff Classification
              </h2>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', color: 'var(--info)' }}>
                {tariffMeta.badge}
              </span>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Classification info */}
              <div>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Classification</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {tariffMeta.classification.map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderBottom: '1px solid var(--border-subtle, var(--border))', paddingBottom: '0.35rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Rates */}
              <div>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Applied Rates (excl. VAT)</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <tbody>
                    {[
                      { label: 'Peak energy', value: `R ${tariffConfig.rates.peak.toFixed(4)} / kWh`, color: 'var(--danger)' },
                      { label: 'Standard energy', value: `R ${tariffConfig.rates.standard.toFixed(4)} / kWh`, color: 'var(--warning)' },
                      { label: 'Off-peak energy', value: `R ${tariffConfig.rates.offpeak.toFixed(4)} / kWh`, color: 'var(--info)' },
                      { label: 'Demand', value: tariffConfig.fixedDemandChargeExclVat == null ? `R ${tariffConfig.demandRatePerKva.toFixed(2)} / kVA` : `R ${tariffConfig.fixedDemandChargeExclVat.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} / month`, color: 'var(--text-primary)' },
                      { label: 'Service charge', value: `R ${tariffConfig.serviceChargeExclVat.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} / month`, color: 'var(--text-primary)' },
                    ].map(({ label, value, color }) => (
                      <tr key={label} style={{ borderBottom: '1px solid var(--border-subtle, var(--border))' }}>
                        <td style={{ padding: '5px 0', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Zap size={11} style={{ color }} />{label}
                        </td>
                        <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 600, color }}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* KPI tiles / charts — require live data */}
      {!isAuthenticated ? (
        <section className="chart-section">
          <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', gap: '1rem', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-secondary, rgba(156,163,175,0.12))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={22} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', margin: '0 0 0.35rem' }}>Sign in to view financial data</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Earnings, ROI, investment recovery, and production charts are available after signing in.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="chart-section">
          <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', gap: '1rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              Financial metrics and charts are not yet available for the selected site.
            </p>
          </div>
        </section>
      )}
    </>
  );
};

export default FinancialAnalysisTab;
