/**
 * Time-of-Use (TOU) classification and charge calculation.
 * City of Cape Town 2025/26 Medium Voltage TOU — Low Demand season (March), SAST UTC+2:
 *
 * Weekdays (Mon–Fri):
 *   Peak    : 07:00–09:00 and 18:00–21:00
 *   Standard: 06:00–07:00, 09:00–18:00, 21:00–22:00
 *   Off-Peak: 22:00–06:00
 *
 * Saturday:
 *   Standard: 07:00–12:00 and 18:00–20:00
 *   Off-Peak: all other hours
 *
 * Sunday:
 *   Standard: 18:00–20:00
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

/** Monthly CoCT MV TOU demand charge rate (R/kVA) — 2025/26 Low Demand season: R75.89 energy demand + R17.47 network capacity */
export const DEFAULT_DEMAND_RATE_PER_KVA = 93.36;

/**
 * CoCT 2025/26 MV TOU fixed monthly service charge.
 * Billed regardless of consumption (Large Power Users — TOU category).
 * Source: City of Cape Town Service Charges schedule.
 */
export const SERVICE_CHARGE_EXCL_VAT = 4_669.31;  // R/month
export const SERVICE_CHARGE_INCL_VAT = 5_369.70;  // R/month (15% VAT included)
export const SERVICE_CHARGE_VAT_RATE = 0.15;

export interface DemandBreakdown {
  /** Maximum apparent power (kVA) recorded during the month */
  peakKva: number;
  /** Demand charge in Rand (peakKva × ratePerKva) */
  demandCharge: number;
}

/** Calculate the monthly demand charge from a peak kVA reading. */
export function calculateDemandCharge(
  peakKva: number,
  ratePerKva: number = DEFAULT_DEMAND_RATE_PER_KVA,
): DemandBreakdown {
  return {
    peakKva,
    demandCharge: Math.round(peakKva * ratePerKva * 100) / 100,
  };
}

export type TouPeriod = 'peak' | 'standard' | 'offpeak';

/**
 * Classify an hour into a TOU period.
 * @param sastHour  - Hour of day in SAST (0–23)
 * @param dayOfWeek - JS day-of-week from a UTC date object where the date is already in SAST
 *                    (0 = Sunday … 6 = Saturday)
 */
export function classifyTouPeriod(sastHour: number, dayOfWeek: number): TouPeriod {
  // Sunday (0)
  if (dayOfWeek === 0) {
    if (sastHour >= 18 && sastHour < 20) return 'standard';
    return 'offpeak';
  }

  // Saturday (6)
  if (dayOfWeek === 6) {
    if ((sastHour >= 7 && sastHour < 12) || (sastHour >= 18 && sastHour < 20)) return 'standard';
    return 'offpeak';
  }

  // Weekday (Mon–Fri)
  // Peak: 07:00–09:00 and 18:00–21:00
  if ((sastHour >= 7 && sastHour < 9) || (sastHour >= 18 && sastHour < 21)) return 'peak';

  // Standard: 06:00–07:00, 09:00–18:00, 21:00–22:00
  if (
    (sastHour >= 6 && sastHour < 7) ||
    (sastHour >= 9 && sastHour < 18) ||
    (sastHour >= 21 && sastHour < 22)
  ) return 'standard';

  // Off-peak: 22:00–06:00
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

    // Subtract 1 second so that an end-of-hour timestamp (e.g. 08:00) is
    // treated as belonging to the hour it actually covers (07:00–08:00).
    // Then shift into SAST to read hour-of-day and day-of-week correctly.
    const sastDate = new Date((point.timestamp - 1) * 1000 + SAST_OFFSET_MS);
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
