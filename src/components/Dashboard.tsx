import React, { useRef, useState } from 'react';
import {
  Building2,
  ChevronDown,
  Download,
  LayoutDashboard,
  LogOut,
  Moon,
  Star,
  Sun,
  Cpu,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { SITES } from '../data/mockData';
import TargetProgress from './TargetProgress';
import TodayTab from './TodayTab';
import ByDayTab from './ByDayTab';
import ByMonthTab from './ByMonthTab';
import AllTimeTab from './AllTimeTab';
import CsvDownloadTab from './CsvDownloadTab';
import EngineeringView from './EngineeringView';
type NavTab = 'Dashboard' | 'Today' | 'By Month' | 'All Time' | 'CSV Download' | 'Engineering';

type CardId =
  | 'solar-metrics'
  | 'target-progress'
  | 'financial-metrics'
  | 'autarky'
  | 'earnings'
  | 'production'
  | 'consumption'
  | 'load-coverage'
  | 'irradiance';

const CARD_CONFIG: Array<{ id: CardId; label: string }> = [
  { id: 'solar-metrics', label: 'Solar Production' },
  { id: 'target-progress', label: 'Target Progress' },
  { id: 'financial-metrics', label: 'Financial Performance' },
  { id: 'autarky', label: 'Autarky' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'production', label: 'Production Details' },
  { id: 'consumption', label: 'Consumption Details' },
  { id: 'load-coverage', label: 'Load Coverage' },
  { id: 'irradiance', label: 'Irradiance vs Production' },
];

const Dashboard: React.FC = () => {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('Dashboard');
  const [visibleCards, setVisibleCards] = useState<Record<CardId, boolean>>(() =>
    CARD_CONFIG.reduce((acc, card) => {
      acc[card.id] = true;
      return acc;
    }, {} as Record<CardId, boolean>),
  );
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { siteId, setSiteId, siteLabel } = useSite();

  const navGroups = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard' as NavTab, icon: LayoutDashboard },
        { label: 'Today' as NavTab, icon: Star },
      ],
    },
    {
      label: 'Technical',
      items: [
        { label: 'Engineering' as NavTab, icon: Cpu },
      ],
    },
    {
      label: 'Misc',
      items: [
        { label: 'CSV Download' as NavTab, icon: Download },
      ],
    },
  ];

  const visibleCardCount = Object.values(visibleCards).filter(Boolean).length;

  const setCardVisibility = (cardId: CardId, isVisible: boolean) => {
    setVisibleCards((prev) => ({ ...prev, [cardId]: isVisible }));
  };

  const setAllCardsVisible = () => {
    setVisibleCards((prev) => {
      const next = { ...prev };
      CARD_CONFIG.forEach((card) => {
        next[card.id] = true;
      });
      return next;
    });
  };

  const renderManagedCard = (cardId: CardId, label: string, content: React.ReactNode) => {
    if (!visibleCards[cardId]) {
      return null;
    }

    return (
      <div className="managed-card-shell" key={cardId}>
        <button
          type="button"
          className="managed-card-close"
          onClick={() => setCardVisibility(cardId, false)}
          aria-label={`Hide ${label}`}
          title={`Hide ${label}`}
        >
          <X size={14} />
        </button>
        {content}
      </div>
    );
  };

  return (
    <div className="dashboard" ref={dashboardRef}>
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">m</div>
          <div>
            <div className="sidebar-brand-name">Momentum Group</div>
            <div className="sidebar-brand-subtitle">Solar Intelligence Platform</div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary dashboard navigation">
          {navGroups.map((group) => (
            <div className="sidebar-group" key={group.label}>
              <p className="sidebar-group-label">{group.label}</p>
              <div className="sidebar-links">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      className={`sidebar-link${activeTab === item.label ? ' active' : ''}`}
                      key={item.label}
                      onClick={() => setActiveTab(item.label)}
                    >
                      <Icon size={14} />
                      <span>{item.label}</span>
                      {item.label === 'Engineering' && (
                        <span style={{
                          marginLeft: 'auto',
                          fontSize: '0.55rem',
                          fontWeight: 800,
                          letterSpacing: 0.8,
                          background: 'rgba(245,158,11,0.18)',
                          color: '#f59e0b',
                          border: '1px solid rgba(245,158,11,0.45)',
                          borderRadius: 3,
                          padding: '1px 5px',
                          lineHeight: 1.6,
                          textTransform: 'uppercase',
                        }}>
                          DEV
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div>Version 0.8.0</div>
          <div>{format(new Date(), 'HH:mm:ss')}</div>
          <div>{user ? user.username : 'Executive User'}</div>
        </div>
      </aside>

      <div className="dashboard-stage">
        <header className="dashboard-topbar">
          <div className="topbar-context">{siteLabel} — portfolio targets and yearly performance monitoring</div>
          <div className="topbar-actions">
            <label className="topbar-field">
              <Building2 size={14} />
              <span>Site</span>
              <div className="select-wrap">
                <select value={siteId} onChange={(e) => setSiteId(e.target.value as typeof siteId)}>
                  {SITES.map((s) => (
                    <option value={s.id} key={s.id}>{s.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
            <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="btn-signout" onClick={signOut}>
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        <main className="dashboard-page">
          {activeTab === 'Today' && <TodayTab />}
          {activeTab === 'By Month' && <ByMonthTab />}
          {activeTab === 'All Time' && <AllTimeTab />}
          {activeTab === 'CSV Download' && <CsvDownloadTab />}
          {activeTab === 'Engineering' && <EngineeringView />}

          {activeTab === 'Dashboard' && (
            <>
              <ByDayTab />

              <section className="metrics-layout-v2">
                <div className="metrics-full-row">
                  {renderManagedCard('target-progress', 'Target Progress', <TargetProgress />)}
                </div>
              </section>

              {visibleCardCount === 0 && (
                <section className="no-cards-state">
                  <h3>No cards selected</h3>
                  <p>Use the Cards control in the top bar to add dashboard cards back to the view.</p>
                  <button type="button" onClick={setAllCardsVisible}>Show all cards</button>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;