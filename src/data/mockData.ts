import { format, subDays, startOfDay } from 'date-fns';

/* ============================================
   SITE DEFINITIONS
   ============================================ */
export type SiteId = 'centurion' | 'parc-du-cap' | 'all';

export const SITES: Array<{ id: SiteId; label: string }> = [
  { id: 'all', label: 'All Sites' },
  { id: 'centurion', label: 'Centurion' },
  { id: 'parc-du-cap', label: 'Parc du Cap' },
];

/* ============================================
   DATA GENERATORS (parameterized per site)
   ============================================ */

const generateDailyData = (days: number, solarMin: number, solarRange: number, loadMin: number, loadRange: number, target: number) => {
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = startOfDay(subDays(new Date(), i));
    const solarProduction = Math.floor(Math.random() * solarRange + solarMin);
    const loadConsumption = Math.floor(Math.random() * loadRange + loadMin);
    const irradiance = +(Math.random() * 4 + 3).toFixed(2);
    const loadCoverage = Math.min(Math.round((solarProduction / loadConsumption) * 100), 100);

    data.push({
      date: format(date, 'yyyy-MM-dd'),
      dateLabel: format(date, 'MMM dd'),
      solarProduction,
      loadConsumption,
      target,
      netExport: solarProduction - loadConsumption,
      efficiency: Math.round((solarProduction / target) * 100),
      irradiance,
      loadCoverage,
    });
  }
  return data;
};

const generateHourlyData = (peakKw: number, baseLoad: number, loadVariance: number) =>
  Array.from({ length: 24 }, (_, hour) => {
    const sunUp = hour >= 6 && hour <= 19;
    const peakFactor = sunUp ? Math.sin(((hour - 6) / 13) * Math.PI) : 0;
    const solar = sunUp ? +(peakFactor * peakKw + Math.random() * 1.2).toFixed(1) : 0;
    const load = +(baseLoad + Math.random() * loadVariance + (hour >= 8 && hour <= 18 ? 2 : 0)).toFixed(1);
    return {
      hour: `${String(hour).padStart(2, '0')}:00`,
      solarKw: solar,
      loadKw: load,
      netKw: +(solar - load).toFixed(1),
    };
  });

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const generateMonthlyDataForSite = (year: number, prodBase: number, targetBase: number, consBase: number, rate: number) =>
  monthNames.map((month, i) => {
    const seasonFactor = 1 - 0.35 * Math.cos(((i - 5.5) / 12) * 2 * Math.PI);
    const production = Math.round(prodBase * seasonFactor + (Math.random() - 0.5) * 200);
    const target = Math.round(targetBase * seasonFactor);
    const consumption = Math.round(consBase + (Math.random() - 0.5) * 300);
    return {
      month,
      monthIndex: i,
      year,
      production,
      target,
      consumption,
      netExport: production - consumption,
      coverage: Math.min(Math.round((production / consumption) * 100), 100),
      irradiance: +(3.5 * seasonFactor + Math.random() * 0.8).toFixed(2),
      earnings: Math.round(production * rate),
    };
  });

/* ============================================
   CENTURION SITE DATA
   ============================================ */
const centurionDaily = generateDailyData(30, 30, 50, 45, 40, 65);

const centurionMetrics = {
  todayProduction: 67.8,
  monthlyProduction: 1847.2,
  yearlyProduction: 18472.5,
  monthlyTarget: 1950,
  yearlyTarget: 22000,
  currentGeneration: 8.5,
  peakGeneration: 9.2,
  systemCapacity: 10.0,
};

const centurionFinancial = {
  monthlyEarnings: 347.2,
  yearlyEarnings: 3842.8,
  projectedAnnualSavings: 4200,
  investmentRecovered: 12500,
  totalInvestment: 25000,
  paybackPeriod: 6.2,
  roi: 16.8,
  carbonOffset: 8.2,
};

const centurionHealth = {
  status: 'Optimal',
  uptime: 99.7,
  lastMaintenance: '2024-02-15',
  nextMaintenance: '2024-05-15',
  alerts: [{ type: 'info', message: 'Inverter 2 - Performance slightly below expected' }],
};

const centurionHourly = generateHourlyData(9.2, 2, 3);

const centurionMonthlyByYear: Record<string, ReturnType<typeof generateMonthlyDataForSite>> = {};
for (let y = 2009; y <= 2026; y++) {
  centurionMonthlyByYear[String(y)] = generateMonthlyDataForSite(y, 1200, 1300, 1400, 0.18);
}

