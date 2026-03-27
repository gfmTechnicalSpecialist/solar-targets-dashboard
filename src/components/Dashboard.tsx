import React, { useRef, useState } from 'react';
import {
  Building2,
  ChevronDown,
  Download,
  FileDown,
  Globe2,
  LayoutDashboard,
  Loader2,
  LogOut,
  Moon,
  Star,
  Sun,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
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

type NavTab = 'Dashboard' | 'Today' | 'By Month' | 'All Time' | 'CSV Download';

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
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('Dashboard');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
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

  const handleExportPDF = async () => {
    if (!dashboardRef.current || exporting) return;
    setExporting(true);

    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: theme === 'dark' ? '#030736' : '#ececf1',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 297; // A4 landscape width in mm
      const pageHeight = 210; // A4 landscape height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const dateStr = format(new Date(), 'yyyy-MM-dd');
      pdf.save(`Solar-Dashboard-Report-${dateStr}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(false);
    }
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

            <label className="topbar-field">
              <Globe2 size={14} />
              <span>Language</span>
              <div className="select-wrap">
                <select value={selectedLanguage} onChange={(event) => setSelectedLanguage(event.target.value)}>
                  <option>English</option>
                  <option>German</option>
                  <option>French</option>
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
            <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="btn-export" onClick={handleExportPDF} disabled={exporting}>
              {exporting ? <Loader2 size={14} className="spin-icon" /> : <FileDown size={14} />}
              <span>{exporting ? 'Generating' : 'Export PDF'}</span>
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