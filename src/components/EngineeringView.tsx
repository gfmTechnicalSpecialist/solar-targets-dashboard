import React, { useEffect, useState } from 'react';
import { Construction, Zap, ZapOff, AlertTriangle, CheckCircle2, Activity } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type PanelStatus = 'active' | 'degraded' | 'fault' | 'offline';

interface SolarPanel {
  id: string;
  label: string;
  voltageV: number;
  currentA: number;
  status: PanelStatus;
}

interface SolarString {
  id: string;
  label: string;
  panels: SolarPanel[];
  busVoltageV: number;
}

interface Inverter {
  id: string;
  label: string;
  strings: SolarString[];
  acOutputKw: number;
  efficiency: number;
  status: PanelStatus;
}

interface SiteData {
  id: string;
  label: string;
  inverters: Inverter[];
  gridConnectionKva: number;
  installedKwp: number;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
function makePanels(idPrefix: string, count: number, baseV: number, statusOverrides: Partial<Record<number, PanelStatus>> = {}): SolarPanel[] {
  return Array.from({ length: count }, (_, i) => {
    const status: PanelStatus = statusOverrides[i] ?? 'active';
    const jitter = (Math.random() - 0.5) * 4;
    const voltageV = status === 'offline' ? 0 : status === 'fault' ? baseV * 0.3 + jitter : status === 'degraded' ? baseV * 0.78 + jitter : baseV + jitter;
    const currentA = status === 'offline' ? 0 : status === 'fault' ? 1.2 : status === 'degraded' ? 5.8 + Math.random() : 8.2 + Math.random() * 0.6;
    return {
      id: `${idPrefix}-p${i + 1}`,
      label: `P${(i + 1).toString().padStart(2, '0')}`,
      voltageV: parseFloat(voltageV.toFixed(1)),
      currentA: parseFloat(currentA.toFixed(2)),
      status,
    };
  });
}

function buildMockData(): SiteData[] {
  return [
    {
      id: 'parc-du-cap',
      label: 'Parc du Cap',
      gridConnectionKva: 250,
      installedKwp: 281,
      inverters: [
        {
          id: 'pdc-inv1',
          label: 'Inverter 1 — SMA STP 60',
          acOutputKw: 54.2,
          efficiency: 97.3,
          status: 'active',
          strings: [
            { id: 'pdc-inv1-s1', label: 'String 1', busVoltageV: 748, panels: makePanels('pdc-inv1-s1', 14, 40.2) },
            { id: 'pdc-inv1-s2', label: 'String 2', busVoltageV: 742, panels: makePanels('pdc-inv1-s2', 14, 40.2, { 6: 'degraded' }) },
            { id: 'pdc-inv1-s3', label: 'String 3', busVoltageV: 750, panels: makePanels('pdc-inv1-s3', 14, 40.2) },
          ],
        },
        {
          id: 'pdc-inv2',
          label: 'Inverter 2 — SMA STP 60',
          acOutputKw: 48.7,
          efficiency: 96.8,
          status: 'active',
          strings: [
            { id: 'pdc-inv2-s1', label: 'String 1', busVoltageV: 752, panels: makePanels('pdc-inv2-s1', 14, 40.2) },
            { id: 'pdc-inv2-s2', label: 'String 2', busVoltageV: 0, panels: makePanels('pdc-inv2-s2', 14, 40.2, { 0: 'fault', 1: 'fault', 2: 'offline', 3: 'offline' }) },
            { id: 'pdc-inv2-s3', label: 'String 3', busVoltageV: 749, panels: makePanels('pdc-inv2-s3', 14, 40.2) },
          ],
        },
      ],
    },
    {
      id: 'centurion',
      label: 'Centurion',
      gridConnectionKva: 2000,
      installedKwp: 1848,
      inverters: [
        {
          id: 'cen-inv1',
          label: 'Inverter 1 — Huawei SUN2000-100K',
          acOutputKw: 96.4,
          efficiency: 98.1,
          status: 'active',
          strings: [
            { id: 'cen-inv1-s1', label: 'String 1', busVoltageV: 986, panels: makePanels('cen-inv1-s1', 24, 41.4) },
            { id: 'cen-inv1-s2', label: 'String 2', busVoltageV: 980, panels: makePanels('cen-inv1-s2', 24, 41.4, { 18: 'degraded', 19: 'degraded' }) },
          ],
        },
        {
          id: 'cen-inv2',
          label: 'Inverter 2 — Huawei SUN2000-100K',
          acOutputKw: 93.1,
          efficiency: 97.9,
          status: 'active',
          strings: [
            { id: 'cen-inv2-s1', label: 'String 1', busVoltageV: 984, panels: makePanels('cen-inv2-s1', 24, 41.4) },
            { id: 'cen-inv2-s2', label: 'String 2', busVoltageV: 979, panels: makePanels('cen-inv2-s2', 24, 41.4) },
          ],
        },
        {
          id: 'cen-inv3',
          label: 'Inverter 3 — Huawei SUN2000-100K',
          acOutputKw: 0,
          efficiency: 0,
          status: 'fault',
          strings: [
            { id: 'cen-inv3-s1', label: 'String 1', busVoltageV: 0, panels: makePanels('cen-inv3-s1', 24, 41.4, Object.fromEntries(Array.from({ length: 24 }, (_, i) => [i, 'offline'])) as Record<number, PanelStatus>) },
            { id: 'cen-inv3-s2', label: 'String 2', busVoltageV: 0, panels: makePanels('cen-inv3-s2', 24, 41.4, Object.fromEntries(Array.from({ length: 24 }, (_, i) => [i, 'offline'])) as Record<number, PanelStatus>) },
          ],
        },
        {
          id: 'cen-inv4',
          label: 'Inverter 4 — Huawei SUN2000-100K',
          acOutputKw: 89.2,
          efficiency: 97.6,
          status: 'active',
          strings: [
            { id: 'cen-inv4-s1', label: 'String 1', busVoltageV: 988, panels: makePanels('cen-inv4-s1', 24, 41.4) },
            { id: 'cen-inv4-s2', label: 'String 2', busVoltageV: 985, panels: makePanels('cen-inv4-s2', 24, 41.4, { 11: 'degraded' }) },
          ],
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Helpers / sub-components
// ---------------------------------------------------------------------------
const STATUS_COLORS: Record<PanelStatus, string> = {
  active: '#22c55e',
  degraded: '#f59e0b',
  fault: '#ef4444',
  offline: '#64748b',
};

const STATUS_BG: Record<PanelStatus, string> = {
  active: 'rgba(34,197,94,0.12)',
  degraded: 'rgba(245,158,11,0.15)',
  fault: 'rgba(239,68,68,0.15)',
  offline: 'rgba(100,116,139,0.12)',
};

function PanelCell({ panel, selected, onSelect }: { panel: SolarPanel; selected: boolean; onSelect: (p: SolarPanel) => void }) {
  const color = STATUS_COLORS[panel.status];
  const bg = STATUS_BG[panel.status];
  return (
    <button
      onClick={() => onSelect(panel)}
      title={`${panel.label} — ${panel.voltageV} V / ${panel.currentA} A`}
      style={{
        position: 'relative',
        width: 40,
        height: 52,
        border: `2px solid ${selected ? '#60a5fa' : color}`,
        borderRadius: 4,
        background: selected ? 'rgba(96,165,250,0.2)' : bg,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 2px',
        gap: 2,
        transition: 'transform 0.15s, box-shadow 0.15s',
        boxShadow: selected ? `0 0 0 2px #60a5fa55` : `0 1px 3px rgba(0,0,0,0.3)`,
        outline: 'none',
        flexShrink: 0,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.12)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
    >
      {/* Panel grid lines */}
      <svg width="30" height="28" viewBox="0 0 30 28" style={{ opacity: panel.status === 'offline' ? 0.3 : 0.85 }}>
        <rect x="1" y="1" width="28" height="26" rx="2" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1" />
        {/* horizontal lines */}
        <line x1="1" y1="10" x2="29" y2="10" stroke={color} strokeWidth="0.6" strokeOpacity="0.7" />
        <line x1="1" y1="18" x2="29" y2="18" stroke={color} strokeWidth="0.6" strokeOpacity="0.7" />
        {/* vertical lines */}
        <line x1="10" y1="1" x2="10" y2="27" stroke={color} strokeWidth="0.6" strokeOpacity="0.7" />
        <line x1="20" y1="1" x2="20" y2="27" stroke={color} strokeWidth="0.6" strokeOpacity="0.7" />
        {/* fault X */}
        {panel.status === 'fault' && (
          <>
            <line x1="4" y1="4" x2="26" y2="24" stroke="#ef4444" strokeWidth="2" />
            <line x1="26" y1="4" x2="4" y2="24" stroke="#ef4444" strokeWidth="2" />
          </>
        )}
      </svg>
      <span style={{ fontSize: '0.55rem', color, fontWeight: 700, letterSpacing: 0, lineHeight: 1 }}>
        {panel.status === 'offline' ? '—' : `${panel.voltageV}V`}
      </span>
    </button>
  );
}

function StringRow({ string: str, selectedPanelId, onSelectPanel }: {
  string: SolarString;
  selectedPanelId: string | null;
  onSelectPanel: (p: SolarPanel) => void;
}) {
  const activePanels = str.panels.filter(p => p.status === 'active').length;
  const hasIssue = str.panels.some(p => p.status === 'fault' || p.status === 'degraded' || p.status === 'offline');
  const busColor = str.busVoltageV > 0 ? '#60a5fa' : '#64748b';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      {/* String label */}
      <div style={{ width: 58, flexShrink: 0, fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'right', fontWeight: 600 }}>
        {str.label}
      </div>

      {/* Panels + connecting wire */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative' }}>
        {/* wire behind panels */}
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, background: `linear-gradient(to right, ${busColor}66, ${busColor}33)`, zIndex: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, position: 'relative', zIndex: 1 }}>
          {str.panels.map((panel) => (
            <PanelCell
              key={panel.id}
              panel={panel}
              selected={selectedPanelId === panel.id}
              onSelect={onSelectPanel}
            />
          ))}
        </div>

        {/* Bus terminal */}
        <div style={{
          marginLeft: 6,
          padding: '3px 8px',
          borderRadius: 4,
          background: str.busVoltageV > 0 ? 'rgba(96,165,250,0.15)' : 'rgba(100,116,139,0.15)',
          border: `1px solid ${busColor}`,
          fontSize: '0.65rem',
          color: busColor,
          fontWeight: 700,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          {str.busVoltageV > 0 ? `${str.busVoltageV} V DC` : 'OPEN'}
        </div>
      </div>

      {/* Status badge */}
      <div style={{ marginLeft: 4, fontSize: '0.6rem', color: hasIssue ? '#f59e0b' : '#22c55e', fontWeight: 600, flexShrink: 0 }}>
        {activePanels}/{str.panels.length} ✓
      </div>
    </div>
  );
}

function InverterBlock({ inverter, selectedPanelId, onSelectPanel }: {
  inverter: Inverter;
  selectedPanelId: string | null;
  onSelectPanel: (p: SolarPanel) => void;
}) {
  const statusColor = STATUS_COLORS[inverter.status];
  const totalPanels = inverter.strings.reduce((s, st) => s + st.panels.length, 0);
  const activePanels = inverter.strings.reduce((s, st) => s + st.panels.filter(p => p.status === 'active').length, 0);

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${statusColor}44`,
      borderRadius: 10,
      padding: '16px 20px',
      marginBottom: 16,
      boxShadow: `0 0 0 1px ${statusColor}22, 0 2px 8px rgba(0,0,0,0.15)`,
    }}>
      {/* Inverter header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: statusColor,
          boxShadow: `0 0 8px ${statusColor}`,
          animation: inverter.status === 'active' ? 'eng-pulse 2s infinite' : 'none',
          flexShrink: 0,
        }} />
        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{inverter.label}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
          {inverter.status === 'active' ? (
            <>
              <Stat label="AC Output" value={`${inverter.acOutputKw.toFixed(1)} kW`} color="#60a5fa" />
              <Stat label="η" value={`${inverter.efficiency.toFixed(1)}%`} color="#22c55e" />
              <Stat label="Panels" value={`${activePanels}/${totalPanels}`} color={activePanels < totalPanels ? '#f59e0b' : '#22c55e'} />
            </>
          ) : (
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: STATUS_COLORS[inverter.status], textTransform: 'uppercase', letterSpacing: 1 }}>
              {inverter.status}
            </span>
          )}
        </div>
      </div>

      {/* DC bus line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, width: 58, textAlign: 'right' }}>DC BUS</div>
        <div style={{ flex: 1, height: 3, background: inverter.status === 'active' ? 'linear-gradient(to right, #60a5fa, #3b82f6)' : '#334155', borderRadius: 2 }} />
        <div style={{ fontSize: '0.6rem', color: '#60a5fa', fontWeight: 700, border: '1px solid #3b82f644', borderRadius: 4, padding: '2px 6px' }}>
          {inverter.status === 'active' ? `≈ ${inverter.strings[0]?.busVoltageV ?? 0} V` : 'OFFLINE'}
        </div>
      </div>

      {/* Strings */}
      <div>
        {inverter.strings.map((str) => (
          <StringRow key={str.id} string={str} selectedPanelId={selectedPanelId} onSelectPanel={onSelectPanel} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const MOCK_SITES = buildMockData();

const EngineeringView: React.FC = () => {
  const [activeSiteId, setActiveSiteId] = useState(MOCK_SITES[0].id);
  const [selectedPanel, setSelectedPanel] = useState<SolarPanel | null>(null);
  const [tick, setTick] = useState(0);

  // Simulate live telemetry jitter
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  const site = MOCK_SITES.find(s => s.id === activeSiteId)!;

  const totalInverters = site.inverters.length;
  const activeInverters = site.inverters.filter(i => i.status === 'active').length;
  const totalPanels = site.inverters.flatMap(i => i.strings).flatMap(s => s.panels).length;
  const activePanels = site.inverters.flatMap(i => i.strings).flatMap(s => s.panels).filter(p => p.status === 'active').length;
  const faultPanels = site.inverters.flatMap(i => i.strings).flatMap(s => s.panels).filter(p => p.status === 'fault').length;
  const degradedPanels = site.inverters.flatMap(i => i.strings).flatMap(s => s.panels).filter(p => p.status === 'degraded').length;
  const totalOutputKw = site.inverters.reduce((s, i) => s + i.acOutputKw, 0);

  return (
    <>
      <style>{`
        @keyframes eng-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes eng-scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
      `}</style>

      <section className="page-heading">
        <div>
          <p className="page-kicker">Engineering</p>
          <h1>Engineering View</h1>
          <p className="page-subtitle">Panel-level telemetry — string diagrams &amp; live status</p>
        </div>

        {/* Under Development badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: 8,
          padding: '8px 14px',
        }}>
          <Construction size={16} color="#f59e0b" />
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 0.8 }}>Under Development</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Data shown is mock — live integration pending</div>
          </div>
        </div>
      </section>

      {/* Site tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {MOCK_SITES.map(s => (
          <button
            key={s.id}
            onClick={() => { setActiveSiteId(s.id); setSelectedPanel(null); }}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              border: `1px solid ${activeSiteId === s.id ? 'var(--accent)' : 'var(--border)'}`,
              background: activeSiteId === s.id ? 'var(--accent)' : 'var(--surface)',
              color: activeSiteId === s.id ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Output', value: `${totalOutputKw.toFixed(1)} kW`, icon: <Zap size={14} />, color: '#60a5fa' },
          { label: 'Inverters Online', value: `${activeInverters} / ${totalInverters}`, icon: <Activity size={14} />, color: activeInverters === totalInverters ? '#22c55e' : '#f59e0b' },
          { label: 'Panels Active', value: `${activePanels} / ${totalPanels}`, icon: <CheckCircle2 size={14} />, color: '#22c55e' },
          { label: 'Degraded', value: degradedPanels.toString(), icon: <AlertTriangle size={14} />, color: degradedPanels > 0 ? '#f59e0b' : 'var(--text-muted)' },
          { label: 'Fault', value: faultPanels.toString(), icon: <ZapOff size={14} />, color: faultPanels > 0 ? '#ef4444' : 'var(--text-muted)' },
          { label: 'Installed', value: `${site.installedKwp} kWp`, icon: <Zap size={14} />, color: 'var(--text-secondary)' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: kpi.color, marginBottom: 4 }}>
              {kpi.icon}
              <span style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6 }}>{kpi.label}</span>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* String diagrams */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '16px 20px',
            marginBottom: 16,
            overflowX: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                String Diagram — {site.label}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: '0.65rem' }}>
                {(['active', 'degraded', 'fault', 'offline'] as PanelStatus[]).map(s => (
                  <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, color: STATUS_COLORS[s] }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: STATUS_COLORS[s], display: 'inline-block' }} />
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </span>
                ))}
              </div>
            </div>

            {site.inverters.map(inv => (
              <InverterBlock
                key={inv.id + tick}
                inverter={inv}
                selectedPanelId={selectedPanel?.id ?? null}
                onSelectPanel={setSelectedPanel}
              />
            ))}
          </div>
        </div>

        {/* Panel detail panel */}
        <div style={{
          width: 220,
          flexShrink: 0,
          background: 'var(--surface)',
          border: `1px solid ${selectedPanel ? STATUS_COLORS[selectedPanel.status] + '66' : 'var(--border)'}`,
          borderRadius: 10,
          padding: 16,
          position: 'sticky',
          top: 20,
        }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 12 }}>
            Panel Inspector
          </div>
          {selectedPanel ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: STATUS_COLORS[selectedPanel.status],
                  boxShadow: `0 0 8px ${STATUS_COLORS[selectedPanel.status]}`,
                  animation: selectedPanel.status === 'active' ? 'eng-pulse 2s infinite' : 'none',
                }} />
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{selectedPanel.label}</span>
              </div>

              {[
                { label: 'Status', value: selectedPanel.status.toUpperCase(), color: STATUS_COLORS[selectedPanel.status] },
                { label: 'Voltage', value: `${selectedPanel.voltageV} V`, color: '#60a5fa' },
                { label: 'Current', value: `${selectedPanel.currentA} A`, color: '#818cf8' },
                { label: 'Power', value: `${(selectedPanel.voltageV * selectedPanel.currentA / 1000).toFixed(2)} kW`, color: '#22c55e' },
              ].map(row => (
                <div key={row.label} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '7px 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{row.label}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: row.color }}>{row.value}</span>
                </div>
              ))}

              {/* Mini SVG "panel" */}
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                <svg width="80" height="90" viewBox="0 0 80 90">
                  <rect x="2" y="2" width="76" height="86" rx="4" fill={STATUS_BG[selectedPanel.status]} stroke={STATUS_COLORS[selectedPanel.status]} strokeWidth="2" />
                  {[1, 2, 3].map(row => [1, 2, 3].map(col => (
                    <rect key={`${row}-${col}`}
                      x={2 + (col - 1) * 26}
                      y={2 + (row - 1) * 29}
                      width="24"
                      height="27"
                      rx="2"
                      fill={STATUS_COLORS[selectedPanel.status]}
                      fillOpacity={selectedPanel.status === 'offline' ? 0.05 : 0.18}
                      stroke={STATUS_COLORS[selectedPanel.status]}
                      strokeWidth="0.8"
                      strokeOpacity="0.5"
                    />
                  )))}
                  {selectedPanel.status === 'fault' && (
                    <>
                      <line x1="10" y1="10" x2="70" y2="80" stroke="#ef4444" strokeWidth="3" />
                      <line x1="70" y1="10" x2="10" y2="80" stroke="#ef4444" strokeWidth="3" />
                    </>
                  )}
                </svg>
              </div>
              <div style={{ textAlign: 'center', marginTop: 6, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                {selectedPanel.id}
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', paddingTop: 20 }}>
              Click any panel in the string diagram to inspect its telemetry.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default EngineeringView;
