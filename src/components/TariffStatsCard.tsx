import React, { useState } from 'react';
import { Zap, ZapOff, TrendingDown, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { monthlyTariffData } from '../data/mockData';
import type { TariffStats } from '../data/mockData';

const CURRENT_MONTH_KEY = '2026-05';

const TariffStatsCard: React.FC = () => {
  const monthKeys = Object.keys(monthlyTariffData).sort();
  const [selectedKey, setSelectedKey] = useState(CURRENT_MONTH_KEY);

  const entry = monthlyTariffData[selectedKey];
  const included = entry.included;
  const excluded = entry.excluded;
  const savings = excluded.total - included.total;
  const savingsPct = Math.round((savings / excluded.total) * 100);

  const currentIdx = monthKeys.indexOf(selectedKey);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx < monthKeys.length - 1;

  const TableBlock: React.FC<{ data: TariffStats; accent: string }> = ({ data, accent }) => (
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
          <td colSpan={4} style={{ padding: '8px 8px', fontWeight: 700, color: accent }}>Total</td>
          <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, color: accent, fontSize: '0.9rem' }}>
            R{data.total.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        </tr>
      </tfoot>
    </table>
  );

  return (
    <section style={{ marginBottom: '2rem' }}>
      {/* Header with month selector */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted, var(--text-secondary))', marginBottom: '0.25rem' }}>
            Tariff Statistics
          </p>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{included.monthLabel}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Bill breakdown comparing PV/BESS impact
          </p>
        </div>

        {/* Month navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => canPrev && setSelectedKey(monthKeys[currentIdx - 1])}
            disabled={!canPrev}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: canPrev ? 'pointer' : 'not-allowed', opacity: canPrev ? 1 : 0.4, color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}
            aria-label="Previous month"
          >
            <ChevronLeft size={14} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Calendar size={13} style={{ color: 'var(--text-secondary)' }} />
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: '0.82rem', cursor: 'pointer' }}
            >
              {monthKeys.map((k) => (
                <option key={k} value={k}>{monthlyTariffData[k].included.monthLabel}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => canNext && setSelectedKey(monthKeys[currentIdx + 1])}
            disabled={!canNext}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: canNext ? 'pointer' : 'not-allowed', opacity: canNext ? 1 : 0.4, color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }}
            aria-label="Next month"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Two columns: Included + Excluded */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* PV/BESS Included */}
        <div className="chart-card" style={{ overflow: 'hidden' }}>
          <div className="chart-card-header" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0, fontSize: '0.9rem' }}>
              <Zap size={15} style={{ color: 'var(--success)' }} />
              Tariff Stats — PV/BESS Included
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <TableBlock data={included} accent="var(--success)" />
          </div>
        </div>

        {/* PV/BESS Excluded */}
        <div className="chart-card" style={{ overflow: 'hidden' }}>
          <div className="chart-card-header" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0, fontSize: '0.9rem' }}>
              <ZapOff size={15} style={{ color: 'var(--danger)' }} />
              Tariff Stats — PV/BESS Excluded
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <TableBlock data={excluded} accent="var(--danger)" />
          </div>
        </div>
      </div>

      {/* Savings summary */}
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
            <div style={{
              background: 'var(--success)',
              color: '#fff',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}>
              {savingsPct}% reduction
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TariffStatsCard;
