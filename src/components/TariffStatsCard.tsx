import React, { useState, useEffect } from 'react';
import { Zap, ZapOff, TrendingDown, ChevronLeft, ChevronRight, Calendar, RefreshCw, AlertCircle, Wifi } from 'lucide-react';
import { monthlyTariffData } from '../data/mockData';
import type { TariffStats } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { fetchMonthlyGridEnergyHourly, fetchMonthlyPeakDemand } from '../api/higeco';
import { calculateTouCharges, calculateDemandCharge, DEFAULT_TOU_RATES, SERVICE_CHARGE_EXCL_VAT } from '../api/tou';
import type { TouBreakdown, DemandBreakdown } from '../api/tou';

const CURRENT_MONTH_KEY = '2026-05';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const MockTableBlock: React.FC<{ data: TariffStats; accent: string }> = ({ data, accent }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
    <thead>
      <tr style={{ borderBottom: '1px solid var(--border)' }}>
        <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>Line Item</th>
        <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>Qty</th>
        <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>Unit</th>
        <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>Rate (R)</th>
        <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>Amount (R)</th>
      </tr>
    </thead>
    <tbody>
      {data.lineItems.map((item) => (
        <tr key={item.label} style={{ borderBottom: '1px solid var(--border-subtle, var(--border))' }}>
          <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>{item.label}</td>
          <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{item.qty.toLocaleString()}</td>
          <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{item.unit}</td>
          <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{item.rate.toFixed(4)}</td>
          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
            {item.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        </tr>
      ))}
    </tbody>
    <tfoot>
      <tr style={{ borderTop: `2px solid ${accent}` }}>
        <td colSpan={4} style={{ padding: '8px', fontWeight: 700, color: accent }}>Total</td>
        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: accent, fontSize: '0.9rem' }}>
          R{data.total.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      </tr>
    </tfoot>
  </table>
);

interface TouRow { label: string; kwh: number; rate: number; charge: number; color: string; }

