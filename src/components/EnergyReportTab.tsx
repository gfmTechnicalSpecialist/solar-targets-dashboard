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
  fetchMonthlyPowerFlow,
  fetchMonthlyIrradiance,
} from '../api/higeco';
import type { PowerFlowPoint } from '../api/higeco';
import {
  calculateTouCharges,
  calculateDemandCharge,
  getTouConfig,
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
  // Exclude the current (incomplete) month — stop at the previous completed month
  const maxYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const maxMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // getMonth() is 0-based, so this gives last month
  for (let y = 2025; y <= maxYear; y++) {
    const mLimit = y === maxYear ? maxMonth : 12;
    for (let m = 1; m <= mLimit; m++) {
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
  /** 30-min power-flow data — PDC only */
  powerFlow: PowerFlowPoint[] | null;
  /** Total measured GHI for the month (Wh/m²) — weather sensor */
  measuredGhiWhM2: number | null;
}

// ---------------------------------------------------------------------------
// Power-flow chart — drawn onto an offscreen canvas, embedded as PNG
// ---------------------------------------------------------------------------

interface WeekChartResult {
  dataUrl: string;
  weekLabel: string;
  /** canvas pixel width (always 1800) */
  width: number;
  /** canvas pixel height */
  height: number;
}

function drawPowerFlowCharts(
  points: PowerFlowPoint[],
  monthLabel: string,
): WeekChartResult[] {
  const MO_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Drawing order matters: filled areas first, lines on top
  // fill: hex fill color (with alpha applied in code), or null for line-only
  const AREA_SERIES = [
    { key: 'gridKw'  as const, color: '#ef4444', fill: 'rgba(239,68,68,0.25)',    lbl: 'Grid (kW)', glow: false },
    { key: 'pvKw'   as const, color: '#f97316', fill: 'rgba(249,115,22,0.22)',   lbl: 'PV (kW)',   glow: true  },
  ] as const;

  const LINE_SERIES = [
    { key: 'loadKw'  as const, color: '#111827', lbl: 'Load (kW)',  lineWidth: 2.5, dash: [] as number[],      glow: true  },
    { key: 'bessKw'  as const, color: '#2563eb', lbl: 'BESS (kW)', lineWidth: 2.0, dash: [] as number[],      glow: false },
    { key: 'gridKva' as const, color: '#dc2626', lbl: 'Grid (kVA)',lineWidth: 3.5, dash: [10, 6] as number[], glow: false },
  ] as const;

  // ── Group by Mon-start week (SAST) ───────────────────────────────────────
  const weekMap = new Map<string, PowerFlowPoint[]>();
  for (const p of points) {
    const d   = new Date(p.timestamp * 1000);
    const dow = d.getUTCDay();
    const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (dow + 6) % 7));
    const key = mon.toISOString().slice(0, 10);
    let arr = weekMap.get(key);
    if (!arr) { arr = []; weekMap.set(key, arr); }
    arr.push(p);
  }
  const weeks = [...weekMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // ── Per-week canvas constants ─────────────────────────────────────────────
  const CW       = 1800;
  const PAD_L    = 80;
  const PAD_R    = 30;
  const HEADER_H = 70;   // week label + legend
  const PANEL_H  = 420;  // chart area — tall for visible lines
  const XAXIS_H  = 52;   // day labels
  const CH       = HEADER_H + PANEL_H + XAXIS_H;
  const chartW   = CW - PAD_L - PAD_R;
  const chartTop = HEADER_H;

  const results: WeekChartResult[] = [];

  weeks.forEach(([weekKey, weekPoints], wi) => {
    const [wy, wm, wd] = weekKey.split('-').map(Number);
    const monDate = new Date(Date.UTC(wy, wm - 1, wd));
    const sunDate = new Date(monDate.getTime() + 6 * 86400000);
    const wLabel  = `Week ${wi + 1}  |  ${wd} ${MO_NAMES[wm - 1]} – ${sunDate.getUTCDate()} ${MO_NAMES[sunDate.getUTCMonth()]} ${sunDate.getUTCFullYear()}  (${monthLabel})`;

    const canvas = document.createElement('canvas');
    canvas.width  = CW;
    canvas.height = CH;
    const ctx = canvas.getContext('2d')!;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CW, CH);

    // Week label
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(wLabel, PAD_L, 28);

    // Legend (right-aligned): filled swatch for area series, line sample for line series
    const legendItems = [
      ...AREA_SERIES.map(s  => ({ lbl: s.lbl,  color: s.color,  fill: s.fill,  dash: [] as number[],   lineWidth: 2.5 })),
      ...LINE_SERIES.map(s  => ({ lbl: s.lbl,  color: s.color,  fill: null,    dash: [...s.dash],       lineWidth: s.lineWidth })),
    ];
    const LEG_ITEM_W = 195;
    legendItems.forEach((s, i) => {
      const lx = CW - PAD_R - (legendItems.length - i) * LEG_ITEM_W;
      ctx.save();
      if (s.fill) {
        // Filled rectangle swatch
        ctx.fillStyle = s.fill;
        ctx.fillRect(lx, 14, 36, 14);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(lx, 14, 36, 14);
      } else {
        // Line swatch
        ctx.strokeStyle = s.color;
        ctx.lineWidth   = s.lineWidth + 0.5;
        ctx.setLineDash(s.dash);
        ctx.beginPath();
        ctx.moveTo(lx, 22); ctx.lineTo(lx + 36, 22);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = '#111827';
      ctx.font      = 'bold 16px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(s.lbl, lx + 42, 27);
      ctx.restore();
    });

    // Divider line under header
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(PAD_L, HEADER_H - 8); ctx.lineTo(CW - PAD_R, HEADER_H - 8);
    ctx.stroke();

    if (weekPoints.length === 0) {
      ctx.fillStyle  = '#9ca3af';
      ctx.font       = '20px sans-serif';
      ctx.textAlign  = 'center';
      ctx.fillText('No data for this week', PAD_L + chartW / 2, chartTop + PANEL_H / 2);
      results.push({ dataUrl: canvas.toDataURL('image/png'), weekLabel: wLabel, width: CW, height: CH });
      return;
    }

    // Y range — include kVA values so the axis fits all series
    const allVals = weekPoints.flatMap(p => [p.pvKw, p.loadKw, p.bessKw, p.gridKw, p.gridKva]);
    const yMin = Math.floor(Math.min(0, ...allVals) / 50) * 50;
    const yMax = Math.ceil (Math.max(50, ...allVals) / 50) * 50;
    const yRange = yMax - yMin;

    const minTs   = weekPoints[0].timestamp;
    const maxTs   = weekPoints[weekPoints.length - 1].timestamp;
    const tsRange = Math.max(maxTs - minTs, 1);

    const toX = (ts: number) => PAD_L + ((ts - minTs) / tsRange) * chartW;
    const toY = (kw: number) => chartTop + PANEL_H - ((kw - yMin) / yRange) * PANEL_H;

    // Panel background + border
    ctx.fillStyle   = '#f9fafb';
    ctx.fillRect(PAD_L, chartTop, chartW, PANEL_H);
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth   = 1;
    ctx.strokeRect(PAD_L, chartTop, chartW, PANEL_H);

    // Horizontal grid lines + Y axis labels
    const yTicks = 6;
    for (let i = 0; i <= yTicks; i++) {
      const val = yMin + (i / yTicks) * yRange;
      const py  = toY(val);
      ctx.strokeStyle = val === 0 ? '#9ca3af' : '#e5e7eb';
      ctx.lineWidth   = val === 0 ? 1.5 : 0.8;
      ctx.setLineDash(val === 0 ? [8, 5] : []);
      ctx.beginPath();
      ctx.moveTo(PAD_L, py); ctx.lineTo(CW - PAD_R, py);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle  = '#6b7280';
      ctx.font       = '18px sans-serif';
      ctx.textAlign  = 'right';
      ctx.fillText(`${Math.round(val)}`, PAD_L - 8, py + 6);
    }

    // Y-axis unit label
    ctx.save();
    ctx.fillStyle  = '#9ca3af';
    ctx.font       = '16px sans-serif';
    ctx.textAlign  = 'center';
    ctx.translate(20, chartTop + PANEL_H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('kW', 0, 0);
    ctx.restore();

    // Vertical day separators + day labels
    const seenDays = new Set<string>();
    for (const p of weekPoints) {
      const d      = new Date(p.timestamp * 1000);
      const dayKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
      if (!seenDays.has(dayKey)) {
        seenDays.add(dayKey);
        const px = toX(p.timestamp);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth   = 0.8;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(px, chartTop); ctx.lineTo(px, chartTop + PANEL_H);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle  = '#374151';
        ctx.font       = '17px sans-serif';
        ctx.textAlign  = 'center';
        ctx.fillText(`${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()}`, px, chartTop + PANEL_H + 34);
      }
    }

    // Series — clip to panel bounds
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD_L, chartTop, chartW, PANEL_H);
    ctx.clip();

    // 1. Filled areas (Grid kW, then PV kW on top)
    for (const s of AREA_SERIES) {
      const zero = toY(0);
      ctx.beginPath();
      let first = true;
      for (const p of weekPoints) {
        const px = toX(p.timestamp);
        const py = toY(p[s.key]);
        if (first) { ctx.moveTo(px, zero); ctx.lineTo(px, py); first = false; }
        else        ctx.lineTo(px, py);
      }
      // Close back along the zero baseline
      const lastP = weekPoints[weekPoints.length - 1];
      ctx.lineTo(toX(lastP.timestamp), zero);
      ctx.closePath();
      ctx.fillStyle = s.fill;
      ctx.fill();
      // Border line on top of fill (with optional glow for PV)
      const drawLine = (pts: PowerFlowPoint[], keyName: 'gridKw' | 'pvKw' | 'loadKw' | 'bessKw' | 'gridKva') => {
        ctx.beginPath();
        let f = true;
        for (const p of pts) {
          const px = toX(p.timestamp);
          const py = toY(p[keyName]);
          if (f) { ctx.moveTo(px, py); f = false; }
          else    ctx.lineTo(px, py);
        }
      };

      if (s.glow) {
        // outer glow layer
        ctx.save();
        ctx.shadowColor = s.color;
        ctx.shadowBlur  = 18;
        ctx.strokeStyle = s.color;
        ctx.lineWidth   = 4.0;
        ctx.lineJoin    = 'round';
        ctx.globalAlpha = 0.45;
        drawLine(weekPoints, s.key);
        ctx.stroke();
        ctx.restore();
      }

      // Crisp top line
      drawLine(weekPoints, s.key);
      ctx.strokeStyle = s.color;
      ctx.lineWidth   = 2.2;
      ctx.lineJoin    = 'round';
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.stroke();
    }

    // 2. Solid / dashed lines (Load, BESS, Grid kVA)
    for (const s of LINE_SERIES) {
      if (s.glow) {
        // Glow pass
        ctx.save();
        ctx.shadowColor  = s.color;
        ctx.shadowBlur   = 16;
        ctx.strokeStyle  = s.color;
        ctx.lineWidth    = s.lineWidth + 2.5;
        ctx.lineJoin     = 'round';
        ctx.globalAlpha  = 0.35;
        ctx.setLineDash([...s.dash]);
        ctx.beginPath();
        let fg = true;
        for (const p of weekPoints) {
          const px = toX(p.timestamp);
          const py = toY(p[s.key]);
          if (fg) { ctx.moveTo(px, py); fg = false; }
          else     ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Crisp line
      ctx.strokeStyle  = s.color;
      ctx.lineWidth    = s.lineWidth;
      ctx.lineJoin     = 'round';
      ctx.globalAlpha  = 1;
      ctx.setLineDash([...s.dash]);
      ctx.beginPath();
      let first = true;
      for (const p of weekPoints) {
        const px = toX(p.timestamp);
        const py = toY(p[s.key]);
        if (first) { ctx.moveTo(px, py); first = false; }
        else        ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

    results.push({ dataUrl: canvas.toDataURL('image/png'), weekLabel: wLabel, width: CW, height: CH });
  });

  return results;
}

function generatePdf(data: ReportData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 14;
  const contentW = pageW - margin * 2;

  const month = data.monthKey;
  const label = monthLabel(month);
  const generatedAt = new Date().toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // Site-specific TOU rates for displayed rate columns
  const siteRates = getTouConfig(data.siteId).rates;

  // Colours
  const GREEN  = [16, 185, 129] as const;
  const RED    = [239, 68, 68] as const;
  const AMBER  = [245, 158, 11] as const;
  const BLUE   = [59, 130, 246] as const;
  const DARK   = [17, 24, 39] as const;
  const GREY   = [107, 114, 128] as const;
  const BORDER = [229, 231, 235] as const;
  const BG_LIGHT = [249, 250, 251] as const;

  const ROW_H = 6;   // table body row height
  const HDR_H = 6;   // table header height
  const TOT_H = 7;   // total row height

  let y = 0;

  // ── HEADER BAR ──────────────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MOMENTUM GROUP', margin, 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Solar Intelligence Platform', margin, 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('MONTHLY ENERGY REPORT', pageW - margin, 9, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`${label}  |  ${data.siteLabel}`, pageW - margin, 14, { align: 'right' });
  doc.text(`Generated: ${generatedAt}`, pageW - margin, 19, { align: 'right' });

  y = 28;

  // ── SECTION HEADING helper ───────────────────────────────────────────────
  const section = (title: string) => {
    doc.setFillColor(...GREEN);
    doc.rect(margin, y, 2.5, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text(title, margin + 5, y + 3.6);
    y += 8;
  };

  // ── KPI TILE helper ──────────────────────────────────────────────────────
  const kpiTile = (x: number, tileW: number, lbl: string, value: string, sub: string, color: readonly [number, number, number]) => {
    doc.setFillColor(...BG_LIGHT);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, y, tileW, 17, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...GREY);
    doc.text(lbl.toUpperCase(), x + 4, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...color);
    doc.text(value, x + 4, y + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...GREY);
    doc.text(sub, x + 4, y + 15.5);
  };

  // ── TABLE helpers ────────────────────────────────────────────────────────
  const tableHeader = (cols: Array<{ label: string; x: number; align: 'left' | 'right' }>) => {
    doc.setFillColor(...DARK);
    doc.rect(margin, y, contentW, HDR_H, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    for (const col of cols) {
      doc.text(col.label, col.x, y + 4.1, { align: col.align });
    }
    y += HDR_H;
  };

  const tableRow = (
    cols: Array<{ text: string; x: number; align: 'left' | 'right'; bold?: boolean; color?: readonly [number, number, number] }>,
    shade: boolean,
  ) => {
    if (shade) {
      doc.setFillColor(...BG_LIGHT);
      doc.rect(margin, y, contentW, ROW_H, 'F');
    }
    doc.setDrawColor(...BORDER);
    doc.line(margin, y + ROW_H, margin + contentW, y + ROW_H);
    doc.setFontSize(7);
    for (const col of cols) {
      doc.setFont('helvetica', col.bold ? 'bold' : 'normal');
      doc.setTextColor(...(col.color ?? DARK));
      doc.text(col.text, col.x, y + 4.1, { align: col.align });
    }
    y += ROW_H;
  };

  const totalRow = (lbl: string, kwh: string, charge: string) => {
    doc.setFillColor(...DARK);
    doc.rect(margin, y, contentW, TOT_H, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...GREEN);
    doc.text(lbl, margin + 3, y + 4.8);
    doc.setTextColor(255, 255, 255);
    if (kwh) doc.text(kwh, margin + contentW - 52, y + 4.8, { align: 'right' });
    doc.setTextColor(...GREEN);
    doc.text(charge, margin + contentW - 2, y + 4.8, { align: 'right' });
    y += TOT_H;
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

  const tileW = (contentW - 6) / 4;
  kpiTile(margin,                     tileW, 'Grid Import',    `${fmtKwh(gridImport)} kWh`,    'energy drawn from grid',           DARK);
  kpiTile(margin + tileW + 2,         tileW, 'Self-Supply',    `${selfSupplyPct.toFixed(1)}%`,  `${fmtKwh(selfSupplyKwh)} kWh via PV/BESS`, BLUE);
  kpiTile(margin + (tileW + 2) * 2,   tileW, 'Bill (with PV)', fmtR(inclTotal),                 'excl. VAT',                        GREEN);
  kpiTile(margin + (tileW + 2) * 3,   tileW,
    totalSavings != null ? 'Bill Saving' : 'Demand Peak',
    totalSavings != null ? fmtR(totalSavings) : (data.demand ? `${data.demand.peakKva} kVA` : '—'),
    totalSavings != null ? `${savingsPct!.toFixed(1)}% of grid-only bill` : 'peak apparent power',
    totalSavings != null ? GREEN : AMBER,
  );

  y += 19;

  // Solar target row (single compact line)
  if (data.solarGenerationKwh > 0 || data.targetKwh > 0) {
    doc.setFillColor(...BG_LIGHT);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(margin, y, contentW, 10, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...DARK);
    doc.text('Solar Generation vs Target', margin + 4, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...GREY);
    doc.text(`Actual: ${fmtKwh(data.solarGenerationKwh)} kWh   Target: ${fmtKwh(data.targetKwh)} kWh`, margin + 4, y + 8.2);
    if (targetAchievePct != null) {
      const pctColor = (targetAchievePct >= 95 ? GREEN : targetAchievePct >= 80 ? AMBER : RED) as [number, number, number];
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...pctColor);
      doc.text(`${targetAchievePct.toFixed(1)}% of target`, pageW - margin - 4, y + 6.5, { align: 'right' });
    }
    y += 14;
  } else {
    y += 3;
  }

  // ── BILLING TABLES SIDE BY SIDE ──────────────────────────────────────────
  // Render both billing tables in two columns to save vertical space
  if (data.excluded) {
    const halfW = (contentW - 4) / 2;
    const col2X = margin + halfW + 4;

    // Shared columns for both halves
    const mkCols = (ox: number, w: number) => [
      { label: 'Period',     x: ox + 3,          align: 'left'  as const },
      { label: 'kWh',        x: ox + w - 48,     align: 'right' as const },
      { label: 'Rate',       x: ox + w - 26,     align: 'right' as const },
      { label: 'Charge (R)', x: ox + w,          align: 'right' as const },
    ];

    // For a two-column table we need custom row renderers scoped to a half
    const halfHeader = (ox: number, w: number, title: string) => {
      // Title bar above header
      doc.setFillColor(...DARK);
      doc.rect(ox, y, w, 5.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(255, 255, 255);
      doc.text(title, ox + 3, y + 3.9);
    };

    const halfColHeader = (ox: number, w: number) => {
      const cols = mkCols(ox, w);
      doc.setFillColor(40, 55, 80);
      doc.rect(ox, y, w, HDR_H - 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(200, 210, 220);
      for (const col of cols) {
        doc.text(col.label, col.x, y + 3.8, { align: col.align });
      }
    };

    const halfRow = (
      ox: number, w: number,
      cells: Array<{ text: string; x: number; align: 'left' | 'right'; bold?: boolean; color?: readonly [number, number, number] }>,
      shade: boolean,
    ) => {
      if (shade) { doc.setFillColor(...BG_LIGHT); doc.rect(ox, y, w, ROW_H, 'F'); }
      doc.setDrawColor(...BORDER);
      doc.line(ox, y + ROW_H, ox + w, y + ROW_H);
      doc.setFontSize(6.5);
      for (const col of cells) {
        doc.setFont('helvetica', col.bold ? 'bold' : 'normal');
        doc.setTextColor(...(col.color ?? DARK));
        doc.text(col.text, col.x, y + 4.1, { align: col.align });
      }
    };

    const halfTotal = (ox: number, w: number, kwh: string, charge: string) => {
      doc.setFillColor(...DARK);
      doc.rect(ox, y, w, TOT_H, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      if (kwh) doc.text(kwh, ox + w - 48, y + 4.8, { align: 'right' });
      doc.setTextColor(...GREEN);
      doc.text(charge, ox + w, y + 4.8, { align: 'right' });
    };

    // Snapshot y so both columns start at the same point
    const yStart = y;

    // ── LEFT: With PV/BESS ────────────────────────────────────────────────
    halfHeader(margin, halfW, 'With PV/BESS — Grid Import');
    const yAfterTitleL = y + 5.5;
    y = yAfterTitleL;
    halfColHeader(margin, halfW);
    y += HDR_H - 1;

    const inclRows = [
      { label: 'Peak',     kwh: data.included.peakKwh,     charge: data.included.peakCharge,     color: RED },
      { label: 'Standard', kwh: data.included.standardKwh, charge: data.included.standardCharge, color: AMBER },
      { label: 'Off-Peak', kwh: data.included.offpeakKwh,  charge: data.included.offpeakCharge,  color: BLUE },
    ];
    inclRows.forEach((row, i) => {
      halfRow(margin, halfW, [
        { text: row.label, x: margin + 3, align: 'left', bold: true, color: row.color },
        { text: fmtKwh(row.kwh), x: margin + halfW - 48, align: 'right' },
        { text: siteRates[row.label.toLowerCase().replace('-', '') as 'peak' | 'standard' | 'offpeak']?.toFixed(4) ?? '', x: margin + halfW - 26, align: 'right' },
        { text: row.charge.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + halfW, align: 'right', bold: true },
      ], i % 2 === 1);
      y += ROW_H;
    });
    if (data.demand) {
      halfRow(margin, halfW, [
        { text: 'Demand', x: margin + 3, align: 'left', bold: true },
        { text: `${data.demand.peakKva.toFixed(1)} kVA`, x: margin + halfW - 48, align: 'right' },
        { text: DEFAULT_DEMAND_RATE_PER_KVA.toFixed(2), x: margin + halfW - 26, align: 'right' },
        { text: data.demand.demandCharge.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + halfW, align: 'right', bold: true },
      ], false);
      y += ROW_H;
    }
    halfRow(margin, halfW, [
      { text: 'Service', x: margin + 3, align: 'left', bold: true },
      { text: '1 month', x: margin + halfW - 48, align: 'right' },
      { text: 'fixed', x: margin + halfW - 26, align: 'right' },
      { text: SERVICE_CHARGE_EXCL_VAT.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + halfW, align: 'right', bold: true },
    ], true);
    y += ROW_H;
    halfTotal(margin, halfW, `${fmtKwh(data.included.totalEnergyKwh)} kWh`, fmtR(inclTotal));
    const yAfterL = y + TOT_H;

    // ── RIGHT: Without PV/BESS ────────────────────────────────────────────
    y = yStart;
    halfHeader(col2X, halfW, 'Without PV/BESS — Total Load');
    y = yAfterTitleL;
    halfColHeader(col2X, halfW);
    y += HDR_H - 1;

    const exclRowsData = [
      { label: 'Peak',     kwh: data.excluded.peakKwh,     charge: data.excluded.peakCharge,     color: RED },
      { label: 'Standard', kwh: data.excluded.standardKwh, charge: data.excluded.standardCharge, color: AMBER },
      { label: 'Off-Peak', kwh: data.excluded.offpeakKwh,  charge: data.excluded.offpeakCharge,  color: BLUE },
    ];
    exclRowsData.forEach((row, i) => {
      halfRow(col2X, halfW, [
        { text: row.label, x: col2X + 3, align: 'left', bold: true, color: row.color },
        { text: fmtKwh(row.kwh), x: col2X + halfW - 48, align: 'right' },
        { text: siteRates[row.label.toLowerCase().replace('-', '') as 'peak' | 'standard' | 'offpeak']?.toFixed(4) ?? '', x: col2X + halfW - 26, align: 'right' },
        { text: row.charge.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: col2X + halfW, align: 'right', bold: true },
      ], i % 2 === 1);
      y += ROW_H;
    });
    if (data.demand) {
      halfRow(col2X, halfW, [
        { text: 'Demand', x: col2X + 3, align: 'left', bold: true },
        { text: `${data.demand.peakKva.toFixed(1)} kVA`, x: col2X + halfW - 48, align: 'right' },
        { text: DEFAULT_DEMAND_RATE_PER_KVA.toFixed(2), x: col2X + halfW - 26, align: 'right' },
        { text: data.demand.demandCharge.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: col2X + halfW, align: 'right', bold: true },
      ], false);
      y += ROW_H;
    }
    halfRow(col2X, halfW, [
      { text: 'Service', x: col2X + 3, align: 'left', bold: true },
      { text: '1 month', x: col2X + halfW - 48, align: 'right' },
      { text: 'fixed', x: col2X + halfW - 26, align: 'right' },
      { text: SERVICE_CHARGE_EXCL_VAT.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: col2X + halfW, align: 'right', bold: true },
    ], true);
    y += ROW_H;
    halfTotal(col2X, halfW, `${fmtKwh(data.excluded.totalEnergyKwh)} kWh`, fmtR(exclTotal!));

    y = Math.max(yAfterL, y + TOT_H);

    // VAT footnote
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.setTextColor(...GREY);
    doc.text(`With PV incl. VAT: ${fmtR(r2(inclTotal * 1.15))}   Without PV incl. VAT: ${fmtR(r2(exclTotal! * 1.15))}   Service charge VAT: ${fmtR(SERVICE_CHARGE_INCL_VAT - SERVICE_CHARGE_EXCL_VAT)}`, margin, y + 3.5);
    y += 7;

  } else {
    // Single billing table fallback (no excluded data)
    section('TOU Billing — With PV/BESS (Grid Import)');

    const cols = [
      { label: 'TOU Period',   x: margin + 3,             align: 'left'  as const },
      { label: 'Energy (kWh)', x: margin + contentW - 84, align: 'right' as const },
      { label: 'Rate (R/kWh)', x: margin + contentW - 52, align: 'right' as const },
      { label: 'Charge (R)',   x: margin + contentW - 2,  align: 'right' as const },
    ];
    tableHeader(cols);

    [
      { label: 'Energy — Peak',     kwh: data.included.peakKwh,     rate: siteRates.peak,     charge: data.included.peakCharge,     color: RED },
      { label: 'Energy — Standard', kwh: data.included.standardKwh, rate: siteRates.standard, charge: data.included.standardCharge, color: AMBER },
      { label: 'Energy — Off-Peak', kwh: data.included.offpeakKwh,  rate: siteRates.offpeak,  charge: data.included.offpeakCharge,  color: BLUE },
    ].forEach((row, i) => tableRow([
      { text: row.label, x: margin + 3, align: 'left', bold: true, color: row.color },
      { text: fmtKwh(row.kwh), x: margin + contentW - 84, align: 'right' },
      { text: row.rate.toFixed(4), x: margin + contentW - 52, align: 'right' },
      { text: row.charge.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + contentW - 2, align: 'right', bold: true },
    ], i % 2 === 1));

    if (data.demand) {
      tableRow([
        { text: 'Demand', x: margin + 3, align: 'left', bold: true },
        { text: `${data.demand.peakKva.toFixed(1)} kVA`, x: margin + contentW - 84, align: 'right' },
        { text: DEFAULT_DEMAND_RATE_PER_KVA.toFixed(4), x: margin + contentW - 52, align: 'right' },
        { text: data.demand.demandCharge.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + contentW - 2, align: 'right', bold: true },
      ], false);
    }
    tableRow([
      { text: 'Service Charge', x: margin + 3, align: 'left', bold: true },
      { text: '1 month', x: margin + contentW - 84, align: 'right' },
      { text: 'fixed', x: margin + contentW - 52, align: 'right' },
      { text: SERVICE_CHARGE_EXCL_VAT.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + contentW - 2, align: 'right', bold: true },
    ], true);

    totalRow('TOTAL (excl. VAT)', `${fmtKwh(data.included.totalEnergyKwh)} kWh`, fmtR(inclTotal));

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.setTextColor(...GREY);
    doc.text(`VAT (15%): ${fmtR(r2(inclTotal * 0.15))}   Incl. VAT: ${fmtR(r2(inclTotal * 1.15))}`, margin, y + 3.5);
    y += 7;
  }

  // ── SECTION: Savings Analysis ─────────────────────────────────────────────
  if (data.excluded && totalSavings != null) {
    section('PV/BESS Savings Analysis');

    const periods = [
      { label: 'Peak',     exclC: data.excluded.peakCharge,     inclC: data.included.peakCharge,     exclK: data.excluded.peakKwh,     inclK: data.included.peakKwh },
      { label: 'Standard', exclC: data.excluded.standardCharge, inclC: data.included.standardCharge, exclK: data.excluded.standardKwh, inclK: data.included.standardKwh },
      { label: 'Off-Peak', exclC: data.excluded.offpeakCharge,  inclC: data.included.offpeakCharge,  exclK: data.excluded.offpeakKwh,  inclK: data.included.offpeakKwh },
    ].map(p => ({ ...p, saved: r2(p.exclC - p.inclC), kwhAvoided: r2(p.exclK - p.inclK) }));

    const savCols = [
      { label: 'Period',            x: margin + 3,              align: 'left'  as const },
      { label: 'kWh Avoided',       x: margin + contentW - 110, align: 'right' as const },
      { label: 'Grid-only (R)',      x: margin + contentW - 74,  align: 'right' as const },
      { label: 'With PV/BESS (R)',   x: margin + contentW - 36,  align: 'right' as const },
      { label: 'Saved (R)',          x: margin + contentW - 2,   align: 'right' as const },
    ];
    tableHeader(savCols);

    const periodColors: [number, number, number][] = [RED as [number,number,number], AMBER as [number,number,number], BLUE as [number,number,number]];
    periods.forEach((p, i) => tableRow([
      { text: p.label, x: margin + 3, align: 'left', bold: true, color: periodColors[i] },
      { text: `${fmtKwh(p.kwhAvoided)} kWh`, x: margin + contentW - 110, align: 'right' },
      { text: p.exclC.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + contentW - 74, align: 'right' },
      { text: p.inclC.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + contentW - 36, align: 'right' },
      { text: p.saved.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + contentW - 2,  align: 'right', bold: true, color: p.saved >= 0 ? GREEN : RED },
    ], i % 2 === 1));

    const energySavings = r2(periods.reduce((s, p) => s + p.saved, 0));
    totalRow('ENERGY SAVINGS', '', fmtR(energySavings));

    // Compact summary strip
    y += 2;
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(...GREEN);
    doc.roundedRect(margin, y, contentW, 14, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...DARK);
    doc.text('Total Bill Saving:', margin + 4, y + 5);
    doc.setFontSize(12);
    doc.setTextColor(...GREEN);
    doc.text(fmtR(totalSavings), margin + 4, y + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(`${savingsPct!.toFixed(1)}% reduction vs grid-only`, pageW - margin - 4, y + 5.5, { align: 'right' });
    doc.setFontSize(6.5);
    doc.text(`Self-supply: ${selfSupplyPct.toFixed(1)}%  (${fmtKwh(selfSupplyKwh)} kWh of ${fmtKwh(totalLoad)} kWh total load)`, pageW - margin - 4, y + 11, { align: 'right' });
    y += 18;
  }

  // ── SECTION: PV Summary ───────────────────────────────────────────────────
  const hasPvSummary = data.solarGenerationKwh > 0 || data.measuredGhiWhM2 != null;
  if (hasPvSummary) {
    section('PV Summary');

    // PV Generated row
    if (data.solarGenerationKwh > 0) {
      const pvValueZar = r2(data.solarGenerationKwh * siteRates.standard);
      const pvCols = [
        { label: 'Description',  x: margin + 3,              align: 'left'  as const },
        { label: 'Value',        x: margin + contentW - 50,  align: 'right' as const },
        { label: 'Unit',         x: margin + contentW - 2,   align: 'right' as const },
      ];
      tableHeader(pvCols);

      tableRow([
        { text: 'PV Generated Energy', x: margin + 3, align: 'left', bold: true, color: AMBER },
        { text: fmtKwh(data.solarGenerationKwh), x: margin + contentW - 50, align: 'right' },
        { text: 'kWh', x: margin + contentW - 2, align: 'right' },
      ], false);
      tableRow([
        { text: 'PV Generated Energy (value at standard rate)', x: margin + 3, align: 'left' },
        { text: pvValueZar.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x: margin + contentW - 50, align: 'right', bold: true, color: GREEN },
        { text: 'ZAR (excl. VAT)', x: margin + contentW - 2, align: 'right' },
      ], true);

      if (data.targetKwh > 0) {
        const pct = (data.solarGenerationKwh / data.targetKwh) * 100;
        const pctColor = (pct >= 95 ? GREEN : pct >= 80 ? AMBER : RED) as [number, number, number];
        tableRow([
          { text: 'Actual PV vs Target (SEM Financial Model)', x: margin + 3, align: 'left' },
          { text: `${pct.toFixed(0)}%`, x: margin + contentW - 50, align: 'right', bold: true, color: pctColor },
          { text: '%', x: margin + contentW - 2, align: 'right' },
        ], false);
      }
      y += 2;
    }

    // Irradiance rows
    if (data.measuredGhiWhM2 != null) {
      const ghiKwhM2 = (data.measuredGhiWhM2 / 1000).toFixed(1);
      tableRow([
        { text: 'Measured Global Horizontal Irradiance (GHI)', x: margin + 3, align: 'left' },
        { text: ghiKwhM2, x: margin + contentW - 50, align: 'right', bold: true },
        { text: 'kWh/m²', x: margin + contentW - 2, align: 'right' },
      ], false);
      y += 2;
    }
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────
  const pageH = 297;
  doc.setDrawColor(...BORDER);
  doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...GREY);
  doc.text('CoCT 2025/26 MV TOU — Low Demand season rates. Charges exclude VAT unless stated.', margin, pageH - 7.5);
  doc.text(`Momentum Group  |  ${data.siteLabel}  |  ${label}`, pageW - margin, pageH - 7.5, { align: 'right' });

  // ── POWER FLOW PAGES (PDC only) ──────────────────────────────────────────
  if (data.powerFlow && data.powerFlow.length > 0) {
    const weekCharts = drawPowerFlowCharts(data.powerFlow, label);

    // Each week chart: 1800×542 canvas → on A4 contentW=182mm → imgH≈54.8mm
    // We can fit 3 week charts per page comfortably.
    const imgW = contentW;
    const CHARTS_PER_PAGE = 3;
    const GAP_MM = 5;

    for (let i = 0; i < weekCharts.length; i++) {
      if (i % CHARTS_PER_PAGE === 0) {
        doc.addPage();

        // Header bar
        doc.setFillColor(...DARK);
        doc.rect(0, 0, pageW, 22, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('POWER FLOW — 30-MIN INTERVALS', pageW - margin, 9, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(`${label}  |  ${data.siteLabel}`, pageW - margin, 14, { align: 'right' });

        // Footer
        doc.setDrawColor(...BORDER);
        doc.line(margin, 297 - 12, pageW - margin, 297 - 12);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(...GREY);
        doc.text('30-min avg power. PV/Load/BESS/Grid in kW. Grid (kVA) = apparent power S_SUM. SAST (UTC+2).', margin, 297 - 7.5);
        doc.text(`Momentum Group  |  ${data.siteLabel}  |  ${label}`, pageW - margin, 297 - 7.5, { align: 'right' });
      }

      const chart   = weekCharts[i];
      const imgH    = Math.round(imgW * (chart.height / chart.width));
      const slotIdx = i % CHARTS_PER_PAGE;
      const imgY    = 26 + slotIdx * (imgH + GAP_MM);
      doc.addImage(chart.dataUrl, 'PNG', margin, imgY, imgW, imgH);
    }
  }

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
      const [hourlyGrid, peakKva, loadPoints, dailyProd, powerFlow, ghiWhM2] = await Promise.all([
        fetchMonthlyGridEnergyHourly(user.token, year, month, site),
        fetchMonthlyPeakDemand(user.token, year, month, site).catch(() => null),
        fetchMonthlyLoadEnergyHourly(user.token, year, month, site).catch(() => null),
        fetchDailyProduction(user.token, daysCount, site, { startDate, endDate }).catch(() => null),
        fetchMonthlyPowerFlow(user.token, year, month, site).catch(() => null),
        fetchMonthlyIrradiance(user.token, year, month, site).catch(() => null),
      ]);

      const touConfig = getTouConfig(site);
      const included = calculateTouCharges(hourlyGrid, touConfig);
      const excluded = loadPoints ? calculateTouCharges(loadPoints, touConfig) : null;
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
        powerFlow: powerFlow && powerFlow.length > 0 ? powerFlow : null,
        measuredGhiWhM2: ghiWhM2 ?? null,
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
          Generate a PDF report with full TOU billing breakdown, PV summary, and solar generation vs target.
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
            'Power flow chart — PV, Load, BESS & Grid (30-min)',  // PDC only
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
