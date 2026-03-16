import React, { useRef, useState } from 'react';
import {
  Banknote,
  Building2,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Clock3,
  Download,
  FileDown,
  Globe2,
  LayoutDashboard,
  Loader2,
  LogOut,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Sun,
  X,
  Zap,
} from 'lucide-react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { SITES } from '../data/mockData';
import SolarMetrics from './SolarMetrics';
import ProductionChart from './ProductionChart';
import LoadVsSolarChart from './LoadVsSolarChart';
import LoadCoverage from './LoadCoverage';
import IrradianceVsProduction from './IrradianceVsProduction';
import FinancialMetrics from './FinancialMetrics';
import TargetProgress from './TargetProgress';
import TodayTab from './TodayTab';
import ByDayTab from './ByDayTab';
import ByMonthTab from './ByMonthTab';
import AllTimeTab from './AllTimeTab';
import CsvDownloadTab from './CsvDownloadTab';

type NavTab = 'Dashboard' | 'Today' | 'By Day' | 'By Month' | 'All Time' | 'CSV Download';

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
  const [selectedYear, setSelectedYear] = useState('2009');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [isCardManagerOpen, setIsCardManagerOpen] = useState(false);
  const [visibleCards, setVisibleCards] = useState<Record<CardId, boolean>>(() =>
    CARD_CONFIG.reduce((acc, card) => {
      acc[card.id] = true;
      return acc;
    }, {} as Record<CardId, boolean>),
  );
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { siteId, setSiteId, siteData, siteLabel } = useSite();

  const { dailyData, currentMetrics, financialMetrics } = siteData;

  const navGroups = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard' as NavTab, icon: LayoutDashboard },
        { label: 'Today' as NavTab, icon: Star },
      ],
    },
    {
      label: 'History',
      items: [
        { label: 'By Day' as NavTab, icon: CalendarDays },
        { label: 'By Month' as NavTab, icon: CalendarRange },
        { label: 'All Time' as NavTab, icon: Clock3 },
      ],
    },
    {
      label: 'Misc',
      items: [
        { label: 'CSV Download' as NavTab, icon: Download },
      ],
    },
  ];

  const availableYears = Array.from({ length: 18 }, (_, index) => String(2009 + index));
  const totalSolar = dailyData.reduce((sum, entry) => sum + entry.solarProduction, 0);
  const totalLoad = dailyData.reduce((sum, entry) => sum + entry.loadConsumption, 0);
  const autarky = Math.min(Math.round((totalSolar / totalLoad) * 100), 100);
  const feedInRevenue = +(financialMetrics.monthlyEarnings * 0.28).toFixed(2);
  const selfConsumptionSavings = +(financialMetrics.monthlyEarnings - feedInRevenue).toFixed(2);
  const annualYield = Math.round(currentMetrics.yearlyProduction / 12);
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
          <div>{user ? user.name : 'Executive User'}</div>
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

            {activeTab === 'Dashboard' && (
              <div className="card-manager">
                <button
                  type="button"
                  className="btn-card-manager"
                  onClick={() => setIsCardManagerOpen((prev) => !prev)}
                  aria-expanded={isCardManagerOpen}
                >
                  <SlidersHorizontal size={14} />
                  <span>Cards ({visibleCardCount}/{CARD_CONFIG.length})</span>
                </button>

                {isCardManagerOpen && (
                  <div className="card-manager-menu" role="menu" aria-label="Card visibility controls">
                    <div className="card-manager-header">
                      <p>Visible Cards</p>
                      <button type="button" onClick={setAllCardsVisible}>Show all</button>
                    </div>
                    <div className="card-manager-list">
                      {CARD_CONFIG.map((card) => (
                        <label key={card.id} className="card-toggle-item">
                          <input
                            type="checkbox"
                            checked={visibleCards[card.id]}
                            onChange={(event) => setCardVisibility(card.id, event.target.checked)}
                          />
                          <span>{card.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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
          {activeTab === 'By Day' && <ByDayTab />}
          {activeTab === 'By Month' && <ByMonthTab />}
          {activeTab === 'All Time' && <AllTimeTab />}
          {activeTab === 'CSV Download' && <CsvDownloadTab />}

          {activeTab === 'Dashboard' && (
            <>
              <section className="page-heading">
                <div>
                  <p className="page-kicker">Overview</p>
                  <h1>Yearly Data</h1>
                  <p className="page-subtitle">Momentum Group renewable energy command center</p>
                </div>
                <label className="page-select">
                  <span>Year</span>
                  <div className="select-wrap">
                    <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
                      {availableYears.map((year) => (
                        <option value={year} key={year}>{year}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </div>
                </label>
              </section>

              <section className="metrics-layout-v2">
                <div className="metrics-top-row">
                  {renderManagedCard('solar-metrics', 'Solar Production', <SolarMetrics />)}
                  {renderManagedCard('target-progress', 'Target Progress', <TargetProgress />)}
                  {renderManagedCard('financial-metrics', 'Financial Performance', <FinancialMetrics />)}
                </div>

                <div className="metrics-bottom-row">
                  {renderManagedCard(
                    'autarky',
                    'Autarky',
                    <article className="mini-panel mini-panel--enhanced">
                      <h3><ShieldCheck size={16} /> Autarky (Self-Sufficiency)</h3>
                      <div className="autarky-layout">
                        <div className="autarky-gauge-section">
                          <div className="autarky-circle">
                            <svg viewBox="0 0 100 100" className="autarky-ring">
                              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--progress-track-bg)" strokeWidth="7" />
                              <circle
                                cx="50" cy="50" r="42" fill="none"
                                stroke={autarky >= 80 ? 'var(--success)' : autarky >= 60 ? 'var(--warning)' : 'var(--danger)'}
                                strokeWidth="7"
                                strokeLinecap="round"
                                strokeDasharray={`${(autarky / 100) * 263.9} 263.9`}
                                transform="rotate(-90 50 50)"
                              />
                            </svg>
                            <div className="autarky-pct">{autarky}<span>%</span></div>
                          </div>
                          <div className="autarky-gauge-label">Self-Sufficiency Score</div>
                        </div>
                        <div className="autarky-stats-grid">
                          <div className="autarky-card autarky-card--solar">
                            <Sun size={14} className="autarky-card-icon" />
                            <div className="autarky-card-value">{dailyData[dailyData.length - 1]?.solarProduction ?? 0}<span> kWh</span></div>
                            <div className="autarky-card-label">Today Solar</div>
                          </div>
                          <div className="autarky-card autarky-card--load">
                            <Zap size={14} className="autarky-card-icon" />
                            <div className="autarky-card-value">{dailyData[dailyData.length - 1]?.loadConsumption ?? 0}<span> kWh</span></div>
                            <div className="autarky-card-label">Today Load</div>
                          </div>
                          <div className="autarky-card autarky-card--solar">
                            <Sun size={14} className="autarky-card-icon" />
                            <div className="autarky-card-value">{totalSolar.toLocaleString()}<span> kWh</span></div>
                            <div className="autarky-card-label">Monthly Solar</div>
                          </div>
                          <div className="autarky-card autarky-card--load">
                            <Zap size={14} className="autarky-card-icon" />
                            <div className="autarky-card-value">{totalLoad.toLocaleString()}<span> kWh</span></div>
                            <div className="autarky-card-label">Monthly Load</div>
                          </div>
                        </div>
                      </div>
                    </article>,
                  )}

                  {renderManagedCard(
                    'earnings',
                    'Earnings',
                    <article className="mini-panel mini-panel--enhanced">
                      <h3><Banknote size={16} /> Earnings Breakdown</h3>
                      <div className="earnings-content">
                        <div className="earnings-total">
                          <div className="earnings-total-value">R{financialMetrics.monthlyEarnings.toLocaleString()}</div>
                          <div className="earnings-total-label">Total Monthly Earnings</div>
                        </div>
                        <div className="earnings-breakdown">
                          <div className="earnings-item">
                            <div className="earnings-item-bar" style={{ background: 'var(--info)' }} />
                            <div className="earnings-item-detail">
                              <span className="earnings-item-label">Feed-in Revenue</span>
                              <strong>R{feedInRevenue.toLocaleString()}</strong>
                            </div>
                          </div>
                          <div className="earnings-item">
                            <div className="earnings-item-bar" style={{ background: 'var(--success)' }} />
                            <div className="earnings-item-detail">
                              <span className="earnings-item-label">Self-Consumption Savings</span>
                              <strong>R{selfConsumptionSavings.toLocaleString()}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>,
                  )}
                </div>
              </section>

              <section className="detail-grid">
                {renderManagedCard('production', 'Production Details', <ProductionChart />)}
                {renderManagedCard('consumption', 'Consumption Details', <LoadVsSolarChart />)}
              </section>

              <section className="secondary-heading">
                <div>
                  <p className="page-kicker">Additional Analysis</p>
                  <h2>Operational Detail</h2>
                </div>
                <div className="secondary-note">Average yearly yield: {annualYield} kWh per month</div>
              </section>

              <section className="secondary-grid">
                {renderManagedCard('load-coverage', 'Load Coverage', <LoadCoverage />)}
                {renderManagedCard('irradiance', 'Irradiance vs Production', <IrradianceVsProduction />)}
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