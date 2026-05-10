import React, { useState } from 'react';
import { FileText, Download, RefreshCw, AlertCircle, Lock, Calendar } from 'lucide-react';
import jsPDF from 'jspdf';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import {
  fetchMonthlyGridEnergyHourly,
  fetchMonthlyLoadEnergyHourly,
  fetchMonthlyPeakDemand,
  fetchDailyProduction,
} from '../api/higeco';
import {
  calculateTouCharges,
  calculateDemandCharge,
  DEFAULT_TOU_RATES,
  DEFAULT_DEMAND_RATE_PER_KVA,
  SERVICE_CHARGE_EXCL_VAT,
  SERVICE_CHARGE_INCL_VAT,
} from '../api/tou';
import type { TouBreakdown, DemandBreakdown } from '../api/tou';
import targets from '../data/targets.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthLabel(key: string) {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

function fmtR(n: number) {
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtKwh(n: number) {
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// ---------------------------------------------------------------------------
// Available month keys (current month and earlier, same list as TariffStatsCard)
// ---------------------------------------------------------------------------

function buildMonthKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let y = 2025; y <= now.getFullYear(); y++) {
    const maxM = y === now.getFullYear() ? now.getMonth() + 1 : 12;
    for (let m = 1; m <= maxM; m++) {
      keys.push(`${y}-${String(m).padStart(2, '0')}`);
    }
  }
  return keys;
}

const MONTH_KEYS = buildMonthKeys();
const DEFAULT_KEY = MONTH_KEYS[MONTH_KEYS.length - 1];

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------

interface ReportData {
  monthKey: string;
  siteId: 'parc-du-cap' | 'centurion';
  siteLabel: string;
  included: TouBreakdown;
  excluded: TouBreakdown | null;
  demand: DemandBreakdown | null;
  solarGenerationKwh: number;
  targetKwh: number;
}

