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

export type TouSeason = 'summer' | 'winter';

export const PDC_TOU_RATES_BY_SEASON: Record<TouSeason, TouRates> = {
  summer: {
    peak: 3.3396,
    standard: 2.1708,
    offpeak: 1.7563,
  },
  winter: {
    peak: 7.0691,
    standard: 2.2878,
    offpeak: 1.7563,
  },
};

/** Parc du Cap TOU rates — City of Cape Town 2025/26 MV TOU, low demand season. */
export const PDC_TOU_RATES: TouRates = PDC_TOU_RATES_BY_SEASON.summer;

export const PDC_ENERGY_DEMAND_RATE_PER_KVA = 75.89;
export const PDC_NETWORK_CAPACITY_RATE_PER_KVA_NMD = 17.47;

/** Monthly CoCT MV TOU demand charge rate for Parc du Cap (R/kVA) — 2025/26 Low Demand season: R75.89 energy demand + R17.47 network capacity */
export const PDC_DEMAND_RATE_PER_KVA = PDC_ENERGY_DEMAND_RATE_PER_KVA + PDC_NETWORK_CAPACITY_RATE_PER_KVA_NMD;

/** Monthly demand charge rate for Centurion (R/kVA). */
export const CENTURION_DEMAND_RATE_PER_KVA = 358.06;

/** Centurion minimum demand charged where recorded readings are below 140 kVA. */
export const CENTURION_MINIMUM_DEMAND_KVA = 140;

/** Centurion fixed monthly service charge (excl. VAT). */
export const CENTURION_SERVICE_CHARGE_EXCL_VAT = 4_321.63;
export const CENTURION_SERVICE_CHARGE_INCL_VAT = 4_969.87;

/**
 * CoCT 2025/26 MV TOU fixed monthly service charge.
 * Billed regardless of consumption (Large Power Users — TOU category).
 * Source: City of Cape Town Service Charges schedule.
 */
export const SERVICE_CHARGE_EXCL_VAT = 2_404.57;  // R/month
export const SERVICE_CHARGE_INCL_VAT = 2_765.26;  // R/month (15% VAT included)
export const SERVICE_CHARGE_VAT_RATE = 0.15;

export interface DemandBreakdown {
  /** Maximum apparent power (kVA) recorded during the month */
  peakKva: number;
  /** kVA used for billing after applying any minimum demand rule */
  chargeableKva: number;
  /** Demand charge in Rand (peakKva × ratePerKva) */
  demandCharge: number;
  /** Whether the charge was calculated from peak kVA or supplied as a fixed monthly cost */
  chargeBasis: 'per-kva' | 'fixed-monthly';
}

/** Calculate the monthly demand charge from a peak kVA reading. */
export function calculateDemandCharge(
  peakKva: number,
  rateOrConfig: number | TouConfig = PDC_DEMAND_RATE_PER_KVA,
): DemandBreakdown {
  const fixedMonthlyCharge = typeof rateOrConfig === 'number' ? undefined : rateOrConfig.fixedDemandChargeExclVat;
  const ratePerKva = typeof rateOrConfig === 'number' ? rateOrConfig : rateOrConfig.demandRatePerKva;
  const minimumDemandKva = typeof rateOrConfig === 'number' ? undefined : rateOrConfig.minimumDemandKva;
  const chargeableKva = fixedMonthlyCharge == null ? Math.max(peakKva, minimumDemandKva ?? 0) : peakKva;

  return {
    peakKva,
    chargeableKva,
    demandCharge: Math.round((fixedMonthlyCharge ?? chargeableKva * ratePerKva) * 100) / 100,
    chargeBasis: fixedMonthlyCharge == null ? 'per-kva' : 'fixed-monthly',
  };
}

export type TouPeriod = 'peak' | 'standard' | 'offpeak';

export type TouClassifier = (sastHour: number, dayOfWeek: number) => TouPeriod;

