import React from 'react';
import {
  Zap,
  Building2,
  Lock,
} from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { useAuth } from '../context/AuthContext';
import {
  PDC_TOU_RATES,
  PDC_DEMAND_RATE_PER_KVA,
  SERVICE_CHARGE_EXCL_VAT,
} from '../api/tou';

const FinancialAnalysisTab: React.FC = () => {
  const { siteId } = useSite();
  const { isAuthenticated } = useAuth();

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="page-kicker">Financials</p>
          <h1>Financial Analysis</h1>
          <p className="page-subtitle">Revenue, ROI, investment recovery and cost savings overview</p>
        </div>
      </section>

      {/* CoCT MV TOU tariff classification — Parc du Cap only */}
      {siteId === 'parc-du-cap' && (
        <section className="chart-section">
          <div className="chart-card">
            <div className="chart-card-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Building2 size={16} /> Tariff Classification
              </h2>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', color: 'var(--info)' }}>
                CoCT MV TOU 2025/26
              </span>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Classification info */}
              <div>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Classification</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[
                    { label: 'Utility', value: 'City of Cape Town' },
                    { label: 'Category', value: 'Large Power User (TOU)' },
                    { label: 'Voltage Level', value: 'Medium Voltage (MV)' },
                    { label: 'Current Season', value: 'Low Demand (Sep – May)' },
                  ].map(({ label, value }) => (
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
                      { label: 'Peak energy', value: `R ${PDC_TOU_RATES.peak.toFixed(4)} / kWh`, color: 'var(--danger)' },
                      { label: 'Standard energy', value: `R ${PDC_TOU_RATES.standard.toFixed(4)} / kWh`, color: 'var(--warning)' },
                      { label: 'Off-peak energy', value: `R ${PDC_TOU_RATES.offpeak.toFixed(4)} / kWh`, color: 'var(--info)' },
                      { label: 'Demand', value: `R ${PDC_DEMAND_RATE_PER_KVA.toFixed(2)} / kVA`, color: 'var(--text-primary)' },
                      { label: 'Service charge', value: `R ${SERVICE_CHARGE_EXCL_VAT.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} / month`, color: 'var(--text-primary)' },
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