const centurionAllTime = {
  totalProduction: 287450,
  totalConsumption: 312800,
  totalEarnings: 51741,
  totalCarbonOffset: 134.2,
  systemAge: 6.3,
  bestMonth: { month: 'Jun 2024', production: 2180 },
  bestDay: { date: 'Jun 21 2024', production: 92 },
  avgDailyProduction: 52.4,
  avgMonthlyCoverage: 78,
  lifetimeRoi: 107,
  peakPower: 9.8,
};

/* ============================================
   PARC DU CAP SITE DATA
   ============================================ */
const parcDuCapDaily = generateDailyData(30, 25, 45, 40, 35, 55);

const parcDuCapMetrics = {
  todayProduction: 52.3,
  monthlyProduction: 1420.6,
  yearlyProduction: 14850.3,
  monthlyTarget: 1550,
  yearlyTarget: 18000,
  currentGeneration: 6.8,
  peakGeneration: 7.6,
  systemCapacity: 8.0,
};

const parcDuCapFinancial = {
  monthlyEarnings: 268.5,
  yearlyEarnings: 2974.1,
  projectedAnnualSavings: 3350,
  investmentRecovered: 9800,
  totalInvestment: 20000,
  paybackPeriod: 6.7,
  roi: 14.9,
  carbonOffset: 6.5,
};

const parcDuCapHealth = {
  status: 'Optimal',
  uptime: 99.4,
  lastMaintenance: '2024-03-10',
  nextMaintenance: '2024-06-10',
  alerts: [{ type: 'info', message: 'Panel cleaning scheduled next week' }],
};

const parcDuCapHourly = generateHourlyData(7.6, 1.8, 2.5);

const parcDuCapMonthlyByYear: Record<string, ReturnType<typeof generateMonthlyDataForSite>> = {};
for (let y = 2009; y <= 2026; y++) {
  parcDuCapMonthlyByYear[String(y)] = generateMonthlyDataForSite(y, 950, 1050, 1150, 0.18);
}

const parcDuCapAllTime = {
  totalProduction: 221300,
  totalConsumption: 248600,
  totalEarnings: 39834,
  totalCarbonOffset: 103.4,
  systemAge: 5.8,
  bestMonth: { month: 'Jan 2024', production: 1820 },
  bestDay: { date: 'Jan 15 2024', production: 78 },
  avgDailyProduction: 41.8,
  avgMonthlyCoverage: 72,
  lifetimeRoi: 99,
  peakPower: 7.9,
};

/* ============================================
   COMBINED "ALL SITES" (aggregate)
   ============================================ */
const combineDailyData = (a: typeof centurionDaily, b: typeof parcDuCapDaily) =>
  a.map((row, idx) => {
    const bRow = b[idx];
    const solarProduction = row.solarProduction + bRow.solarProduction;
    const loadConsumption = row.loadConsumption + bRow.loadConsumption;
    const target = row.target + bRow.target;
    return {
      ...row,
      solarProduction,
      loadConsumption,
      target,
      netExport: solarProduction - loadConsumption,
      efficiency: Math.round((solarProduction / target) * 100),
      irradiance: +((row.irradiance + bRow.irradiance) / 2).toFixed(2),
      loadCoverage: Math.min(Math.round((solarProduction / loadConsumption) * 100), 100),
    };
  });

const combineHourlyData = (a: typeof centurionHourly, b: typeof parcDuCapHourly) =>
  a.map((row, idx) => {
    const bRow = b[idx];
    const solarKw = +(row.solarKw + bRow.solarKw).toFixed(1);
    const loadKw = +(row.loadKw + bRow.loadKw).toFixed(1);
    return { hour: row.hour, solarKw, loadKw, netKw: +(solarKw - loadKw).toFixed(1) };
  });

const combineMonthlyByYear = (
  a: typeof centurionMonthlyByYear,
  b: typeof parcDuCapMonthlyByYear,
): Record<string, ReturnType<typeof generateMonthlyDataForSite>> => {
  const combined: Record<string, ReturnType<typeof generateMonthlyDataForSite>> = {};
  for (const year of Object.keys(a)) {
    combined[year] = a[year].map((m, idx) => {
      const bm = b[year][idx];
      const production = m.production + bm.production;
      const target = m.target + bm.target;
      const consumption = m.consumption + bm.consumption;
      return {
        ...m,
        production,
        target,
        consumption,
        netExport: production - consumption,
        coverage: Math.min(Math.round((production / consumption) * 100), 100),
        irradiance: +((m.irradiance + bm.irradiance) / 2).toFixed(2),
        earnings: m.earnings + bm.earnings,
      };
    });
  }
  return combined;
};