export interface TouConfig {
  rates: TouRates;
  classify: TouClassifier;
  demandRatePerKva: number;
  serviceChargeExclVat: number;
  serviceChargeInclVat: number;
  demandChargeComponents?: Array<{ label: string; rate: number; unit: string }>;
  fixedDemandChargeExclVat?: number;
  minimumDemandKva?: number;
  season?: TouSeason;
  touClassificationLabel: string;
  touPeriodSourceLabel: string;
}

/**
 * Classify an hour into a TOU period for Parc du Cap (City of Cape Town MV TOU, low demand).
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

export const CENTURION_TOU_RATES_BY_SEASON: Record<TouSeason, TouRates> = {
  summer: {
    peak: 2.7476,
    standard: 1.6972,
    offpeak: 1.2010,
  },
  winter: {
    peak: 7.1725,
    standard: 2.6198,
    offpeak: 1.3963,
  },
};

/** Centurion summer SEM TOU rates (R/kWh). */
export const CENTURION_TOU_RATES: TouRates = CENTURION_TOU_RATES_BY_SEASON.summer;

/** South African municipal high-demand season is Jun-Aug; Centurion SEM labels this winter. */
export function getTouSeasonForMonth(month: number): TouSeason {
  return month >= 6 && month <= 8 ? 'winter' : 'summer';
}

/**
 * Classify an hour into a TOU period for Centurion (low-demand season Eskom Municflex schedule).
 */
export function classifyCenturionLowDemandTouPeriod(sastHour: number, dayOfWeek: number): TouPeriod {
  return classifyTouPeriod(sastHour, dayOfWeek);
}

/**
 * Classify an hour into a TOU period for Centurion (high-demand season Eskom Municflex schedule).
 *
 * Weekdays (Mon–Fri):
 *   Peak    : 06:00–08:00 and 17:00–20:00
 *   Standard: 08:00–17:00 and 20:00–22:00
 *   Off-Peak: 22:00–06:00
 *
 * Saturday:
 *   Standard: 07:00–12:00 and 18:00–20:00
 *   Off-Peak: all other hours
 *
 * Sunday:
 *   Standard: 17:00–19:00
 *   Off-Peak: all other hours
 */
export function classifyCenturionHighDemandTouPeriod(sastHour: number, dayOfWeek: number): TouPeriod {
  if (dayOfWeek === 0) {
    if (sastHour >= 17 && sastHour < 19) return 'standard';
    return 'offpeak';
  }

  if (dayOfWeek === 6) {
    if ((sastHour >= 7 && sastHour < 12) || (sastHour >= 18 && sastHour < 20)) return 'standard';
    return 'offpeak';
  }

  if ((sastHour >= 6 && sastHour < 8) || (sastHour >= 17 && sastHour < 20)) return 'peak';
  if ((sastHour >= 8 && sastHour < 17) || (sastHour >= 20 && sastHour < 22)) return 'standard';
  return 'offpeak';
}

export function classifyCenturionTouPeriod(sastHour: number, dayOfWeek: number): TouPeriod {
  return classifyCenturionLowDemandTouPeriod(sastHour, dayOfWeek);
}

/** Per-site TOU configuration (rates + period classifier + demand/service charges). */
export type TouSiteId = 'parc-du-cap' | 'centurion';

export const TOU_CONFIG_BY_SITE: Record<TouSiteId, TouConfig> = {
  'parc-du-cap': {
    rates: PDC_TOU_RATES,
    classify: classifyTouPeriod,
    demandRatePerKva: PDC_DEMAND_RATE_PER_KVA,
    serviceChargeExclVat: SERVICE_CHARGE_EXCL_VAT,
    serviceChargeInclVat: SERVICE_CHARGE_INCL_VAT,
    touClassificationLabel: 'Large User Medium Voltage Time of Use tariff',
    demandChargeComponents: [
      { label: 'Energy demand', rate: PDC_ENERGY_DEMAND_RATE_PER_KVA, unit: 'R/kVA' },
      { label: 'Network capacity', rate: PDC_NETWORK_CAPACITY_RATE_PER_KVA_NMD, unit: 'R/kVA NMD' },
    ],
    season: 'summer',
    touPeriodSourceLabel: 'City of Cape Town 2025/26 MV TOU periods',
  },
  centurion: {
    rates: CENTURION_TOU_RATES,
    classify: classifyCenturionLowDemandTouPeriod,
    demandRatePerKva: CENTURION_DEMAND_RATE_PER_KVA,
    serviceChargeExclVat: CENTURION_SERVICE_CHARGE_EXCL_VAT,
    serviceChargeInclVat: CENTURION_SERVICE_CHARGE_INCL_VAT,
    minimumDemandKva: CENTURION_MINIMUM_DEMAND_KVA,
    season: 'summer',
    touClassificationLabel: '11 kV Supply Scale: Time of Use',
    touPeriodSourceLabel: 'Current Eskom Municflex periods',
  },
};

