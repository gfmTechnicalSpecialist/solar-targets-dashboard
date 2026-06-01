import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSite } from '../context/SiteContext';
import { useAuth } from '../context/AuthContext';
import { Target, Loader2, Calendar } from 'lucide-react';
import { fetchDailyProduction, fetchDailyIrradiance, type DailyProductionPoint, type DailyIrradiancePoint } from '../api/higeco';
import targetsConfig from '../data/targets.json';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function pad2(n: number) { return String(n).padStart(2, '0'); }
function monthKey(year: number, monthIdx0: number) { return `${year}-${pad2(monthIdx0 + 1)}`; }
function monthLabelFromKey(key: string) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}
function addMonths(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, (m - 1) + delta, 1);
  return monthKey(d.getFullYear(), d.getMonth());
}

const TargetProgress: React.FC = () => {
  const { siteId, siteLabel } = useSite();
  const { user } = useAuth();
  const activeSite: 'parc-du-cap' | 'centurion' =
    siteId === 'centurion' ? 'centurion' : 'parc-du-cap';

  const now = useMemo(() => new Date(), []);
  const currentMonthKey = useMemo(() => monthKey(now.getFullYear(), now.getMonth()), [now]);
  const todayDay = useMemo(() => now.getDate(), [now]);

  // Selectable months: from earliest target key (across sites) up to current month
  const monthOptions = useMemo<string[]>(() => {
    const cfg = targetsConfig as Record<string, Record<string, number>>;
    const allKeys = new Set<string>();
    for (const site of Object.values(cfg)) {
      for (const k of Object.keys(site)) {
        if (/^\d{4}-\d{2}$/.test(k)) allKeys.add(k);
      }
    }
    const earliest = [...allKeys].sort()[0] ?? currentMonthKey;
    const out: string[] = [];
    let k = earliest;
    while (k <= currentMonthKey) {
      out.push(k);
      k = addMonths(k, 1);
    }
    return out.reverse(); // newest first
  }, [currentMonthKey]);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const prevMonth = useMemo(() => addMonths(selectedMonth, -1), [selectedMonth]);

  // Build explicit date window covering [start of prev month, end of selected month or today]
  const dateWindow = useMemo(() => {
    const [py, pm] = prevMonth.split('-').map(Number);
    const startDate = `${py}-${pad2(pm)}-01`;
    const [sy, sm] = selectedMonth.split('-').map(Number);
    const lastDayOfSel = new Date(sy, sm, 0).getDate();
    const endIsCurrent = selectedMonth === currentMonthKey;
    const endDay = endIsCurrent ? todayDay : lastDayOfSel;
    const endDate = `${sy}-${pad2(sm)}-${pad2(endDay)}`;
    return { startDate, endDate };
  }, [prevMonth, selectedMonth, currentMonthKey, todayDay]);

  const [data, setData] = useState<DailyProductionPoint[]>([]);
  const [irradianceRaw, setIrradianceRaw] = useState<DailyIrradiancePoint[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    try {
      let result: DailyProductionPoint[];
      let irrResult: DailyIrradiancePoint[] | null = null;
      if (siteId === 'all') {
        const [pdc, cen, irrPdc, irrCen] = await Promise.all([
          fetchDailyProduction(user.token, 0, 'parc-du-cap', dateWindow),
          fetchDailyProduction(user.token, 0, 'centurion', dateWindow),
          fetchDailyIrradiance(user.token, 0, 'parc-du-cap', dateWindow),
          fetchDailyIrradiance(user.token, 0, 'centurion', dateWindow),
        ]);
        result = pdc.map((p, i) => ({
          date: p.date,
          dateLabel: p.dateLabel,
          productionKwh: Math.round((p.productionKwh + (cen[i]?.productionKwh ?? 0)) * 10) / 10,
          loadKwh: Math.round((p.loadKwh + (cen[i]?.loadKwh ?? 0)) * 10) / 10,
          loadDuringSolarKwh: Math.round((p.loadDuringSolarKwh + (cen[i]?.loadDuringSolarKwh ?? 0)) * 10) / 10,
        }));
        const sources = [irrPdc, irrCen].filter(Boolean) as DailyIrradiancePoint[][];
        if (sources.length > 0) {
          irrResult = sources[0].map((p, i) => ({
            date: p.date,
            dateLabel: p.dateLabel,
            irradianceKwhM2: Math.round(sources.reduce((s, src) => s + (src[i]?.irradianceKwhM2 ?? 0), 0) / sources.length * 100) / 100,
          }));
        }
      } else {
        const [prod, irr] = await Promise.all([
          fetchDailyProduction(user.token, 0, activeSite, dateWindow),
          fetchDailyIrradiance(user.token, 0, activeSite, dateWindow),
        ]);
        result = prod;
        irrResult = irr;
      }
      setData(result);
      setIrradianceRaw(irrResult ?? []);
    } catch {
      // silently fail — cards will show 0 production
    } finally {
      setLoading(false);
    }
  }, [user?.token, dateWindow, siteId, activeSite]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Split data into current month and last month
  // Split data into selected month and previous month
  const selectedMonthData = data.filter(d => d.date.startsWith(selectedMonth));
  const prevMonthData     = data.filter(d => d.date.startsWith(prevMonth));

  const selectedMonthProduction = Math.round(selectedMonthData.reduce((s, d) => s + d.productionKwh, 0) * 10) / 10;
  const prevMonthProduction     = Math.round(prevMonthData.reduce((s, d) => s + d.productionKwh, 0) * 10) / 10;

  // Irradiance averages per month
  const selectedMonthIrr = irradianceRaw.filter(d => d.date.startsWith(selectedMonth));
  const prevMonthIrr     = irradianceRaw.filter(d => d.date.startsWith(prevMonth));
  const avgIrrSelected = selectedMonthIrr.length > 0
    ? Math.round(selectedMonthIrr.reduce((s, d) => s + d.irradianceKwhM2, 0) / selectedMonthIrr.length * 100) / 100
    : null;
  const avgIrrPrev = prevMonthIrr.length > 0
    ? Math.round(prevMonthIrr.reduce((s, d) => s + d.irradianceKwhM2, 0) / prevMonthIrr.length * 100) / 100
    : null;

  // --- Targets from config file (src/data/targets.json) ---
  const siteTargets = (targetsConfig as Record<string, Record<string, number>>)[siteId] ?? {};
  const monthlyTarget    = siteTargets[selectedMonth] ?? 0;
  const prevMonthTarget  = siteTargets[prevMonth] ?? 0;
  const monthlyProgress  = monthlyTarget > 0 ? (selectedMonthProduction / monthlyTarget) * 100 : 0;
  const progressClamped  = Math.min(monthlyProgress, 100);

  // Day-of-month tracking for the selected month
  const [selY, selM] = selectedMonth.split('-').map(Number);
  const daysInSelectedMonth = new Date(selY, selM, 0).getDate();
  const isCurrentMonth = selectedMonth === currentMonthKey;
  const dayOfMonth = isCurrentMonth ? todayDay : daysInSelectedMonth;

  // Previous month progress
  const [prevY, prevM] = prevMonth.split('-').map(Number);
  const prevMonthDaysTotal = new Date(prevY, prevM, 0).getDate();
  const prevMonthDaysWithData = prevMonthData.filter(d => d.productionKwh > 0).length;
  const prevMonthProgress = prevMonthTarget > 0 && prevMonthData.length > 0
    ? (prevMonthProduction / prevMonthTarget) * 100 : null;
  const prevMonthClamped = prevMonthProgress !== null ? Math.min(prevMonthProgress, 100) : 0;

  const selectedMonthName = monthLabelFromKey(selectedMonth);
  const prevMonthName     = monthLabelFromKey(prevMonth);

  return (
    <div className="tp-wrapper">
      {/* Header row */}
      <div className="tp-header-row">
        <h3 className="tp-main-title"><Target size={18} /> Target Progress — {siteLabel}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <Calendar size={14} />
            <span>Month</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                background: 'var(--bg-secondary, transparent)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: '0.8rem',
              }}
            >
              {monthOptions.map((k) => (
                <option key={k} value={k}>{monthLabelFromKey(k)}</option>
              ))}
            </select>
          </label>
          {monthlyTarget > 0 && (
            <span className="target-set-btn" data-active="true">
              {monthlyTarget.toLocaleString()} kWh
            </span>
          )}
        </div>
      </div>

      {/* 4 cards grid */}
      <div className="tp-grid" style={{ position: 'relative' }}>
        {loading && (
          <div className="chart-loading-overlay">
            <div className="chart-loading-inner">
              <Loader2 size={28} className="spinner" />
            </div>
          </div>
        )}
        {/* Card 1: Selected Month Progress */}
        <div className="tp-card">
          <div className="tp-card-header">
            <div className="tp-card-title">
              <Target size={14} />
              <span>{selectedMonthName} Progress</span>
            </div>
            <span className="tp-bar-badge tp-bar-badge--current">Day {dayOfMonth} of {daysInSelectedMonth}</span>
          </div>
          <div className="tp-card-value tp-card-value--green">
            {(Math.floor(monthlyProgress * 10) / 10).toFixed(1)}%
          </div>
          <div className="tp-track">
            <div
              className="tp-fill tp-fill--green"
              style={{ width: `${progressClamped}%` }}
            />
          </div>
          <div className="tp-card-detail">
            <span>{selectedMonthProduction.toLocaleString()} kWh</span>
            <span className="tp-bar-separator">/</span>
            <span className="tp-bar-target">{monthlyTarget.toLocaleString()} kWh</span>
          </div>
          {avgIrrSelected !== null && (
            <div style={{ padding: '4px 8px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 6, fontSize: '0.72rem', color: 'var(--chart-production)', display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
              ☀ {avgIrrSelected} kWh/m² avg irradiance
            </div>
          )}
        </div>

        {/* Card 2: Previous Month Progress */}
        <div className="tp-card">
          <div className="tp-card-header">
            <div className="tp-card-title">
              <Target size={14} />
              <span>{prevMonthName} Progress</span>
            </div>
            <span className="tp-bar-badge tp-bar-badge--last">{prevMonthDaysWithData} of {prevMonthDaysTotal} days</span>
          </div>
          {prevMonthData.length > 0 && prevMonthProgress !== null ? (
            <>
              <div className={`tp-card-value ${prevMonthProgress >= 100 ? 'tp-card-value--green' : 'tp-card-value--amber'}`}>
                {(Math.floor(prevMonthProgress * 10) / 10).toFixed(1)}%
              </div>
              <div className="tp-track">
                <div
                  className={`tp-fill ${prevMonthProgress >= 100 ? 'tp-fill--green' : 'tp-fill--amber'}`}
                  style={{ width: `${prevMonthClamped}%` }}
                />
              </div>
              <div className="tp-card-detail">
                <span>{prevMonthProduction.toLocaleString()} kWh</span>
                <span className="tp-bar-separator">/</span>
                <span className="tp-bar-target">{prevMonthTarget.toLocaleString()} kWh</span>
              </div>
              {avgIrrPrev !== null && (
                <div style={{ padding: '4px 8px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 6, fontSize: '0.72rem', color: 'var(--chart-production)', display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
                  ☀ {avgIrrPrev} kWh/m² avg irradiance
                </div>
              )}
            </>
          ) : (
            <div className="tp-card-empty">No data available</div>
          )}
        </div>

      </div>
    </div>
  );
};

export default TargetProgress;