const allSitesDaily = combineDailyData(centurionDaily, parcDuCapDaily);
const allSitesHourly = combineHourlyData(centurionHourly, parcDuCapHourly);
const allSitesMonthlyByYear = combineMonthlyByYear(centurionMonthlyByYear, parcDuCapMonthlyByYear);

const allSitesMetrics = {
  todayProduction: +(centurionMetrics.todayProduction + parcDuCapMetrics.todayProduction).toFixed(1),
  monthlyProduction: +(centurionMetrics.monthlyProduction + parcDuCapMetrics.monthlyProduction).toFixed(1),
  yearlyProduction: +(centurionMetrics.yearlyProduction + parcDuCapMetrics.yearlyProduction).toFixed(1),
  monthlyTarget: centurionMetrics.monthlyTarget + parcDuCapMetrics.monthlyTarget,
  yearlyTarget: centurionMetrics.yearlyTarget + parcDuCapMetrics.yearlyTarget,
  currentGeneration: +(centurionMetrics.currentGeneration + parcDuCapMetrics.currentGeneration).toFixed(1),
  peakGeneration: +(centurionMetrics.peakGeneration + parcDuCapMetrics.peakGeneration).toFixed(1),
  systemCapacity: centurionMetrics.systemCapacity + parcDuCapMetrics.systemCapacity,
};

const allSitesFinancial = {
  monthlyEarnings: +(centurionFinancial.monthlyEarnings + parcDuCapFinancial.monthlyEarnings).toFixed(1),
  yearlyEarnings: +(centurionFinancial.yearlyEarnings + parcDuCapFinancial.yearlyEarnings).toFixed(1),
  projectedAnnualSavings: centurionFinancial.projectedAnnualSavings + parcDuCapFinancial.projectedAnnualSavings,
  investmentRecovered: centurionFinancial.investmentRecovered + parcDuCapFinancial.investmentRecovered,
  totalInvestment: centurionFinancial.totalInvestment + parcDuCapFinancial.totalInvestment,
  paybackPeriod: +((centurionFinancial.paybackPeriod + parcDuCapFinancial.paybackPeriod) / 2).toFixed(1),
  roi: +((centurionFinancial.roi + parcDuCapFinancial.roi) / 2).toFixed(1),
  carbonOffset: +(centurionFinancial.carbonOffset + parcDuCapFinancial.carbonOffset).toFixed(1),
};

const allSitesHealth = {
  status: 'Optimal',
  uptime: +((centurionHealth.uptime + parcDuCapHealth.uptime) / 2).toFixed(1),
  lastMaintenance: '2024-03-10',
  nextMaintenance: '2024-05-15',
  alerts: [...centurionHealth.alerts, ...parcDuCapHealth.alerts],
};

const allSitesAllTime = {
  totalProduction: centurionAllTime.totalProduction + parcDuCapAllTime.totalProduction,
  totalConsumption: centurionAllTime.totalConsumption + parcDuCapAllTime.totalConsumption,
  totalEarnings: centurionAllTime.totalEarnings + parcDuCapAllTime.totalEarnings,
  totalCarbonOffset: +(centurionAllTime.totalCarbonOffset + parcDuCapAllTime.totalCarbonOffset).toFixed(1),
  systemAge: Math.max(centurionAllTime.systemAge, parcDuCapAllTime.systemAge),
  bestMonth: centurionAllTime.bestMonth.production > parcDuCapAllTime.bestMonth.production
    ? centurionAllTime.bestMonth : parcDuCapAllTime.bestMonth,
  bestDay: centurionAllTime.bestDay.production > parcDuCapAllTime.bestDay.production
    ? centurionAllTime.bestDay : parcDuCapAllTime.bestDay,
  avgDailyProduction: +(centurionAllTime.avgDailyProduction + parcDuCapAllTime.avgDailyProduction).toFixed(1),
  avgMonthlyCoverage: Math.round((centurionAllTime.avgMonthlyCoverage + parcDuCapAllTime.avgMonthlyCoverage) / 2),
  lifetimeRoi: Math.round((centurionAllTime.lifetimeRoi + parcDuCapAllTime.lifetimeRoi) / 2),
  peakPower: +(centurionAllTime.peakPower + parcDuCapAllTime.peakPower).toFixed(1),
};

