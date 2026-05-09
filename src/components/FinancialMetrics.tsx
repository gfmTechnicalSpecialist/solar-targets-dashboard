import React from 'react';
import { Banknote, Clock } from 'lucide-react';

const FinancialMetrics: React.FC = () => {
  return (
    <div className="metric-card metric-card--enhanced">
      <h3><Banknote size={18} /> Financial Performance</h3>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', gap: '0.6rem', textAlign: 'center' }}>
        <Clock size={20} style={{ color: 'var(--text-secondary)' }} />
        <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0 }}>Still setting up</p>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>Financial data will appear here once configured.</p>
      </div>
    </div>
  );
};

export default FinancialMetrics;