const LiveTouTable: React.FC<{ breakdown: TouBreakdown; demand?: DemandBreakdown | null }> = ({ breakdown, demand }) => {
  const rows: TouRow[] = [
    { label: 'Energy — Peak',     kwh: breakdown.peakKwh,     rate: DEFAULT_TOU_RATES.peak,     charge: breakdown.peakCharge,     color: 'var(--danger)' },
    { label: 'Energy — Standard', kwh: breakdown.standardKwh, rate: DEFAULT_TOU_RATES.standard, charge: breakdown.standardCharge, color: 'var(--warning)' },
    { label: 'Energy — Off-Peak', kwh: breakdown.offpeakKwh,  rate: DEFAULT_TOU_RATES.offpeak,  charge: breakdown.offpeakCharge,  color: 'var(--info)' },
  ];
  const grandTotal = breakdown.totalCharge + (demand?.demandCharge ?? 0) + SERVICE_CHARGE_EXCL_VAT;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>TOU Period</th>
          <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>kWh / kVA</th>
          <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>Rate (R/unit)</th>
          <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>Charge (R)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} style={{ borderBottom: '1px solid var(--border-subtle, var(--border))' }}>
            <td style={{ padding: '6px 8px', color: row.color, fontWeight: 600 }}>{row.label}</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{row.kwh.toLocaleString('en-ZA', { minimumFractionDigits: 3 })}</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{row.rate.toFixed(4)}</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
              {row.charge.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
        ))}
        {demand != null && (
          <tr style={{ borderBottom: '1px solid var(--border-subtle, var(--border))', borderTop: '1px dashed var(--border)' }}>
            <td style={{ padding: '6px 8px', color: 'var(--text-primary)', fontWeight: 600 }}>Demand</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
              {demand.peakKva.toLocaleString('en-ZA', { minimumFractionDigits: 1 })} kVA
            </td>
            <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>93.3600</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
              {demand.demandCharge.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
        )}
        <tr style={{ borderBottom: '1px solid var(--border-subtle, var(--border))', borderTop: '1px dashed var(--border)' }}>
          <td style={{ padding: '6px 8px', color: 'var(--text-primary)', fontWeight: 600 }}>Service</td>
          <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>1 month</td>
          <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>fixed</td>
          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
            {SERVICE_CHARGE_EXCL_VAT.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr style={{ borderTop: '2px solid var(--success)' }}>
          <td style={{ padding: '8px', fontWeight: 700, color: 'var(--success)' }}>Total</td>
          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
            {breakdown.totalEnergyKwh.toLocaleString('en-ZA', { minimumFractionDigits: 3 })} kWh
          </td>
          <td />
          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: 'var(--success)', fontSize: '0.9rem' }}>
            R{grandTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        </tr>
      </tfoot>
    </table>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const TariffStatsCard: React.FC = () => {
  const { user } = useAuth();
  const { siteId } = useSite();

  const monthKeys = Object.keys(monthlyTariffData).sort();
  const [selectedKey, setSelectedKey] = useState(CURRENT_MONTH_KEY);
  const [liveBreakdown, setLiveBreakdown] = useState<TouBreakdown | null>(null);
  const [demandBreakdown, setDemandBreakdown] = useState<DemandBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const entry = monthlyTariffData[selectedKey];
  const included = entry.included;
  const excluded = entry.excluded;
  const savings = excluded.total - included.total;
  const savingsPct = Math.round((savings / excluded.total) * 100);

  const currentIdx = monthKeys.indexOf(selectedKey);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx < monthKeys.length - 1;

  // Whether we can fetch real data: must be signed in and on a specific site
  const canFetchLive = !!user?.token && (siteId === 'parc-du-cap' || siteId === 'centurion');

  useEffect(() => {
    if (!canFetchLive) {
      setLiveBreakdown(null);
      setFetchError(null);
      return;
    }

    const [yearStr, monthStr] = selectedKey.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    setLoading(true);
    setFetchError(null);
    setLiveBreakdown(null);
    setDemandBreakdown(null);

    const siteArg = siteId as 'parc-du-cap' | 'centurion';

    Promise.all([
      fetchMonthlyGridEnergyHourly(user.token, year, month, siteArg),
      fetchMonthlyPeakDemand(user.token, year, month, siteArg).catch(() => null as null),
    ])
      .then(([hourlyPoints, peakKva]) => {
        setLiveBreakdown(calculateTouCharges(hourlyPoints));
        if (peakKva != null) {
          setDemandBreakdown(calculateDemandCharge(peakKva));
        }
      })
      .catch((err: Error) => {
        setFetchError(err.message ?? 'Failed to fetch grid energy data');
      })
      .finally(() => setLoading(false));
  }, [selectedKey, canFetchLive, user?.token, siteId]);

  return (
    <section style={{ marginBottom: '2rem' }}>
      {/* Header with month navigator */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted, var(--text-secondary))', marginBottom: '0.25rem' }}>
            Tariff Statistics
          </p>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{included.monthLabel}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            TOU charge breakdown — grid import classified by Peak / Standard / Off-Peak
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Live / Mock badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '3px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, background: canFetchLive ? 'rgba(16,185,129,0.12)' : 'rgba(156,163,175,0.15)', color: canFetchLive ? 'var(--success)' : 'var(--text-secondary)' }}>
            <Wifi size={11} />
            {canFetchLive ? 'Live' : 'Mock'}
          </div>

          <button type="button" onClick={() => canPrev && setSelectedKey(monthKeys[currentIdx - 1])} disabled={!canPrev}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: canPrev ? 'pointer' : 'not-allowed', opacity: canPrev ? 1 : 0.4, color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }} aria-label="Previous month">
            <ChevronLeft size={14} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Calendar size={13} style={{ color: 'var(--text-secondary)' }} />
            <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}
              style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: '0.82rem', cursor: 'pointer' }}>
              {monthKeys.map((k) => (
                <option key={k} value={k}>{monthlyTariffData[k].included.monthLabel}</option>
              ))}
            </select>
          </div>

          <button type="button" onClick={() => canNext && setSelectedKey(monthKeys[currentIdx + 1])} disabled={!canNext}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: canNext ? 'pointer' : 'not-allowed', opacity: canNext ? 1 : 0.4, color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }} aria-label="Next month">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* ── LIVE MODE: real TOU (included) vs mock excluded ── */}
      {canFetchLive ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            {/* Live TOU (WITH PV/BESS) */}
            <div className="chart-card" style={{ overflow: 'hidden' }}>
              <div className="chart-card-header" style={{ borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0, fontSize: '0.9rem' }}>
                  <Zap size={15} style={{ color: 'var(--success)' }} />
                  Tariff Stats — PV/BESS Included (Live)
                </h3>
                {loading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
                  </div>
                )}
              </div>
              {fetchError ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 1.25rem', color: 'var(--danger)', fontSize: '0.82rem' }}>
                  <AlertCircle size={14} /> {fetchError}
                </div>
              ) : liveBreakdown ? (
                <div style={{ overflowX: 'auto' }}><LiveTouTable breakdown={liveBreakdown} demand={demandBreakdown} /></div>
              ) : !loading ? (
                <div style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>No data returned for this period.</div>
              ) : null}
            </div>

            {/* Mock excluded (WITHOUT PV/BESS) */}
            <div className="chart-card" style={{ overflow: 'hidden' }}>
              <div className="chart-card-header" style={{ borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0, fontSize: '0.9rem' }}>
                  <ZapOff size={15} style={{ color: 'var(--danger)' }} />
                  Tariff Stats — PV/BESS Excluded (Estimated)
                </h3>
              </div>
              <div style={{ overflowX: 'auto' }}><MockTableBlock data={excluded} accent="var(--danger)" /></div>
            </div>
          </div>

          {/* Live savings: excluded mock total - live TOU charge */}
          {liveBreakdown && (() => {
            const liveEnergyCharge = liveBreakdown.totalCharge;
            const liveDemandCharge = demandBreakdown?.demandCharge ?? 0;
            const liveTotal = liveEnergyCharge + liveDemandCharge + SERVICE_CHARGE_EXCL_VAT;
            const liveSavings = excluded.total - liveEnergyCharge;
            const liveSavingsPct = Math.round((liveSavings / excluded.total) * 100);
            return (
              <div className="chart-card" style={{ background: 'linear-gradient(135deg, var(--success-bg, rgba(16,185,129,0.08)), var(--info-bg, rgba(59,130,246,0.08)))' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--success-bg, rgba(16,185,129,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingDown size={20} style={{ color: 'var(--success)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Total Savings — {included.monthLabel}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        Estimated excluded (R{excluded.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}) − Live energy (R{liveEnergyCharge.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}){liveDemandCharge > 0 ? ` + Demand (R${liveDemandCharge.toLocaleString('en-ZA', { minimumFractionDigits: 2 })})` : ''} + Service (R{SERVICE_CHARGE_EXCL_VAT.toLocaleString('en-ZA', { minimumFractionDigits: 2 })})
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: liveSavings >= 0 ? 'var(--success)' : 'var(--danger)', letterSpacing: -0.5 }}>
                      R{Math.abs(liveSavings).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ background: liveSavings >= 0 ? 'var(--success)' : 'var(--danger)', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: '0.8rem', fontWeight: 700 }}>
                      {liveSavingsPct}% {liveSavings >= 0 ? 'reduction' : 'increase'}
                    </div>
                    {(liveDemandCharge > 0 || true) && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>
                        {liveDemandCharge > 0 ? `+ R${liveDemandCharge.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} demand ` : ''}+ R{SERVICE_CHARGE_EXCL_VAT.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} service → total R{liveTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      ) : (
        <>
          {/* ── MOCK MODE: both tables from mock data ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="chart-card" style={{ overflow: 'hidden' }}>
              <div className="chart-card-header" style={{ borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0, fontSize: '0.9rem' }}>
                  <Zap size={15} style={{ color: 'var(--success)' }} />
                  Tariff Stats — PV/BESS Included
                </h3>
              </div>
              <div style={{ overflowX: 'auto' }}><MockTableBlock data={included} accent="var(--success)" /></div>
            </div>

            <div className="chart-card" style={{ overflow: 'hidden' }}>
              <div className="chart-card-header" style={{ borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0, fontSize: '0.9rem' }}>
                  <ZapOff size={15} style={{ color: 'var(--danger)' }} />
                  Tariff Stats — PV/BESS Excluded
                </h3>
              </div>
              <div style={{ overflowX: 'auto' }}><MockTableBlock data={excluded} accent="var(--danger)" /></div>
            </div>
          </div>

          {/* Mock savings summary */}
          <div className="chart-card" style={{ background: 'linear-gradient(135deg, var(--success-bg, rgba(16,185,129,0.08)), var(--info-bg, rgba(59,130,246,0.08)))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--success-bg, rgba(16,185,129,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingDown size={20} style={{ color: 'var(--success)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Total Savings — {included.monthLabel}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    PV/BESS Excluded − PV/BESS Included
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success)', letterSpacing: -0.5 }}>
                  R{savings.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ background: 'var(--success)', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: '0.8rem', fontWeight: 700 }}>
                  {savingsPct}% reduction
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default TariffStatsCard;
