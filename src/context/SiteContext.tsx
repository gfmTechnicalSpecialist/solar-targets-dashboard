import React, { createContext, useContext, useState } from 'react';
import type { SiteId } from '../data/mockData';
import { getSiteData, SITES } from '../data/mockData';

interface SiteContextType {
  siteId: SiteId;
  setSiteId: (id: SiteId) => void;
  siteData: ReturnType<typeof getSiteData>;
  siteLabel: string;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export const SiteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [siteId, setSiteId] = useState<SiteId>('all');
  const siteData = getSiteData(siteId);
  const siteLabel = SITES.find((s) => s.id === siteId)?.label ?? 'All Sites';

  return (
    <SiteContext.Provider value={{ siteId, setSiteId, siteData, siteLabel }}>
      {children}
    </SiteContext.Provider>
  );
};

export const useSite = (): SiteContextType => {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used within a SiteProvider');
  return ctx;
};