export function getTouConfig(siteId: TouSiteId, month = new Date().getMonth() + 1): TouConfig {
  const season = getTouSeasonForMonth(month);

  if (siteId === 'centurion') {
    return {
      ...TOU_CONFIG_BY_SITE.centurion,
      rates: CENTURION_TOU_RATES_BY_SEASON[season],
      classify: season === 'winter' ? classifyCenturionHighDemandTouPeriod : classifyCenturionLowDemandTouPeriod,
      season,
    };
  }

  return {
    ...TOU_CONFIG_BY_SITE['parc-du-cap'],
    rates: PDC_TOU_RATES_BY_SEASON[season],
    classify: classifyTouPeriod,
    season,
  };
}

export interface HourlyEnergyPoint {
  /** UTC unix timestamp (start of the hour, i.e. the reading row whose next row defines the delta) */
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
 * Defaults to the Parc du Cap (CoCT MV TOU) configuration to preserve existing behaviour.
 */
export function calculateTouCharges(
  hourlyData: HourlyEnergyPoint[],
  config: TouConfig = TOU_CONFIG_BY_SITE['parc-du-cap'],
): TouBreakdown {
  const { rates, classify } = config;
  let peakKwh = 0;
  let standardKwh = 0;
  let offpeakKwh = 0;

  const SAST_OFFSET_MS = 2 * 3600 * 1000;

  for (const point of hourlyData) {
    if (point.kwhDelta <= 0) continue;

    // Timestamp is the start of the hour (e.g. 07:00 covers 07:00–08:00).
    // Shift into SAST to read hour-of-day and day-of-week correctly.
    const sastDate = new Date(point.timestamp * 1000 + SAST_OFFSET_MS);
    const sastHour = sastDate.getUTCHours();
    const dayOfWeek = sastDate.getUTCDay();

    const period = classify(sastHour, dayOfWeek);
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

export interface BessTouSavings {
  /** BESS discharge energy by TOU period (kWh, positive) */
  peakKwh: number;
  standardKwh: number;
  offpeakKwh: number;
  totalKwh: number;
  /** Cost savings — what would have been paid if grid supplied discharge energy instead (R, excl. VAT) */
  peakSavings: number;
  standardSavings: number;
  offpeakSavings: number;
  totalSavings: number;
  /** BESS charging energy by TOU period (kWh, positive magnitude) */
  chargePeakKwh: number;
  chargeStandardKwh: number;
  chargeOffpeakKwh: number;
  totalChargeKwh: number;
  /** Cost of charging — grid energy consumed to charge the BESS at the applicable TOU rate (R, excl. VAT) */
  chargePeakCost: number;
  chargeStandardCost: number;
  chargeOffpeakCost: number;
  totalChargeCost: number;
  /** Net saving = totalSavings − totalChargeCost (round-trip net benefit) */
  netSavings: number;
  /** Round-trip efficiency = totalKwh / totalChargeKwh (0–1), null if no charging recorded */
  roundTripEfficiency: number | null;
}

/**
 * Calculate BESS energy savings and charging costs by TOU period from hourly
 * signed delta data (as returned by fetchMonthlyBessEnergyDeltas).
 *
 * Sign convention (matches the Total_BESS_Active_Energy meter / PDC Excel):
 *   kwhDelta > 0 = net discharge during that hour (displaces grid imports → saving)
 *   kwhDelta < 0 = net charge during that hour (consumes grid energy → cost)
 *
 * Per-row economic value = kwhDelta * rate (signed):
 *   discharge × rate = +saving, charge × rate = -cost (i.e. negative saving).
 * Net BESS saving = sum of discharge savings minus sum of charge costs.
 *
 * @param points  Hourly BESS energy points with signed kwhDelta.
 * @param ratesOrConfig   TOU energy rates or full site config to apply (default: Parc du Cap config).
 */
export function calculateBessTouSavings(
  points: Array<{ timestamp: number; kwhDelta: number }>,
  ratesOrConfig: TouRates | TouConfig = TOU_CONFIG_BY_SITE['parc-du-cap'],
): BessTouSavings {
  const isConfig = 'classify' in ratesOrConfig;
  const rates = isConfig ? ratesOrConfig.rates : ratesOrConfig;
  const classify = isConfig ? ratesOrConfig.classify : classifyTouPeriod;
  const SAST_OFFSET_MS = 2 * 3600 * 1000;
  let peakKwh = 0, standardKwh = 0, offpeakKwh = 0;
  let chargePeakKwh = 0, chargeStandardKwh = 0, chargeOffpeakKwh = 0;

  for (const p of points) {
    if (p.kwhDelta === 0) continue;
    const kwh = Math.abs(p.kwhDelta);
    const d = new Date(p.timestamp * 1000 + SAST_OFFSET_MS);
    const period = classify(d.getUTCHours(), d.getUTCDay());

    if (p.kwhDelta > 0) {
      // Discharging (meter delta positive = energy leaving the battery)
      if (period === 'peak')          peakKwh    += kwh;
      else if (period === 'standard') standardKwh += kwh;
      else                            offpeakKwh  += kwh;
    } else {
      // Charging (meter delta negative = energy entering the battery)
      if (period === 'peak')          chargePeakKwh    += kwh;
      else if (period === 'standard') chargeStandardKwh += kwh;
      else                            chargeOffpeakKwh  += kwh;
    }
  }

  const totalKwh       = peakKwh + standardKwh + offpeakKwh;
  const totalChargeKwh = chargePeakKwh + chargeStandardKwh + chargeOffpeakKwh;
  const totalSavings   = peakKwh * rates.peak + standardKwh * rates.standard + offpeakKwh * rates.offpeak;
  const totalChargeCost = chargePeakKwh * rates.peak + chargeStandardKwh * rates.standard + chargeOffpeakKwh * rates.offpeak;

  return {
    peakKwh:              r2(peakKwh),
    standardKwh:          r2(standardKwh),
    offpeakKwh:           r2(offpeakKwh),
    totalKwh:             r2(totalKwh),
    peakSavings:          r2(peakKwh     * rates.peak),
    standardSavings:      r2(standardKwh * rates.standard),
    offpeakSavings:       r2(offpeakKwh  * rates.offpeak),
    totalSavings:         r2(totalSavings),
    chargePeakKwh:        r2(chargePeakKwh),
    chargeStandardKwh:    r2(chargeStandardKwh),
    chargeOffpeakKwh:     r2(chargeOffpeakKwh),
    totalChargeKwh:       r2(totalChargeKwh),
    chargePeakCost:       r2(chargePeakKwh    * rates.peak),
    chargeStandardCost:   r2(chargeStandardKwh * rates.standard),
    chargeOffpeakCost:    r2(chargeOffpeakKwh  * rates.offpeak),
    totalChargeCost:      r2(totalChargeCost),
    netSavings:           r2(totalSavings - totalChargeCost),
    roundTripEfficiency:  totalChargeKwh > 0 ? r2(totalKwh / totalChargeKwh) : null,
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
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = parseFloat(sorted[i][2])     || 0;
    const next = parseFloat(sorted[i + 1][2]) || 0;
    const delta = next - curr;
    if (delta >= 0) {
      result.push({ timestamp: sorted[i][0], kwhDelta: Math.round(delta * 1000) / 1000 });
    }
  }
  return result;
}