function generatePdf(data: ReportData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 18;
  const contentW = pageW - margin * 2;

  const month = data.monthKey;
  const label = monthLabel(month);
  const generatedAt = new Date().toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // Colours
  const GREEN  = [16, 185, 129] as const;
  const RED    = [239, 68, 68] as const;
  const AMBER  = [245, 158, 11] as const;
  const BLUE   = [59, 130, 246] as const;
  const DARK   = [17, 24, 39] as const;
  const GREY   = [107, 114, 128] as const;
  const BORDER = [229, 231, 235] as const;
  const BG_LIGHT = [249, 250, 251] as const;

  let y = 0;

  // ── HEADER BAR ──────────────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('MOMENTUM GROUP', margin, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Solar Intelligence Platform', margin, 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('MONTHLY ENERGY REPORT', pageW - margin, 11, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${label}  |  ${data.siteLabel}`, pageW - margin, 17, { align: 'right' });
  doc.text(`Generated: ${generatedAt}`, pageW - margin, 22, { align: 'right' });

  y = 38;

  // ── SECTION HEADING helper ───────────────────────────────────────────────
  const section = (title: string) => {
    doc.setFillColor(...GREEN);
    doc.rect(margin, y, 3, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(title, margin + 6, y + 4.5);
    y += 10;
  };

  // ── KPI TILE helper ──────────────────────────────────────────────────────
  const kpiTile = (x: number, tileW: number, label: string, value: string, sub: string, color: readonly [number, number, number]) => {
    doc.setFillColor(...BG_LIGHT);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, y, tileW, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...GREY);
    doc.text(label.toUpperCase(), x + 5, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...color);
    doc.text(value, x + 5, y + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...GREY);
    doc.text(sub, x + 5, y + 20);
  };

  // ── TABLE helpers ────────────────────────────────────────────────────────
  const tableHeader = (cols: Array<{ label: string; x: number; align: 'left' | 'right' }>) => {
    doc.setFillColor(...DARK);
    doc.rect(margin, y, contentW, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    for (const col of cols) {
      doc.text(col.label, col.x, y + 4.8, { align: col.align });
    }
    y += 7;
  };

  const tableRow = (
    cols: Array<{ text: string; x: number; align: 'left' | 'right'; bold?: boolean; color?: readonly [number, number, number] }>,
    shade: boolean,
  ) => {
    if (shade) {
      doc.setFillColor(...BG_LIGHT);
      doc.rect(margin, y, contentW, 7, 'F');
    }
    doc.setDrawColor(...BORDER);
    doc.line(margin, y + 7, margin + contentW, y + 7);
    doc.setFontSize(7.5);
    for (const col of cols) {
      doc.setFont('helvetica', col.bold ? 'bold' : 'normal');
      doc.setTextColor(...(col.color ?? DARK));
      doc.text(col.text, col.x, y + 4.8, { align: col.align });
    }
    y += 7;
  };

  const totalRow = (label: string, kwh: string, charge: string) => {
    doc.setFillColor(...DARK);
    doc.rect(margin, y, contentW, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...GREEN);
    doc.text(label, margin + 4, y + 5.5);
    doc.setTextColor(255, 255, 255);
    if (kwh) doc.text(kwh, margin + contentW - 58, y + 5.5, { align: 'right' });
    doc.setTextColor(...GREEN);
    doc.text(charge, margin + contentW - 2, y + 5.5, { align: 'right' });
    y += 8;
  };

  // ── DERIVED VALUES ───────────────────────────────────────────────────────
  const demandCharge = data.demand?.demandCharge ?? 0;
  const inclTotal = r2(data.included.totalCharge + demandCharge + SERVICE_CHARGE_EXCL_VAT);
  const exclTotal = data.excluded ? r2(data.excluded.totalCharge + demandCharge + SERVICE_CHARGE_EXCL_VAT) : null;
  const totalSavings = exclTotal != null ? r2(exclTotal - inclTotal) : null;
  const savingsPct = exclTotal && exclTotal > 0 ? ((totalSavings! / exclTotal) * 100) : null;

  const totalLoad = data.excluded?.totalEnergyKwh ?? 0;
  const gridImport = data.included.totalEnergyKwh;
  const selfSupplyKwh = Math.max(0, totalLoad - gridImport);
  const selfSupplyPct = totalLoad > 0 ? (selfSupplyKwh / totalLoad) * 100 : 0;

  const targetAchievePct = data.targetKwh > 0 ? (data.solarGenerationKwh / data.targetKwh) * 100 : null;

  // ── SECTION 1: Executive Summary ─────────────────────────────────────────
  section('Executive Summary');

  const tileW = (contentW - 9) / 4;
  kpiTile(margin,                     tileW, 'Grid Import',      `${fmtKwh(gridImport)} kWh`, 'energy drawn from grid', DARK);
  kpiTile(margin + tileW + 3,         tileW, 'Self-Supply',      `${selfSupplyPct.toFixed(1)}%`, `${fmtKwh(selfSupplyKwh)} kWh via PV/BESS`, BLUE);
  kpiTile(margin + (tileW + 3) * 2,   tileW, 'Bill (with PV)',   fmtR(inclTotal), 'excl. VAT', GREEN);
  kpiTile(margin + (tileW + 3) * 3,   tileW,
    totalSavings != null ? 'Bill Saving' : 'Demand Peak',
    totalSavings != null ? fmtR(totalSavings) : (data.demand ? `${data.demand.peakKva} kVA` : '—'),
    totalSavings != null ? `${savingsPct!.toFixed(1)}% of grid-only bill` : 'peak apparent power',
    totalSavings != null ? GREEN : AMBER,
  );

  y += 26;

  // Solar target row
  if (data.solarGenerationKwh > 0 || data.targetKwh > 0) {
    doc.setFillColor(...BG_LIGHT);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(margin, y, contentW, 14, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...DARK);
    doc.text('Solar Generation vs Target', margin + 5, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(`Actual: ${fmtKwh(data.solarGenerationKwh)} kWh   Target: ${fmtKwh(data.targetKwh)} kWh`, margin + 5, y + 11);
    if (targetAchievePct != null) {
      const pctColor = (targetAchievePct >= 95 ? GREEN : targetAchievePct >= 80 ? AMBER : RED) as [number, number, number];
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...pctColor);
      doc.text(`${targetAchievePct.toFixed(1)}% of target`, pageW - margin - 5, y + 8.5, { align: 'right' });
    }
    y += 20;
  } else {
    y += 4;
  }

  // ── SECTION 2: TOU Billing — With PV/BESS ───────────────────────────────
  section('TOU Billing — With PV/BESS (Grid Import)');

  const cols = [
    { label: 'TOU Period',     x: margin + 4,              align: 'left'  as const },
    { label: 'Energy (kWh)',   x: margin + contentW - 90,  align: 'right' as const },
    { label: 'Rate (R/kWh)',   x: margin + contentW - 58,  align: 'right' as const },
    { label: 'Charge (R)',     x: margin + contentW - 2,   align: 'right' as const },
  ];
  tableHeader(cols);

  const inclRows = [
    { label: 'Energy — Peak',     kwh: data.included.peakKwh,     rate: DEFAULT_TOU_RATES.peak,     charge: data.included.peakCharge,     color: RED },
    { label: 'Energy — Standard', kwh: data.included.standardKwh, rate: DEFAULT_TOU_RATES.standard, charge: data.included.standardCharge, color: AMBER },
    { label: 'Energy — Off-Peak', kwh: data.included.offpeakKwh,  rate: DEFAULT_TOU_RATES.offpeak,  charge: data.included.offpeakCharge,  color: BLUE },
  ];
  inclRows.forEach((row, i) => tableRow([
    { text: row.label,                      x: margin + 4,              align: 'left',  bold: true, color: row.color },
    { text: `${fmtKwh(row.kwh)}`,           x: margin + contentW - 90,  align: 'right' },
    { text: row.rate.toFixed(4),            x: margin + contentW - 58,  align: 'right' },
    { text: row.charge.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + contentW - 2, align: 'right', bold: true },
  ], i % 2 === 1));

  if (data.demand) {
    tableRow([
      { text: 'Demand',              x: margin + 4,              align: 'left',  bold: true },
      { text: `${data.demand.peakKva.toFixed(1)} kVA`, x: margin + contentW - 90, align: 'right' },
      { text: DEFAULT_DEMAND_RATE_PER_KVA.toFixed(4), x: margin + contentW - 58,  align: 'right' },
      { text: data.demand.demandCharge.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + contentW - 2, align: 'right', bold: true },
    ], false);
  }
  tableRow([
    { text: 'Monthly Service Charge', x: margin + 4,             align: 'left',  bold: true },
    { text: '1 month',                x: margin + contentW - 90, align: 'right' },
    { text: 'fixed',                  x: margin + contentW - 58, align: 'right' },
    { text: SERVICE_CHARGE_EXCL_VAT.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + contentW - 2, align: 'right', bold: true },
  ], true);

  totalRow(
    'TOTAL (excl. VAT)',
    `${fmtKwh(data.included.totalEnergyKwh)} kWh`,
    fmtR(inclTotal),
  );

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(...GREY);
  doc.text(`VAT (15%): ${fmtR(r2(inclTotal * 0.15))}   Total incl. VAT: ${fmtR(r2(inclTotal * 1.15))}   (Service charge VAT: ${fmtR(SERVICE_CHARGE_INCL_VAT - SERVICE_CHARGE_EXCL_VAT)})`, margin, y + 4);
  y += 10;

  // ── SECTION 3: TOU Billing — Without PV/BESS ────────────────────────────
  if (data.excluded) {
    section('TOU Billing — Without PV/BESS (Total Load)');
    tableHeader(cols);

    const exclRows = [
      { label: 'Energy — Peak',     kwh: data.excluded.peakKwh,     rate: DEFAULT_TOU_RATES.peak,     charge: data.excluded.peakCharge,     color: RED },
      { label: 'Energy — Standard', kwh: data.excluded.standardKwh, rate: DEFAULT_TOU_RATES.standard, charge: data.excluded.standardCharge, color: AMBER },
      { label: 'Energy — Off-Peak', kwh: data.excluded.offpeakKwh,  rate: DEFAULT_TOU_RATES.offpeak,  charge: data.excluded.offpeakCharge,  color: BLUE },
    ];
    exclRows.forEach((row, i) => tableRow([
      { text: row.label,                      x: margin + 4,              align: 'left',  bold: true, color: row.color },
      { text: `${fmtKwh(row.kwh)}`,           x: margin + contentW - 90,  align: 'right' },
      { text: row.rate.toFixed(4),            x: margin + contentW - 58,  align: 'right' },
      { text: row.charge.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + contentW - 2, align: 'right', bold: true },
    ], i % 2 === 1));

    if (data.demand) {
      tableRow([
        { text: 'Demand',              x: margin + 4,              align: 'left',  bold: true },
        { text: `${data.demand.peakKva.toFixed(1)} kVA`, x: margin + contentW - 90, align: 'right' },
        { text: DEFAULT_DEMAND_RATE_PER_KVA.toFixed(4),  x: margin + contentW - 58, align: 'right' },
        { text: data.demand.demandCharge.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + contentW - 2, align: 'right', bold: true },
      ], false);
    }
    tableRow([
      { text: 'Monthly Service Charge', x: margin + 4,             align: 'left',  bold: true },
      { text: '1 month',                x: margin + contentW - 90, align: 'right' },
      { text: 'fixed',                  x: margin + contentW - 58, align: 'right' },
      { text: SERVICE_CHARGE_EXCL_VAT.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + contentW - 2, align: 'right', bold: true },
    ], true);

    totalRow(
      'TOTAL (excl. VAT)',
      `${fmtKwh(data.excluded.totalEnergyKwh)} kWh`,
      fmtR(exclTotal!),
    );

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(...GREY);
    doc.text(`VAT (15%): ${fmtR(r2(exclTotal! * 0.15))}   Total incl. VAT: ${fmtR(r2(exclTotal! * 1.15))}`, margin, y + 4);
    y += 10;
  }

  // ── SECTION 4: Savings Analysis ──────────────────────────────────────────
  if (data.excluded && totalSavings != null) {
    section('PV/BESS Savings Analysis');

    const periods = [
      { label: 'Peak',      exclC: data.excluded.peakCharge,     inclC: data.included.peakCharge,     exclK: data.excluded.peakKwh,     inclK: data.included.peakKwh },
      { label: 'Standard',  exclC: data.excluded.standardCharge, inclC: data.included.standardCharge, exclK: data.excluded.standardKwh, inclK: data.included.standardKwh },
      { label: 'Off-Peak',  exclC: data.excluded.offpeakCharge,  inclC: data.included.offpeakCharge,  exclK: data.excluded.offpeakKwh,  inclK: data.included.offpeakKwh },
    ].map(p => ({ ...p, saved: r2(p.exclC - p.inclC), kwhAvoided: r2(p.exclK - p.inclK) }));

    const savCols = [
      { label: 'Period',           x: margin + 4,              align: 'left'  as const },
      { label: 'kWh Avoided',      x: margin + contentW - 116, align: 'right' as const },
      { label: 'Grid-only (R)',    x: margin + contentW - 78,  align: 'right' as const },
      { label: 'With PV/BESS (R)', x: margin + contentW - 38,  align: 'right' as const },
      { label: 'Saved (R)',        x: margin + contentW - 2,   align: 'right' as const },
    ];
    tableHeader(savCols);

    const periodColors: [number, number, number][] = [RED as [number,number,number], AMBER as [number,number,number], BLUE as [number,number,number]];
    periods.forEach((p, i) => tableRow([
      { text: p.label, x: margin + 4,              align: 'left',  bold: true, color: periodColors[i] },
      { text: `${fmtKwh(p.kwhAvoided)} kWh`, x: margin + contentW - 116, align: 'right' },
      { text: p.exclC.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + contentW - 78, align: 'right' },
      { text: p.inclC.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + contentW - 38, align: 'right' },
      { text: p.saved.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + contentW - 2,  align: 'right', bold: true, color: p.saved >= 0 ? GREEN : RED },
    ], i % 2 === 1));

    const energySavings = r2(periods.reduce((s, p) => s + p.saved, 0));
    totalRow('ENERGY SAVINGS', '', fmtR(energySavings));

    // Summary box
    y += 4;
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(...GREEN);
    doc.roundedRect(margin, y, contentW, 18, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text('Total Bill Saving (energy only, same demand + service both scenarios):', margin + 5, y + 6);
    doc.setFontSize(13);
    doc.setTextColor(...GREEN);
    doc.text(fmtR(totalSavings), margin + 5, y + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text(`${savingsPct!.toFixed(1)}% reduction vs grid-only bill`, margin + contentW - 5, y + 10, { align: 'right' });
    doc.setFontSize(7);
    doc.text(`Self-supply: ${selfSupplyPct.toFixed(1)}%  (${fmtKwh(selfSupplyKwh)} kWh of ${fmtKwh(totalLoad)} kWh total load)`, margin + contentW - 5, y + 15, { align: 'right' });
    y += 24;
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────
  const pageH = 297;
  doc.setDrawColor(...BORDER);
  doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...GREY);
  doc.text('City of Cape Town 2025/26 MV TOU — Low Demand season rates applied. Charges exclude VAT unless stated.', margin, pageH - 9);
  doc.text(`Momentum Group  |  ${data.siteLabel}  |  ${label}`, pageW - margin, pageH - 9, { align: 'right' });

  doc.save(`Energy-Report_${data.siteLabel.replace(/\s+/g, '-')}_${month}.pdf`);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const EnergyReportTab: React.FC = () => {
  const { user } = useAuth();
  const { siteId, siteLabel } = useSite();

  const [selectedKey, setSelectedKey] = useState(DEFAULT_KEY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<ReportData | null>(null);

  const canFetch = !!user?.token && (siteId === 'parc-du-cap' || siteId === 'centurion');

  const handleGenerate = async () => {
    if (!canFetch || !user?.token) return;

    const [yearStr, monthStr] = selectedKey.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const site = siteId as 'parc-du-cap' | 'centurion';
    const daysCount = daysInMonth(year, month);
    const startDate = selectedKey + '-01';
    const lastDay = String(daysCount).padStart(2, '0');
    const endDate = `${yearStr}-${monthStr}-${lastDay}`;

    // Retrieve monthly target from targets.json
    const siteTargets = (targets as Record<string, Record<string, number>>)[site] ?? {};
    const targetKwh = siteTargets[selectedKey] ?? 0;

    setLoading(true);
    setError(null);
    setLastReport(null);

    try {
      const [hourlyGrid, peakKva, loadPoints, dailyProd] = await Promise.all([
        fetchMonthlyGridEnergyHourly(user.token, year, month, site),
        fetchMonthlyPeakDemand(user.token, year, month, site).catch(() => null),
        fetchMonthlyLoadEnergyHourly(user.token, year, month, site).catch(() => null),
        fetchDailyProduction(user.token, daysCount, site, { startDate, endDate }).catch(() => null),
      ]);

      const included = calculateTouCharges(hourlyGrid);
      const excluded = loadPoints ? calculateTouCharges(loadPoints) : null;
      const demand = peakKva != null ? calculateDemandCharge(peakKva) : null;
      const solarGenerationKwh = dailyProd
        ? Math.round(dailyProd.reduce((s, d) => s + d.productionKwh, 0) * 10) / 10
        : 0;

      const reportData: ReportData = {
        monthKey: selectedKey,
        siteId: site,
        siteLabel,
        included,
        excluded,
        demand,
        solarGenerationKwh,
        targetKwh,
      };

      setLastReport(reportData);
      generatePdf(reportData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  };

  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 780, margin: '0 auto', paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
          Reports
        </p>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.35rem' }}>
          Monthly Energy Report
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
          Generate a PDF report with full TOU billing breakdown, PV/BESS savings analysis, and solar generation vs target.
        </p>
      </div>

      {/* Config card */}
      <div className="chart-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>

          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Report Month
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px' }}>
              <Calendar size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', flex: 1 }}
              >
                {[...MONTH_KEYS].reverse().map((k) => (
                  <option key={k} value={k}>{monthLabel(k)}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Site
            </label>
            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              {siteLabel}
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canFetch || loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '9px 20px', borderRadius: 7, border: 'none', cursor: canFetch && !loading ? 'pointer' : 'not-allowed',
              background: canFetch ? 'var(--success)' : 'var(--border)',
              color: canFetch ? '#fff' : 'var(--text-secondary)',
              fontWeight: 700, fontSize: '0.85rem', opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {loading
              ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Fetching data…</>
              : <><Download size={14} /> Generate &amp; Download PDF</>
            }
          </button>
        </div>

        {!canFetch && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', padding: '0.6rem 0.9rem', borderRadius: 6, background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 600 }}>
            <Lock size={13} /> Sign in and select a configured site (Parc du Cap or Centurion) to generate reports.
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', padding: '0.6rem 0.9rem', borderRadius: 6, background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', fontSize: '0.78rem' }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}
      </div>

      {/* What's included info */}
      <div className="chart-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <FileText size={15} style={{ color: 'var(--success)' }} />
          Report Contents
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 2rem' }}>
          {[
            'Executive summary KPIs',
            'Solar generation vs monthly target',
            'TOU billing — with PV/BESS (grid import)',
            'TOU billing — without PV/BESS (total load)',
            'Peak demand charge (kVA)',
            'Monthly service charge',
            'PV/BESS savings by TOU period',
            'Total bill saving & self-supply rate',
          ].map((item) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
              {item}
            </div>
          ))}
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.85rem', marginBottom: 0 }}>
          Rates: City of Cape Town 2025/26 MV TOU — Low Demand season. All charges exclude VAT unless stated. PDF includes VAT reconciliation line.
        </p>
      </div>

      {/* Last report summary (if generated this session) */}
      {lastReport && !loading && (
        <div className="chart-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', margin: '0 0 0.75rem' }}>
            Last Generated — {monthLabel(lastReport.monthKey)}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {[
              { label: 'Grid Import', value: `${fmtKwh(lastReport.included.totalEnergyKwh)} kWh` },
              { label: 'Bill (with PV)', value: fmtR(r2(lastReport.included.totalCharge + (lastReport.demand?.demandCharge ?? 0) + SERVICE_CHARGE_EXCL_VAT)) },
              { label: 'Bill Saving', value: lastReport.excluded ? fmtR(r2((lastReport.excluded.totalCharge - lastReport.included.totalCharge))) : '—' },
            ].map((kpi) => (
              <div key={kpi.label} style={{ background: 'var(--bg-main)', borderRadius: 7, padding: '0.7rem 0.9rem' }}>
                <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-secondary)', margin: '0 0 0.3rem' }}>{kpi.label}</p>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--success)', margin: 0 }}>{kpi.value}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => generatePdf(lastReport)}
            style={{ marginTop: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--success)', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}
          >
            <Download size={13} /> Re-download PDF
          </button>
        </div>
      )}
    </div>
  );
};

export default EnergyReportTab;