/* ============================================
   SITE DATA LOOKUP
   ============================================ */
export interface SiteData {
  dailyData: typeof centurionDaily;
  currentMetrics: typeof centurionMetrics;
  financialMetrics: typeof centurionFinancial;
  systemHealth: typeof centurionHealth;
  hourlyData: typeof centurionHourly;
  monthlyDataByYear: Record<string, ReturnType<typeof generateMonthlyDataForSite>>;
  allTimeStats: typeof centurionAllTime;
}

const siteDataMap: Record<SiteId, SiteData> = {
  centurion: {
    dailyData: centurionDaily,
    currentMetrics: centurionMetrics,
    financialMetrics: centurionFinancial,
    systemHealth: centurionHealth,
    hourlyData: centurionHourly,
    monthlyDataByYear: centurionMonthlyByYear,
    allTimeStats: centurionAllTime,
  },
  'parc-du-cap': {
    dailyData: parcDuCapDaily,
    currentMetrics: parcDuCapMetrics,
    financialMetrics: parcDuCapFinancial,
    systemHealth: parcDuCapHealth,
    hourlyData: parcDuCapHourly,
    monthlyDataByYear: parcDuCapMonthlyByYear,
    allTimeStats: parcDuCapAllTime,
  },
  all: {
    dailyData: allSitesDaily,
    currentMetrics: allSitesMetrics,
    financialMetrics: allSitesFinancial,
    systemHealth: allSitesHealth,
    hourlyData: allSitesHourly,
    monthlyDataByYear: allSitesMonthlyByYear,
    allTimeStats: allSitesAllTime,
  },
};

export const getSiteData = (siteId: SiteId): SiteData => siteDataMap[siteId];

/* ============================================
   BACKWARD-COMPATIBLE DEFAULT EXPORTS
   (point to "all" combined data)
   ============================================ */
export const dailyData = allSitesDaily;
export const currentMetrics = allSitesMetrics;
export const financialMetrics = allSitesFinancial;
export const systemHealth = allSitesHealth;
export const hourlyData = allSitesHourly;
export const generateMonthlyData = (year: number) => generateMonthlyDataForSite(year, 2150, 2350, 2550, 0.18);
export const monthlyDataByYear = allSitesMonthlyByYear;
export const allTimeStats = allSitesAllTime;

/* ============================================
   MONTHLY TARIFF STATS (PV/BESS Included vs Excluded)
   ============================================ */
