import React, { useState, useEffect } from 'react';
import { Zap, TrendingDown, ChevronLeft, ChevronRight, Calendar, RefreshCw, AlertCircle, Wifi, Clock } from 'lucide-react';
import { monthlyTariffData } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { fetchMonthlyGridEnergyHourly, fetchMonthlyLoadEnergyHourly, fetchMonthlyPeakDemand } from '../api/higeco';
import { calculateTouCharges, calculateDemandCharge, getTouConfig, TOU_CONFIG_BY_SITE } from '../api/tou';
import type { TouBreakdown, DemandBreakdown, TouConfig } from '../api/tou';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SetupPlaceholder: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1.5rem', gap: '0.6rem', textAlign: 'center', height: '100%' }}>
    <Clock size={20} style={{ color: 'var(--text-secondary)' }} />
    <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0 }}>Still setting up</p>
    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>This data will appear here once configured.</p>
  </div>
);

interface TouRow { label: string; kwh: number; rate: number; charge: number; color: string; }

const LiveTouTable: React.FC<{
  breakdown: TouBreakdown;
  demand?: DemandBreakdown | null;
  energyOnly?: boolean;
  config?: TouConfig;
}> = ({ breakdown, demand, energyOnly, config = TOU_CONFIG_BY_SITE['parc-du-cap'] }) => {
  const { rates, demandRatePerKva, serviceChargeExclVat, fixedDemandChargeExclVat } = config;
  const rows: TouRow[] = [
    { label: 'Energy — Peak',     kwh: breakdown.peakKwh,     rate: rates.peak,     charge: breakdown.peakCharge,     color: 'var(--danger)' },
    { label: 'Energy — Standard', kwh: breakdown.standardKwh, rate: rates.standard, charge: breakdown.standardCharge, color: 'var(--warning)' },
    { label: 'Energy — Off-Peak', kwh: breakdown.offpeakKwh,  rate: rates.offpeak,  charge: breakdown.offpeakCharge,  color: 'var(--info)' },
  ];
  const grandTotal = energyOnly
    ? breakdown.totalCharge
    : breakdown.totalCharge + (demand?.demandCharge ?? fixedDemandChargeExclVat ?? 0) + serviceChargeExclVat;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>TOU Period</th>
          <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>kWh / kVA</th>
          <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>Rate (R/unit excl. VAT)</th>
          <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>Charge (R excl. VAT)</th>
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
        {!energyOnly && (demand != null || fixedDemandChargeExclVat != null) && (
          <tr style={{ borderBottom: '1px solid var(--border-subtle, var(--border))', borderTop: '1px dashed var(--border)' }}>
            <td style={{ padding: '6px 8px', color: 'var(--text-primary)', fontWeight: 600 }}>Demand</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
              {fixedDemandChargeExclVat == null && demand
                ? `${(demand.chargeableKva ?? demand.peakKva).toLocaleString('en-ZA', { minimumFractionDigits: 1 })} kVA`
                : '1 month'}
            </td>
            <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>{fixedDemandChargeExclVat == null ? demandRatePerKva.toFixed(4) : 'fixed'}</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
              {(demand?.demandCharge ?? fixedDemandChargeExclVat ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
        )}
        {!energyOnly && (
          <tr style={{ borderBottom: '1px solid var(--border-subtle, var(--border))', borderTop: '1px dashed var(--border)' }}>
            <td style={{ padding: '6px 8px', color: 'var(--text-primary)', fontWeight: 600 }}>Service</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>1 month</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>fixed</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
              {serviceChargeExclVat.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
        )}
      </tbody>
      <tfoot>
        <tr style={{ borderTop: '2px solid var(--success)' }}>
          <td style={{ padding: '8px', fontWeight: 700, color: 'var(--success)' }}>Total excl. VAT</td>
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
// Savings analysis card
// ---------------------------------------------------------------------------

interface SavingsAnalysisProps {
  included: TouBreakdown;
  excluded: TouBreakdown;
  demand: DemandBreakdown | null;
  config: TouConfig;
}

const SavingsAnalysis: React.FC<SavingsAnalysisProps> = ({ included, excluded, demand, config }) => {
  const demandCharge = demand?.demandCharge ?? config.fixedDemandChargeExclVat ?? 0;

  const inclTotal = included.totalCharge + demandCharge + config.serviceChargeExclVat;
  const exclTotal = excluded.totalCharge + demandCharge + config.serviceChargeExclVat;
  const totalSavings = exclTotal - inclTotal;
  const savingsPct = exclTotal > 0 ? (totalSavings / exclTotal) * 100 : 0;

  const totalLoadKwh = excluded.totalEnergyKwh;
  const gridImportKwh = included.totalEnergyKwh;
  const selfSupplyKwh = Math.max(0, totalLoadKwh - gridImportKwh);
  const selfSupplyPct = totalLoadKwh > 0 ? (selfSupplyKwh / totalLoadKwh) * 100 : 0;

  const periods = [
    { label: 'Peak',     color: 'var(--danger)',  exclKwh: excluded.peakKwh,     inclKwh: included.peakKwh,     exclCharge: excluded.peakCharge,     inclCharge: included.peakCharge },
    { label: 'Standard', color: 'var(--warning)', exclKwh: excluded.standardKwh, inclKwh: included.standardKwh, exclCharge: excluded.standardCharge, inclCharge: included.standardCharge },
    { label: 'Off-Peak', color: 'var(--info)',    exclKwh: excluded.offpeakKwh,  inclKwh: included.offpeakKwh,  exclCharge: excluded.offpeakCharge,  inclCharge: included.offpeakCharge },
  ].map(p => ({
    ...p,
    kwhAvoided: p.exclKwh - p.inclKwh,
    rSaved: p.exclCharge - p.inclCharge,
    pctOfTotal: totalSavings > 0 ? ((p.exclCharge - p.inclCharge) / totalSavings) * 100 : 0,
  }));

  const bestPeriod = [...periods].sort((a, b) => b.rSaved - a.rSaved)[0];

  const kpi = (label: string, value: string, sub: string, valueColor = 'var(--success)') => (
    <div>
      <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-secondary)', margin: '0 0 0.25rem' }}>{label}</p>
      <p style={{ fontSize: '1.35rem', fontWeight: 700, color: valueColor, margin: 0 }}>{value}</p>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.1rem 0 0' }}>{sub}</p>
    </div>
  );

  return (
    <div className="chart-card" style={{ marginTop: '1rem', overflow: 'hidden' }}>
      <div className="chart-card-header" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0, fontSize: '0.9rem' }}>
          <TrendingDown size={15} style={{ color: 'var(--success)' }} />
          PV/BESS Savings Analysis
        </h3>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Grid-only bill vs actual bill with PV/BESS</span>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
        {kpi('Monthly Saving', `R${totalSavings.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'excl. VAT — versus grid-only bill')}
        {kpi('Bill Reduction', `${savingsPct.toFixed(1)}%`, 'of total bill offset by PV/BESS')}
        {kpi('Self-Supply Rate', `${selfSupplyPct.toFixed(1)}%`, `${Math.round(selfSupplyKwh).toLocaleString('en-ZA')} kWh of ${Math.round(totalLoadKwh).toLocaleString('en-ZA')} kWh load`, 'var(--info)')}
      </div>

      {/* Per-period breakdown table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left',  padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>Period</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>kWh Avoided</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>Grid-only (R)</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>With PV/BESS (R)</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>Saved (R)</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600 }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {periods.map(p => (
              <tr key={p.label} style={{ borderBottom: '1px solid var(--border-subtle, var(--border))', background: p.label === bestPeriod.label ? 'rgba(16,185,129,0.05)' : undefined }}>
                <td style={{ padding: '6px 8px', color: p.color, fontWeight: 600 }}>
                  {p.label}
                  {p.label === bestPeriod.label && (
                    <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', background: 'rgba(16,185,129,0.15)', color: 'var(--success)', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>BEST</span>
                  )}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {p.kwhAvoided.toLocaleString('en-ZA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {p.exclCharge.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {p.inclCharge.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: p.rSaved >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {p.rSaved.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
                    <div style={{ width: 60, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, Math.max(0, p.pctOfTotal))}%`, height: '100%', background: p.color, borderRadius: 3 }} />
                    </div>
                    <span style={{ color: 'var(--text-secondary)', minWidth: '2.5rem', textAlign: 'right' }}>{p.pctOfTotal.toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const TariffStatsCard: React.FC = () => {
  const { user } = useAuth();
  const { siteId, siteLabel } = useSite();

  const monthKeys = Object.keys(monthlyTariffData).sort();
  const [selectedKey, setSelectedKey] = useState(monthKeys[monthKeys.length - 1] ?? '');
  const [liveBreakdown, setLiveBreakdown] = useState<TouBreakdown | null>(null);
  const [excludedBreakdown, setExcludedBreakdown] = useState<TouBreakdown | null>(null);
  const [demandBreakdown, setDemandBreakdown] = useState<DemandBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const entry = monthlyTariffData[selectedKey];
  const included = entry.included;

  const currentIdx = monthKeys.indexOf(selectedKey);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx < monthKeys.length - 1;

  // Whether we can fetch real data: must be signed in and on a specific site
  const canFetchLive = !!user?.token && (siteId === 'parc-du-cap' || siteId === 'centurion');
  const [, selectedMonthStr] = selectedKey.split('-');
  const selectedMonth = parseInt(selectedMonthStr, 10);
  const tariffSite = siteId === 'centurion' || siteId === 'parc-du-cap' ? siteId : 'parc-du-cap';
  const activeTouConfig = Number.isNaN(selectedMonth) ? TOU_CONFIG_BY_SITE[tariffSite] : getTouConfig(tariffSite, selectedMonth);
  const seasonLabel = activeTouConfig.season === 'winter'
    ? tariffSite === 'centurion' ? 'Winter' : 'High demand'
    : tariffSite === 'centurion' ? 'Summer' : 'Low demand';
  const seasonTitle = activeTouConfig.season === 'winter'
    ? 'June-August high-demand season'
    : 'September-May low-demand season';
  const tariffLabel = siteId === 'all' ? `PDC tariff shown for ${siteLabel}` : `${siteLabel} tariff`;
  const classificationTitle = `${activeTouConfig.touClassificationLabel}\nPeriods: ${activeTouConfig.touPeriodSourceLabel}`;

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
    setExcludedBreakdown(null);
    setDemandBreakdown(null);

    const siteArg = siteId as 'parc-du-cap' | 'centurion';

    Promise.all([
      fetchMonthlyGridEnergyHourly(user.token, year, month, siteArg),
      fetchMonthlyPeakDemand(user.token, year, month, siteArg).catch(() => null as null),
      fetchMonthlyLoadEnergyHourly(user.token, year, month, siteArg).catch(() => null as null),
    ])
      .then(([hourlyPoints, peakKva, loadPoints]) => {
        const touConfig = getTouConfig(siteArg, month);
        setLiveBreakdown(calculateTouCharges(hourlyPoints, touConfig));
        if (peakKva != null) {
          setDemandBreakdown(calculateDemandCharge(peakKva, touConfig));
        } else if (touConfig.fixedDemandChargeExclVat != null || touConfig.minimumDemandKva != null) {
          setDemandBreakdown(calculateDemandCharge(0, touConfig));
        }
        if (loadPoints != null) {
          setExcludedBreakdown(calculateTouCharges(loadPoints, touConfig));
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <span title={seasonTitle} style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: activeTouConfig.season === 'winter' ? 'rgba(59,130,246,0.12)' : 'rgba(245,158,11,0.14)', color: activeTouConfig.season === 'winter' ? 'var(--info)' : 'var(--warning)' }}>
              {seasonLabel}
            </span>
            <span title={classificationTitle} style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.18)', color: 'var(--warning)' }}>
              TOU
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{tariffLabel}</span>
          </div>
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

      {/* ── LIVE MODE ── */}
      {canFetchLive ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
              <div style={{ overflowX: 'auto' }}><LiveTouTable breakdown={liveBreakdown} demand={demandBreakdown} config={activeTouConfig} /></div>
            ) : !loading ? (
              <div style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>No data returned for this period.</div>
            ) : null}
          </div>

          {/* PV/BESS Excluded — total load energy */}
          <div className="chart-card" style={{ overflow: 'hidden' }}>
            <div className="chart-card-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: '0.9rem' }}>Tariff Stats — PV/BESS Excluded</h3>
            </div>
            {fetchError ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 1.25rem', color: 'var(--danger)', fontSize: '0.82rem' }}>
                <AlertCircle size={14} /> {fetchError}
              </div>
            ) : excludedBreakdown ? (
              <div style={{ overflowX: 'auto' }}><LiveTouTable breakdown={excludedBreakdown} demand={demandBreakdown} config={activeTouConfig} /></div>
            ) : !loading ? (
              <SetupPlaceholder />
            ) : null}
          </div>
        </div>

          {/* Savings analysis — rendered once both tables have data */}
          {liveBreakdown && excludedBreakdown && (
            <SavingsAnalysis included={liveBreakdown} excluded={excludedBreakdown} demand={demandBreakdown} config={activeTouConfig} />
          )}
        </>
      ) : (
        /* ── MOCK / SIGNED-OUT MODE ── */
        <div className="chart-card" style={{ overflow: 'hidden' }}>
          <SetupPlaceholder />
        </div>
      )}
    </section>
  );
};

export default TariffStatsCard;
