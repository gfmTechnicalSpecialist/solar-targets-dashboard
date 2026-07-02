import React, { useState } from 'react';
import { Info, X } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { CENTURION_TOU_RATES_BY_SEASON, PDC_TOU_RATES_BY_SEASON, getTouConfig, getTouSeasonForMonth } from '../api/tou';

// ── Schedule data (mirrors classifiers in src/api/tou.ts) ─────────────────────
type ScheduleRow = { period: 'Peak' | 'Standard' | 'Off-Peak'; hours: string };
type DaySchedule = { day: string; rows: ScheduleRow[] };

const PDC_SCHEDULE: DaySchedule[] = [
  { day: 'Weekdays (Mon–Fri)', rows: [
    { period: 'Peak',     hours: '07:00–09:00, 18:00–21:00' },
    { period: 'Standard', hours: '06:00–07:00, 09:00–18:00, 21:00–22:00' },
    { period: 'Off-Peak', hours: '22:00–06:00' },
  ]},
  { day: 'Saturday', rows: [
    { period: 'Standard', hours: '07:00–12:00, 18:00–20:00' },
    { period: 'Off-Peak', hours: 'all other hours' },
  ]},
  { day: 'Sunday', rows: [
    { period: 'Standard', hours: '18:00–20:00' },
    { period: 'Off-Peak', hours: 'all other hours' },
  ]},
];

const CENTURION_SCHEDULE: DaySchedule[] = [
  { day: 'Weekdays (Mon-Fri)', rows: [
    { period: 'Peak',     hours: '06:00-08:00, 17:00-20:00' },
    { period: 'Standard', hours: '08:00-17:00, 20:00-22:00' },
    { period: 'Off-Peak', hours: '22:00-06:00' },
  ]},
  { day: 'Saturday', rows: [
    { period: 'Standard', hours: '07:00-12:00, 17:00-19:00' },
    { period: 'Off-Peak', hours: 'all other hours' },
  ]},
  { day: 'Sunday', rows: [
    { period: 'Off-Peak', hours: 'all day' },
  ]},
];

// South Africa demand seasons: High = Jun–Aug, Low = Sep–May
function currentSeason(): 'High Demand' | 'Low Demand' {
  const m = new Date().getMonth() + 1; // 1–12
  return m >= 6 && m <= 8 ? 'High Demand' : 'Low Demand';
}

const PERIOD_COLORS: Record<ScheduleRow['period'], string> = {
  Peak:       'var(--danger)',
  Standard:   'var(--warning)',
  'Off-Peak': 'var(--info)',
};

const TouInfoButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { siteId, siteLabel } = useSite();
  // 'all' (portfolio view) falls back to PDC tariff for display purposes.
  const tariffSite: 'parc-du-cap' | 'centurion' =
    siteId === 'centurion' ? 'centurion' : 'parc-du-cap';
  const cfg = getTouConfig(tariffSite);
  const schedule = tariffSite === 'centurion' ? CENTURION_SCHEDULE : PDC_SCHEDULE;
  const season = currentSeason();
  const activeSeason = getTouSeasonForMonth(new Date().getMonth() + 1);
  const displayLabel = siteId === 'all'
    ? `${siteLabel} (showing ${tariffSite === 'centurion' ? 'Centurion' : 'PDC'} tariff)`
    : siteLabel;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Tariff & TOU information"
        aria-label="Tariff & TOU information"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        <Info size={16} />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card, var(--bg-primary, #fff))',
              color: 'var(--text-primary)',
              borderRadius: 12,
              border: '1px solid var(--border)',
              maxWidth: 640,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Tariff & TOU Information</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  {displayLabel} · {season} season
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                  cursor: 'pointer', padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 18px' }}>
              {/* Rates */}
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                Energy Rates (R/kWh, excl. VAT)
              </div>
              {tariffSite === 'centurion' ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: 18 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '6px 0', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Charge</th>
                      <th style={{ padding: '6px 0', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Summer</th>
                      <th style={{ padding: '6px 0', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Winter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Peak', key: 'peak' as const, color: PERIOD_COLORS.Peak },
                      { label: 'Standard', key: 'standard' as const, color: PERIOD_COLORS.Standard },
                      { label: 'Off-Peak', key: 'offpeak' as const, color: PERIOD_COLORS['Off-Peak'] },
                    ].map((row) => (
                      <tr key={row.label} style={{ borderBottom: '1px solid var(--border-subtle, var(--border))' }}>
                        <td style={{ padding: '8px 0', color: row.color, fontWeight: 600 }}>{row.label}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: activeSeason === 'summer' ? 700 : 600 }}>R {CENTURION_TOU_RATES_BY_SEASON.summer[row.key].toFixed(4)}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: activeSeason === 'winter' ? 700 : 600 }}>R {CENTURION_TOU_RATES_BY_SEASON.winter[row.key].toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: 18 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '6px 0', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Charge</th>
                      <th style={{ padding: '6px 0', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Low Demand</th>
                      <th style={{ padding: '6px 0', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>High Demand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Peak', key: 'peak' as const, color: PERIOD_COLORS.Peak },
                      { label: 'Standard', key: 'standard' as const, color: PERIOD_COLORS.Standard },
                      { label: 'Off-Peak', key: 'offpeak' as const, color: PERIOD_COLORS['Off-Peak'] },
                    ].map((row) => (
                      <tr key={row.label} style={{ borderBottom: '1px solid var(--border-subtle, var(--border))' }}>
                        <td style={{ padding: '8px 0', color: row.color, fontWeight: 600 }}>{row.label}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: activeSeason === 'summer' ? 700 : 600 }}>R {PDC_TOU_RATES_BY_SEASON.summer[row.key].toFixed(4)}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: activeSeason === 'winter' ? 700 : 600 }}>R {PDC_TOU_RATES_BY_SEASON.winter[row.key].toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Demand */}
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                Monthly Charges
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: 18 }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>{cfg.fixedDemandChargeExclVat == null ? 'Rate per kVA (chargeable demand)' : 'Monthly demand'}</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>R {(cfg.fixedDemandChargeExclVat ?? cfg.demandRatePerKva).toFixed(2)}</td>
                  </tr>
                  {cfg.demandChargeComponents?.map((component) => (
                    <tr key={component.label}>
                      <td style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>{component.label}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>R {component.rate.toFixed(2)} / {component.unit.replace('R/', '')}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>Monthly service</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600 }}>R {cfg.serviceChargeExclVat.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Schedule */}
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                TOU Schedule (SAST, UTC+2)
              </div>
              {schedule.map((day) => (
                <div key={day.day} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 4 }}>{day.day}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <tbody>
                      {day.rows.map((row) => (
                        <tr key={row.period} style={{ borderBottom: '1px solid var(--border-subtle, var(--border))' }}>
                          <td style={{ padding: '5px 0', color: PERIOD_COLORS[row.period], fontWeight: 600, width: 110 }}>
                            {row.period}
                          </td>
                          <td style={{ padding: '5px 0', color: 'var(--text-secondary)' }}>{row.hours}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 8, fontStyle: 'italic' }}>
                Season is determined by month: High Demand = Jun–Aug, Low Demand = Sep–May.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TouInfoButton;