export interface TariffLineItem {
  label: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface TariffStats {
  monthKey: string;   // 'YYYY-MM'
  monthLabel: string; // 'May 2026'
  lineItems: TariffLineItem[];
  total: number;
}

export interface MonthlyTariffEntry {
  included: TariffStats;
  excluded: TariffStats;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Rates are fixed (tariff schedule)
const RATES = {
  access: 12.40,
  peak: 3.3396,     // 333.96 c/kWh
  standard: 2.1708, // 217.08 c/kWh
  offPeak: 1.7563,  // 175.63 c/kWh
  reactive: 0.1520,
  demand: 85.60,
  transmission: 0.1870,
};

const generateTariffForMonth = (year: number, monthIdx: number): MonthlyTariffEntry => {
  const days = DAYS_IN_MONTH[monthIdx];
  const monthLabel = `${MONTH_NAMES_FULL[monthIdx]} ${year}`;
  const monthKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;

  // Seasonal factor: summer (Dec-Feb) = higher solar -> lower included grid consumption
  const seasonFactor = 1 - 0.35 * Math.cos(((monthIdx - 5.5) / 12) * 2 * Math.PI);
  const seed = year * 100 + monthIdx;
  const rng = (offset: number) => 0.85 + 0.3 * Math.abs(Math.sin(seed + offset));

  // Included (with PV/BESS — lower grid draw)
  const inclPeak     = Math.round(900  * (1 - seasonFactor * 0.35) * rng(1));
  const inclStd      = Math.round(2200 * (1 - seasonFactor * 0.30) * rng(2));
  const inclOffPeak  = Math.round(1400 * (1 - seasonFactor * 0.20) * rng(3));
  const inclReactive = Math.round(320  * rng(4));
  const inclDemand   = Math.round((28 + rng(5) * 4) * 10) / 10;
  const inclTrans    = inclPeak + inclStd + inclOffPeak;

  const inclItems: TariffLineItem[] = [
    { label: 'Network Access Charge',  unit: 'day',   qty: days,        rate: RATES.access,       amount: Math.round(days * RATES.access * 100) / 100 },
    { label: 'Energy — Peak',          unit: 'kWh',   qty: inclPeak,    rate: RATES.peak,         amount: Math.round(inclPeak * RATES.peak * 100) / 100 },
    { label: 'Energy — Standard',      unit: 'kWh',   qty: inclStd,     rate: RATES.standard,     amount: Math.round(inclStd * RATES.standard * 100) / 100 },
    { label: 'Energy — Off-Peak',      unit: 'kWh',   qty: inclOffPeak, rate: RATES.offPeak,      amount: Math.round(inclOffPeak * RATES.offPeak * 100) / 100 },
    { label: 'Reactive Energy Charge', unit: 'kVArh', qty: inclReactive, rate: RATES.reactive,    amount: Math.round(inclReactive * RATES.reactive * 100) / 100 },
    { label: 'Demand Charge',          unit: 'kVA',   qty: inclDemand,  rate: RATES.demand,       amount: Math.round(inclDemand * RATES.demand * 100) / 100 },
    { label: 'Transmission Network',   unit: 'kWh',   qty: inclTrans,   rate: RATES.transmission, amount: Math.round(inclTrans * RATES.transmission * 100) / 100 },
  ];
  const inclTotal = Math.round(inclItems.reduce((s, i) => s + i.amount, 0) * 100) / 100;

  // Excluded (without PV/BESS — full grid draw, ~2.4x higher consumption)
  const exclPeak     = Math.round(inclPeak     * 2.6 * rng(6));
  const exclStd      = Math.round(inclStd      * 2.2 * rng(7));
  const exclOffPeak  = Math.round(inclOffPeak  * 1.9 * rng(8));
  const exclReactive = Math.round(inclReactive * 2.1 * rng(9));
  const exclDemand   = Math.round((inclDemand  * 1.85 + rng(10) * 3) * 10) / 10;
  const exclTrans    = exclPeak + exclStd + exclOffPeak;

  const exclItems: TariffLineItem[] = [
    { label: 'Network Access Charge',  unit: 'day',   qty: days,        rate: RATES.access,       amount: Math.round(days * RATES.access * 100) / 100 },
    { label: 'Energy — Peak',          unit: 'kWh',   qty: exclPeak,    rate: RATES.peak,         amount: Math.round(exclPeak * RATES.peak * 100) / 100 },
    { label: 'Energy — Standard',      unit: 'kWh',   qty: exclStd,     rate: RATES.standard,     amount: Math.round(exclStd * RATES.standard * 100) / 100 },
    { label: 'Energy — Off-Peak',      unit: 'kWh',   qty: exclOffPeak, rate: RATES.offPeak,      amount: Math.round(exclOffPeak * RATES.offPeak * 100) / 100 },
    { label: 'Reactive Energy Charge', unit: 'kVArh', qty: exclReactive, rate: RATES.reactive,    amount: Math.round(exclReactive * RATES.reactive * 100) / 100 },
    { label: 'Demand Charge',          unit: 'kVA',   qty: exclDemand,  rate: RATES.demand,       amount: Math.round(exclDemand * RATES.demand * 100) / 100 },
    { label: 'Transmission Network',   unit: 'kWh',   qty: exclTrans,   rate: RATES.transmission, amount: Math.round(exclTrans * RATES.transmission * 100) / 100 },
  ];
  const exclTotal = Math.round(exclItems.reduce((s, i) => s + i.amount, 0) * 100) / 100;

  return {
    included: { monthKey, monthLabel, lineItems: inclItems, total: inclTotal },
    excluded: { monthKey, monthLabel, lineItems: exclItems, total: exclTotal },
  };
};

// Generate last 12 completed months for signed-out/mock tariff views.
const buildMonthlyTariffData = (): Record<string, MonthlyTariffEntry> => {
  const result: Record<string, MonthlyTariffEntry> = {};
  const now = new Date();
  const endMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(endMonth.getFullYear(), endMonth.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    result[key] = generateTariffForMonth(d.getFullYear(), d.getMonth());
  }
  return result;
};

export const monthlyTariffData: Record<string, MonthlyTariffEntry> = buildMonthlyTariffData();

// Keep legacy named exports pointing at March 2026
export const marchTariffIncluded = monthlyTariffData['2026-03'].included;
export const marchTariffExcluded = monthlyTariffData['2026-03'].excluded;