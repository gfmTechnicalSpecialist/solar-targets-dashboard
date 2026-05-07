/**
 * Time-of-Use (TOU) classification and charge calculation.
 * Schedule derived from billing data (March 2026, SAST UTC+2):
 *
 * Weekdays (Mon–Fri):
 *   Peak    : 06:00–08:00 and 17:00–19:00
 *   Standard: 05:00–06:00, 08:00–17:00, 19:00–22:00
 *   Off-Peak: 22:00–05:00
 *
 * Saturday & Sunday:
 *   Standard: 17:00–19:00
 *   Off-Peak: all other hours
 */

export interface TouRates {
  peak: number;     // R/kWh
  standard: number; // R/kWh
  offpeak: number;  // R/kWh
}

export const DEFAULT_TOU_RATES: TouRates = {
  peak: 3.3396,     // 333.96 c/kWh
  standard: 2.1708, // 217.08 c/kWh
  offpeak: 1.7563,  // 175.63 c/kWh
};

export type TouPeriod = 'peak' | 'standard' | 'offpeak';

/**
 * Classify an hour into a TOU period.
 * @param sastHour  - Hour of day in SAST (0–23)
 * @param dayOfWeek - JS day-of-week from a UTC date object where the date is already in SAST
 *                    (0 = Sunday … 6 = Saturday)
 */
export function classifyTouPeriod(sastHour: number, dayOfWeek: number): TouPeriod {
  // Saturday (6) and Sunday (0)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    if (sastHour >= 17 && sastHour < 19) return 'standard';
    return 'offpeak';
  }

  // Weekday (Mon–Fri)
  // Peak: 06:00–08:00 and 17:00–19:00
  if ((sastHour >= 6 && sastHour < 8) || (sastHour >= 17 && sastHour < 19)) return 'peak';

  // Standard: 05:00–06:00, 08:00–17:00, 19:00–22:00
  if (
    (sastHour >= 5 && sastHour < 6) ||
    (sastHour >= 8 && sastHour < 17) ||
    (sastHour >= 19 && sastHour < 22)
  ) return 'standard';

  // Off-peak: 22:00–05:00
  return 'offpeak';
}

export interface HourlyEnergyPoint {
  /** UTC unix timestamp (end of the hour, as returned by the API) */
  timestamp: number;
  /** kWh consumed during this hour (delta between cumulative readings) */
  kwhDelta: number;
}

export interface TouBreakdown {
  peakKwh: number;
  standardKwh: number;
  offpeakKwh: number;
  peakCharge: number;
  standardCharge: number;
  offpeakCharge: number;
  totalEnergyKwh: number;
  totalCharge: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Given an array of hourly kWh deltas, classify each hour and calculate TOU charges.
 */
export function calculateTouCharges(
  hourlyData: HourlyEnergyPoint[],
  rates: TouRates = DEFAULT_TOU_RATES,
): TouBreakdown {
  let peakKwh = 0;
  let standardKwh = 0;
  let offpeakKwh = 0;

  const SAST_OFFSET_MS = 2 * 3600 * 1000;

  for (const point of hourlyData) {
    if (point.kwhDelta <= 0) continue;

    // Shift timestamp into SAST to read hour-of-day and day-of-week correctly
    const sastDate = new Date(point.timestamp * 1000 + SAST_OFFSET_MS);
    const sastHour = sastDate.getUTCHours();
    const dayOfWeek = sastDate.getUTCDay();

    const period = classifyTouPeriod(sastHour, dayOfWeek);
    if (period === 'peak')     peakKwh    += point.kwhDelta;
    else if (period === 'standard') standardKwh += point.kwhDelta;
    else                        offpeakKwh  += point.kwhDelta;
  }

  return {
    peakKwh:       r2(peakKwh),
    standardKwh:   r2(standardKwh),
    offpeakKwh:    r2(offpeakKwh),
    peakCharge:    r2(peakKwh    * rates.peak),
    standardCharge:r2(standardKwh * rates.standard),
    offpeakCharge: r2(offpeakKwh  * rates.offpeak),
    totalEnergyKwh:r2(peakKwh + standardKwh + offpeakKwh),
    totalCharge:   r2(peakKwh * rates.peak + standardKwh * rates.standard + offpeakKwh * rates.offpeak),
  };
}

/**
 * Convert cumulative meter readings (as returned by the API, period=3600)
 * into per-hour delta kWh values.
 */
export function cumulativeToHourlyDeltas(
  raw: [number, number, string][],
): HourlyEnergyPoint[] {
  if (raw.length < 2) return [];

  // Sort ascending by timestamp
  const sorted = [...raw].sort((a, b) => a[0] - b[0]);

  const result: HourlyEnergyPoint[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseFloat(sorted[i - 1][2]) || 0;
    const curr = parseFloat(sorted[i][2])     || 0;
    const delta = curr - prev;
    if (delta >= 0) {
      result.push({ timestamp: sorted[i][0], kwhDelta: Math.round(delta * 1000) / 1000 });
    }
  }
  return result;
}
