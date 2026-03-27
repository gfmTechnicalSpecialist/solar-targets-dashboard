import React, { useState, useEffect, useCallback } from 'react';
import { useSite } from '../context/SiteContext';
import { useAuth } from '../context/AuthContext';
import { Target, Settings, Loader2 } from 'lucide-react';
import { fetchDailyProduction, type DailyProductionPoint } from '../api/higeco';

const TargetProgress: React.FC = () => {
  const { siteId } = useSite();
  const { user } = useAuth();
  const activeSite: 'parc-du-cap' | 'centurion' =
    siteId === 'centurion' ? 'centurion' : 'parc-du-cap';

  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const dayOfMonth = now.getDate();

  // Fetch enough days to cover current month + last month
  const daysInLastMonth = currentMonthIdx === 0
    ? new Date(now.getFullYear() - 1, 12, 0).getDate()
    : new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const daysToFetch = dayOfMonth + daysInLastMonth;

  const [data, setData] = useState<DailyProductionPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    try {
      let result: DailyProductionPoint[];
      if (siteId === 'all') {
        const [pdc, cen] = await Promise.all([
          fetchDailyProduction(user.token, daysToFetch, 'parc-du-cap'),
          fetchDailyProduction(user.token, daysToFetch, 'centurion'),
        ]);
        result = pdc.map((p, i) => ({
          date: p.date,
          dateLabel: p.dateLabel,
          productionKwh: Math.round((p.productionKwh + (cen[i]?.productionKwh ?? 0)) * 10) / 10,
          loadKwh: Math.round((p.loadKwh + (cen[i]?.loadKwh ?? 0)) * 10) / 10,
          loadDuringSolarKwh: Math.round((p.loadDuringSolarKwh + (cen[i]?.loadDuringSolarKwh ?? 0)) * 10) / 10,
        }));
      } else {
        result = await fetchDailyProduction(user.token, daysToFetch, activeSite);
      }
      setData(result);
    } catch {
      // silently fail — cards will show 0 production
    } finally {
      setLoading(false);
    }
  }, [user?.token, daysToFetch, siteId, activeSite]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Split data into current month and last month
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const currentMonthData = data.filter(d => d.date.startsWith(currentMonthStr));
  const lastMonthDataArr = data.filter(d => d.date.startsWith(lastMonthStr));

  const currentMonthProduction = Math.round(currentMonthData.reduce((s, d) => s + d.productionKwh, 0) * 10) / 10;
  const lastMonthProduction = Math.round(lastMonthDataArr.reduce((s, d) => s + d.productionKwh, 0) * 10) / 10;

  // Keys for per-month target storage
  const currentMonthKey = `monthlyTarget_${siteId}_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthKey = `monthlyTarget_${siteId}_${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
  // Also support legacy key (migrates old single-value target)
  const legacyKey = `monthlyTarget_${siteId}`;

  const [customTarget, setCustomTarget] = useState<number | null>(() => {
    const stored = localStorage.getItem(currentMonthKey);
    if (stored) return Number(stored);
    // Migrate from legacy key if exists
    const legacy = localStorage.getItem(legacyKey);
    if (legacy) {
      localStorage.setItem(currentMonthKey, legacy);
      return Number(legacy);
    }
    return null;
  });

  const [lastMonthTarget, setLastMonthTarget] = useState<number | null>(() => {
    const stored = localStorage.getItem(lastMonthKey);
    return stored ? Number(stored) : null;
  });

  const [targetInput, setTargetInput] = useState('');
  const [showTargetInput, setShowTargetInput] = useState(false);

  useEffect(() => {
    // Load current month target
    const stored = localStorage.getItem(currentMonthKey);
    if (stored) {
      setCustomTarget(Number(stored));
      setTargetInput(stored);
    } else {
      const legacy = localStorage.getItem(legacyKey);
      if (legacy) {
        localStorage.setItem(currentMonthKey, legacy);
        setCustomTarget(Number(legacy));
        setTargetInput(legacy);
      } else {
        setCustomTarget(null);
        setTargetInput('');
      }
    }
    // Load last month target
    const lastStored = localStorage.getItem(lastMonthKey);
    setLastMonthTarget(lastStored ? Number(lastStored) : null);
  }, [currentMonthKey, lastMonthKey, legacyKey]);

  const saveTarget = () => {
    const val = Math.max(0, Number(targetInput) || 0);
    if (val > 0) {
      setCustomTarget(val);
      localStorage.setItem(currentMonthKey, String(val));
      localStorage.setItem(legacyKey, String(val));
      // Auto-set last month's target if it doesn't already have one
      if (!localStorage.getItem(lastMonthKey)) {
        localStorage.setItem(lastMonthKey, String(val));
        setLastMonthTarget(val);
      }
    } else {
      setCustomTarget(null);
      localStorage.removeItem(currentMonthKey);
      localStorage.removeItem(legacyKey);
    }
    setShowTargetInput(false);
  };

  const monthlyTarget = customTarget ?? 0;
  const monthlyProgress = monthlyTarget > 0 ? (currentMonthProduction / monthlyTarget) * 100 : 0;
  const progressClamped = Math.min(monthlyProgress, 100);

  // Current month pace tracking
  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // Last month progress
  const effectiveLastMonthTarget = lastMonthTarget ?? monthlyTarget;
  const lastMonthDaysTotal = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0).getDate();
  const lastMonthDaysWithData = lastMonthDataArr.filter(d => d.productionKwh > 0).length;
  const lastMonthProgress = effectiveLastMonthTarget > 0 && lastMonthDataArr.length > 0
    ? (lastMonthProduction / effectiveLastMonthTarget) * 100 : null;
  const lastMonthClamped = lastMonthProgress !== null ? Math.min(lastMonthProgress, 100) : 0;

  const currentMonthName = now.toLocaleString('default', { month: 'long' });
  const lastMonthName = lastMonthDate.toLocaleString('default', { month: 'long' });

  return (
    <div className="tp-wrapper">
      {/* Header row */}
      <div className="tp-header-row">
        <h3 className="tp-main-title"><Target size={18} /> Target Progress</h3>
        <div style={{ position: 'relative' }}>
          <button
            className="target-set-btn"
            onClick={() => { setShowTargetInput(!showTargetInput); setTargetInput(customTarget ? String(customTarget) : ''); }}
            data-active={!!customTarget}
          >
            <Settings size={12} />
            {customTarget ? `${customTarget.toLocaleString()} kWh` : 'Set Target'}
          </button>
          {showTargetInput && (
            <div className="target-input-dropdown">
              <label>Monthly Production Target (kWh)</label>
              <input
                type="number"
                min="0"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveTarget()}
                placeholder="e.g. 50000"
              />
              <div className="target-input-actions">
                <button className="target-save-btn" onClick={saveTarget}>Save</button>
                {customTarget && (
                  <button
                    className="target-clear-btn"
                    onClick={() => { setCustomTarget(null); setTargetInput(''); localStorage.removeItem(currentMonthKey); localStorage.removeItem(legacyKey); setShowTargetInput(false); }}
                  >Clear</button>
                )}
              </div>
            </div>
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
        {/* Card 1: Current Month Progress */}
        <div className="tp-card">
          <div className="tp-card-header">
            <div className="tp-card-title">
              <Target size={14} />
              <span>{currentMonthName} Progress</span>
            </div>
            <span className="tp-bar-badge tp-bar-badge--current">Day {dayOfMonth} of {daysInCurrentMonth}</span>
          </div>
          <div className="tp-card-value tp-card-value--green">
            {Math.round(monthlyProgress)}%
          </div>
          <div className="tp-track">
            <div
              className="tp-fill tp-fill--green"
              style={{ width: `${progressClamped}%` }}
            />
          </div>
          <div className="tp-card-detail">
            <span>{currentMonthProduction.toLocaleString()} kWh</span>
            <span className="tp-bar-separator">/</span>
            <span className="tp-bar-target">{monthlyTarget.toLocaleString()} kWh</span>
          </div>
        </div>

        {/* Card 2: Last Month Progress */}
        <div className="tp-card">
          <div className="tp-card-header">
            <div className="tp-card-title">
              <Target size={14} />
              <span>{lastMonthName} Progress</span>
            </div>
            <span className="tp-bar-badge tp-bar-badge--last">{lastMonthDaysWithData} of {lastMonthDaysTotal} days</span>
          </div>
          {lastMonthDataArr.length > 0 && lastMonthProgress !== null ? (
            <>
              <div className={`tp-card-value ${lastMonthProgress >= 100 ? 'tp-card-value--green' : 'tp-card-value--amber'}`}>
                {Math.round(lastMonthProgress)}%
              </div>
              <div className="tp-track">
                <div
                  className={`tp-fill ${lastMonthProgress >= 100 ? 'tp-fill--green' : 'tp-fill--amber'}`}
                  style={{ width: `${lastMonthClamped}%` }}
                />
              </div>
              <div className="tp-card-detail">
                <span>{lastMonthProduction.toLocaleString()} kWh</span>
                <span className="tp-bar-separator">/</span>
                <span className="tp-bar-target">{effectiveLastMonthTarget.toLocaleString()} kWh</span>
              </div>
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