const EQUIPMENT_URL = '/api/equipment';
const SAST_OFFSET = 2 * 60 * 60 * 1000; // UTC+2

interface SiteHigecoConfig {
  sn: string;
  pvTotalIdLog: number;
  pvTotalItems: number[];
  loadIdLog: number;
  loadItems: number[];
  label: string;
  weather?: {
    idLog: number;
    items: number[];
  };
  /** Cumulative monthly grid-import energy meter (kWh, period=3600) */
  gridEnergy?: {
    idLog: number;
    items: number[];
  };
  /** Total Apparent Power meter used for monthly demand charges (kVA, period=1800) */
  demand?: {
    idLog: number;
    items: number[];
    period: string;
  };
  /** Cumulative total-load energy meter (kWh, period=3600) — used for PV/BESS-excluded TOU calculation */
  loadEnergy?: {
    idLog: number;
    items: number[];
  };
}

const SITE_HIGECO: Record<'parc-du-cap' | 'centurion', SiteHigecoConfig> = {
  'parc-du-cap': {
    sn: '3763Y3YGID8F',
    pvTotalIdLog: 1999098,
    pvTotalItems: [1999098110],
    loadIdLog: 1999098,
    loadItems: [1999098147],
    label: 'MMH Parc Du Cap',
    weather: {
      idLog: 2053727,
      items: [2053727734],
    },
    gridEnergy: {
      idLog: 1999098,
      items: [1999098139],
    },
    demand: {
      idLog: 2052549,
      items: [2052549565],
      period: '1800',
    },
    loadEnergy: {
      idLog: 1999098,
      items: [1999098148],
    },
  },
  centurion: {
    sn: '3363PHOGI828',
    pvTotalIdLog: 1999433,
    pvTotalItems: [1999433112],
    loadIdLog: 1999433,
    loadItems: [1999433127],
    label: 'MMH Centurion',
    weather: {
      idLog: 2051563,
      items: [2051563001],
    },
    gridEnergy: {
      idLog: 1999433,
      items: [1999433139],
    },
  },
};

export interface PowerDataPoint {
  timestamp: number;
  stato: number;
  powerKw: number;
}

export interface DailyProductionPoint {
  date: string;       // "YYYY-MM-DD"
  dateLabel: string;   // "Mar 01"
  productionKwh: number;
  loadKwh: number;
  loadDuringSolarKwh: number;  // load consumed only while solar was producing
}

export interface GraphDataResponse {
  nome: string;
  nomeDispositivo: string;
  lblTab: string;
  sampleTime: string;
  lbl: { name: string; lbl: string; type: string; unit: string; id: string }[];
  dati: [number, number, string][];
}

const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please sign in again.';

function isSessionExpiredResponse(json: unknown): boolean {
  if (!json || typeof json !== 'object') {
    return false;
  }

  const response = json as {
    ERR?: number;
    STRERR?: string;
    DATI?: Array<{ ERR?: number; STRERR?: string }>;
  };

  if (response.ERR === 1 && /session expired/i.test(response.STRERR ?? '')) {
    return true;
  }

  return Array.isArray(response.DATI)
    && response.DATI.some((entry) => entry?.ERR === 1 && /session expired/i.test(entry?.STRERR ?? ''));
}

function notifySessionExpired() {
  window.dispatchEvent(new CustomEvent('solar-dashboard:session-expired', {
    detail: { message: SESSION_EXPIRED_MESSAGE },
  }));
}

/**
 * Get start-of-day (SAST) Unix timestamp for today.
 */
function getSastStartOfDay(d: Date): number {
  const sastNow = new Date(d.getTime() + SAST_OFFSET);
  const startOfDay = new Date(Date.UTC(sastNow.getUTCFullYear(), sastNow.getUTCMonth(), sastNow.getUTCDate()));
  return Math.floor((startOfDay.getTime() - SAST_OFFSET) / 1000);
}

/**
 * Get the SAST date string for a Unix timestamp.
 */
function timestampToSastDate(ts: number): string {
  const d = new Date((ts * 1000) + SAST_OFFSET);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10).toString().padStart(2, '0')}`;
}

function parseSastDateStartToUnix(dateStr: string): number {
  const [yearRaw, monthRaw, dayRaw] = dateStr.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!year || !month || !day) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  return Math.floor((Date.UTC(year, month - 1, day) - SAST_OFFSET) / 1000);
}

interface DateWindowOptions {
  startDate?: string;
  endDate?: string;
}

function resolveDateWindow(days: number, options?: DateWindowOptions): { start: number; stop: number; days: number } {
  if (options?.startDate && options?.endDate) {
    const start = parseSastDateStartToUnix(options.startDate);
    const endStart = parseSastDateStartToUnix(options.endDate);
    if (endStart < start) {
      throw new Error('End date must be on or after start date.');
    }
    const resolvedDays = Math.floor((endStart - start) / 86400) + 1;
    return {
      start,
      stop: endStart + 86399,
      days: resolvedDays,
    };
  }

  const now = new Date();
  const todayStart = getSastStartOfDay(now);
  return {
    start: todayStart - (days - 1) * 86400,
    stop: todayStart + 86399,
    days,
  };
}

/**
 * Internal helper: fetch raw power data for a time range.
 */
interface RawPowerResult {
  points: PowerDataPoint[];
  sampleTimeSec: number;
}

async function fetchRawPowerData(
  token: string,
  start: number,
  stop: number,
  sn: string,
  idLog: number,
  items: number[],
): Promise<RawPowerResult> {
  const queryPayload = JSON.stringify([
    {
      act: 'getDataLog',
      idReq: 'graphsCall',
      sn,
      DATI: {
        idLog,
        start,
        stop,
        maxNumRecord: 100000,
        period: '1',
        zeroTimeOffset: 0,
        items,
      },
    },
  ]);

  const body = new URLSearchParams();
  body.set('query', queryPayload);

  const res = await fetch(EQUIPMENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Higeco-Token': token,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Equipment request failed: ${res.status}`);
  }

  const json = await res.json();

  if (isSessionExpiredResponse(json)) {
    notifySessionExpired();
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  const outer = json?.DATI?.[0]?.DATI;
  if (!outer?.dati) {
    throw new Error('Unexpected response structure');
  }

  const sampleTimeSec = parseInt(outer.sampleTime, 10) || 60;
  const raw: [number, number, string][] = outer.dati;

  return {
    points: raw.map(([ts, stato, val]) => ({
      timestamp: ts,
      stato,
      powerKw: parseFloat(val) || 0,
    })),
    sampleTimeSec,
  };
}

/**
 * Chunked fetch: splits a long time range into ≤30-day windows so no
 * single API call exceeds the 100 000-record limit, then merges results.
 */
const CHUNK_DAYS = 30;

async function fetchRawPowerDataChunked(
  token: string,
  start: number,
  stop: number,
  sn: string,
  idLog: number,
  items: number[],
): Promise<RawPowerResult> {
  const totalSeconds = stop - start;
  const chunkSeconds = CHUNK_DAYS * 86400;

  // Short range — single call is fine
  if (totalSeconds <= chunkSeconds) {
    return fetchRawPowerData(token, start, stop, sn, idLog, items);
  }

  // Build chunk windows
  const chunks: { start: number; stop: number }[] = [];
  let cursor = start;
  while (cursor <= stop) {
    const chunkEnd = Math.min(cursor + chunkSeconds - 1, stop);
    chunks.push({ start: cursor, stop: chunkEnd });
    cursor = chunkEnd + 1;
  }

  // Fetch all chunks in parallel
  const results = await Promise.all(
    chunks.map((c) => fetchRawPowerData(token, c.start, c.stop, sn, idLog, items)),
  );

  // Merge — use sampleTimeSec from first chunk (all should be the same)
  const merged: PowerDataPoint[] = [];
  for (const r of results) {
    merged.push(...r.points);
  }

  return {
    points: merged,
    sampleTimeSec: results[0].sampleTimeSec,
  };
}

/**
 * Fetch today's solar power graph data using Total_PV_Active_Power / Huawei_PV_Total_Active_Power.
 */
export async function fetchTodaySolarData(
  token: string,
  siteId: 'parc-du-cap' | 'centurion' = 'parc-du-cap',
): Promise<PowerDataPoint[]> {
  const start = getSastStartOfDay(new Date());
  const stop = start + 86399;
  const cfg = SITE_HIGECO[siteId];
  const result = await fetchRawPowerData(token, start, stop, cfg.sn, cfg.pvTotalIdLog, cfg.pvTotalItems);
  return result.points;
}

/**
 * Fetch solar data for the last N days and aggregate into daily production (kWh).
 * Uses trapezoidal integration over 5-min (300s) power samples.
 */
export async function fetchDailyProduction(
  token: string,
  days: number,
  siteId: 'parc-du-cap' | 'centurion' = 'parc-du-cap',
  options?: DateWindowOptions,
): Promise<DailyProductionPoint[]> {
  const { start, stop, days: resolvedDays } = resolveDateWindow(days, options);

  const cfg = SITE_HIGECO[siteId];

  // Fetch PV and Load in parallel (chunked to avoid 100k record limit)
  const [pvResult, loadResult] = await Promise.all([
    fetchRawPowerDataChunked(token, start, stop, cfg.sn, cfg.pvTotalIdLog, cfg.pvTotalItems),
    fetchRawPowerDataChunked(token, start, stop, cfg.sn, cfg.loadIdLog, cfg.loadItems),
  ]);

  // Bucket raw power samples by date
  const bucketByDate = (raw: PowerDataPoint[]) => {
    const buckets = new Map<string, Map<number, number>>();
    for (const p of raw) {
      const dateKey = timestampToSastDate(p.timestamp);
      let map = buckets.get(dateKey);
      if (!map) { map = new Map(); buckets.set(dateKey, map); }
      map.set(p.timestamp, p.powerKw);
    }
    return buckets;
  };

  const pvBuckets = bucketByDate(pvResult.points);
  const loadBuckets = bucketByDate(loadResult.points);

  const pvSampleHours = pvResult.sampleTimeSec / 3600;
  const loadSampleHours = loadResult.sampleTimeSec / 3600;

  const sumBucket = (map: Map<number, number> | undefined, sampleHours: number) => {
    if (!map) return 0;
    let total = 0;
    for (const kw of map.values()) total += kw * sampleHours;
    return Math.round(total * 10) / 10;
  };

  const results: DailyProductionPoint[] = [];
  for (let d = 0; d < resolvedDays; d++) {
    const ts = start + d * 86400;
    const dateKey = timestampToSastDate(ts);

    const pvMap = pvBuckets.get(dateKey);
    const loadMap = loadBuckets.get(dateKey);

    // Identify timestamps where solar was producing (> 0.1 kW threshold)
    const solarActiveTs = new Set<number>();
    if (pvMap) {
      for (const [timestamp, kw] of pvMap.entries()) {
        if (kw > 0.1) solarActiveTs.add(timestamp);
      }
    }

    // Sum load only during solar-active timestamps
    let loadDuringSolar = 0;
    if (loadMap) {
      for (const [timestamp, kw] of loadMap.entries()) {
        if (solarActiveTs.has(timestamp)) {
          loadDuringSolar += kw * loadSampleHours;
        }
      }
    }

    results.push({
      date: dateKey,
      dateLabel: formatDateLabel(dateKey),
      productionKwh: sumBucket(pvMap, pvSampleHours),
      loadKwh: sumBucket(loadMap, loadSampleHours),
      loadDuringSolarKwh: Math.round(loadDuringSolar * 10) / 10,
    });
  }

  return results;
}

export interface DailyIrradiancePoint {
  date: string;
  dateLabel: string;
  irradianceKwhM2: number;  // daily GHI in kWh/m²
}

/**
 * Fetch daily solar irradiance (GHI) from the weather station.
 * Integrates W/m² samples into daily kWh/m².
 * Returns null if the site has no weather station configured.
 */
export async function fetchDailyIrradiance(
  token: string,
  days: number,
  siteId: 'parc-du-cap' | 'centurion' = 'parc-du-cap',
  options?: DateWindowOptions,
): Promise<DailyIrradiancePoint[] | null> {
  const cfg = SITE_HIGECO[siteId];
  if (!cfg.weather) return null;

  const { start, stop, days: resolvedDays } = resolveDateWindow(days, options);

  const result = await fetchRawPowerDataChunked(
    token, start, stop, cfg.sn,
    cfg.weather.idLog, cfg.weather.items,
  );

  // Bucket by date — values are W/m²
  const buckets = new Map<string, number[]>();
  for (const p of result.points) {
    const dateKey = timestampToSastDate(p.timestamp);
    let arr = buckets.get(dateKey);
    if (!arr) { arr = []; buckets.set(dateKey, arr); }
    arr.push(p.powerKw); // stored as W/m² despite field name
  }

  const sampleHours = result.sampleTimeSec / 3600;

  const results: DailyIrradiancePoint[] = [];
  for (let d = 0; d < resolvedDays; d++) {
    const ts = start + d * 86400;
    const dateKey = timestampToSastDate(ts);
    const samples = buckets.get(dateKey);

    // Integrate: sum(W/m² × sampleHours) / 1000 → kWh/m²
    let dailyKwhM2 = 0;
    if (samples) {
      for (const wm2 of samples) {
        dailyKwhM2 += wm2 * sampleHours;
      }
      dailyKwhM2 = dailyKwhM2 / 1000;
    }

    results.push({
      date: dateKey,
      dateLabel: formatDateLabel(dateKey),
      irradianceKwhM2: Math.round(dailyKwhM2 * 100) / 100,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Grid energy hourly fetch (cumulative kWh meter → hourly deltas)
// ---------------------------------------------------------------------------

export interface HourlyGridEnergyPoint {
  /** UTC unix timestamp of the record (end of hour) */
  timestamp: number;
  /** kWh imported from grid during this hour */
  kwhDelta: number;
}

/**
 * Fetch hourly grid-import energy for a given month.
 * Uses the cumulative Monthly_Grid_Active_Energy meter with period=3600 (hourly) readings.
 *
 * Each reading's timestamp is normalised to the start of its SAST hour (e.g. 03:21 SAST → 03:00 SAST)
 * before binning, so TOU classification always uses clean hour boundaries.
 * raw[0] is used as the baseline reference value; energy deltas are computed from raw[i] − raw[i−1].
 */
export async function fetchMonthlyGridEnergyHourly(
  token: string,
  year: number,
  month: number, // 1–12
  siteId: 'parc-du-cap' | 'centurion',
): Promise<HourlyGridEnergyPoint[]> {
  const cfg = SITE_HIGECO[siteId];
  if (!cfg.gridEnergy) {
    throw new Error(`No grid energy item configured for site: ${siteId}`);
  }

  // Full month in SAST: midnight SAST on the 1st → 23:59:59 SAST on the last day
  const SAST_OFFSET_S = 2 * 3600;
  const startUtc = Math.floor(Date.UTC(year, month - 1, 1) / 1000) - SAST_OFFSET_S;
  const stopUtc  = Math.floor(Date.UTC(year, month,     1) / 1000) - SAST_OFFSET_S - 1;

  const queryPayload = JSON.stringify([
    {
      act: 'getDataLog',
      idReq: 'graphsCall',
      sn: cfg.sn,
      DATI: {
        idLog: cfg.gridEnergy.idLog,
        start: startUtc,
        stop: stopUtc,
        maxNumRecord: 100000,
        period: '3600',       // hourly readings; timestamps are normalised to SAST-hour boundaries below
        zeroTimeOffset: 0,
        items: cfg.gridEnergy.items,
      },
    },
  ]);

  const body = new URLSearchParams();
  body.set('query', queryPayload);

  const res = await fetch(EQUIPMENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Higeco-Token': token,
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`Equipment request failed: ${res.status}`);

  const json = await res.json();

  if (isSessionExpiredResponse(json)) {
    notifySessionExpired();
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  const outer = json?.DATI?.[0]?.DATI;
  if (!outer?.dati) throw new Error('Unexpected response structure');

  const raw: [number, number, string][] = outer.dati;

  // Sort ascending by timestamp
  raw.sort((a, b) => a[0] - b[0]);

  if (raw.length === 0) return [];

  // Bin kWh deltas into SAST-hour buckets.
  // key = UTC timestamp of the start of the SAST hour, value = accumulated kWh
  const hourlyBuckets = new Map<number, number>();

  const addToSastHour = (ts: number, kwh: number) => {
    if (kwh <= 0) return;
    // Floor to the SAST hour boundary, then convert back to UTC
    const sastHourStartUtc = Math.floor((ts + SAST_OFFSET_S) / 3600) * 3600 - SAST_OFFSET_S;
    hourlyBuckets.set(sastHourStartUtc, (hourlyBuckets.get(sastHourStartUtc) ?? 0) + kwh);
  };

  // raw[0] is the baseline reference (cumulative kWh at the start of the query window).
  // All energy is computed as deltas between consecutive readings.
  for (let i = 1; i < raw.length; i++) {
    const prev = parseFloat(raw[i - 1][2]) || 0;
    const curr = parseFloat(raw[i][2])     || 0;
    addToSastHour(raw[i][0], curr - prev);
  }

  // Convert to sorted array
  const result: HourlyGridEnergyPoint[] = [];
  for (const [ts, kwh] of hourlyBuckets) {
    result.push({ timestamp: ts, kwhDelta: Math.round(kwh * 1000) / 1000 });
  }
  result.sort((a, b) => a.timestamp - b.timestamp);

  return result;
}

/**
 * Fetch hourly Total Load Active Energy (kWh) for the given month.
 * Uses the same cumulative-delta approach as fetchMonthlyGridEnergyHourly but
 * reads the Total_Load_Active_Energy item — i.e. the full site load regardless
 * of PV/BESS contribution.  Used to compute the "PV/BESS Excluded" TOU bill.
 */
export async function fetchMonthlyLoadEnergyHourly(
  token: string,
  year: number,
  month: number, // 1–12
  siteId: 'parc-du-cap' | 'centurion',
): Promise<HourlyGridEnergyPoint[]> {
  const cfg = SITE_HIGECO[siteId];
  if (!cfg.loadEnergy) {
    throw new Error(`No load energy item configured for site: ${siteId}`);
  }

  const SAST_OFFSET_S = 2 * 3600;
  const startUtc = Math.floor(Date.UTC(year, month - 1, 1) / 1000) - SAST_OFFSET_S;
  const stopUtc  = Math.floor(Date.UTC(year, month,     1) / 1000) - SAST_OFFSET_S - 1;

  const queryPayload = JSON.stringify([
    {
      act: 'getDataLog',
      idReq: 'graphsCall',
      sn: cfg.sn,
      DATI: {
        idLog: cfg.loadEnergy.idLog,
        start: startUtc,
        stop: stopUtc,
        maxNumRecord: 100000,
        period: '3600',
        zeroTimeOffset: 0,
        items: cfg.loadEnergy.items,
      },
    },
  ]);

  const body = new URLSearchParams();
  body.set('query', queryPayload);

  const res = await fetch(EQUIPMENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Higeco-Token': token,
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`Equipment request failed: ${res.status}`);

  const json = await res.json();

  if (isSessionExpiredResponse(json)) {
    notifySessionExpired();
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  const outer = json?.DATI?.[0]?.DATI;
  if (!outer?.dati) throw new Error('Unexpected response structure');

  const raw: [number, number, string][] = outer.dati;
  raw.sort((a, b) => a[0] - b[0]);

  if (raw.length === 0) return [];

  const hourlyBuckets = new Map<number, number>();
  const addToSastHour = (ts: number, kwh: number) => {
    if (kwh <= 0) return;
    const sastHourStartUtc = Math.floor((ts + SAST_OFFSET_S) / 3600) * 3600 - SAST_OFFSET_S;
    hourlyBuckets.set(sastHourStartUtc, (hourlyBuckets.get(sastHourStartUtc) ?? 0) + kwh);
  };

  for (let i = 1; i < raw.length; i++) {
    const prev = parseFloat(raw[i - 1][2]) || 0;
    const curr = parseFloat(raw[i][2])     || 0;
    addToSastHour(raw[i][0], curr - prev);
  }

  const result: HourlyGridEnergyPoint[] = [];
  for (const [ts, kwh] of hourlyBuckets) {
    result.push({ timestamp: ts, kwhDelta: Math.round(kwh * 1000) / 1000 });
  }
  result.sort((a, b) => a.timestamp - b.timestamp);

  return result;
}

/**
 * Fetch the monthly peak apparent power (kVA) for demand charge calculation.
 * Uses 30-minute (period=1800) S_SUM (Total Apparent Power) readings and returns
 * the single highest reading recorded during the month.
 */
export async function fetchMonthlyPeakDemand(
  token: string,
  year: number,
  month: number, // 1–12
  siteId: 'parc-du-cap' | 'centurion',
): Promise<number> {
  const cfg = SITE_HIGECO[siteId];
  if (!cfg.demand) {
    throw new Error(`No demand item configured for site: ${siteId}`);
  }

  const SAST_OFFSET_S = 2 * 3600;
  const startUtc = Math.floor(Date.UTC(year, month - 1, 1) / 1000) - SAST_OFFSET_S;
  const stopUtc  = Math.floor(Date.UTC(year, month,     1) / 1000) - SAST_OFFSET_S - 1;

  const queryPayload = JSON.stringify([
    {
      act: 'getDataLog',
      idReq: 'graphsCall',
      sn: cfg.sn,
      DATI: {
        idLog: cfg.demand.idLog,
        start: startUtc,
        stop: stopUtc,
        maxNumRecord: 100000,
        period: cfg.demand.period,
        zeroTimeOffset: 0,
        items: cfg.demand.items,
      },
    },
  ]);

  const body = new URLSearchParams();
  body.set('query', queryPayload);

  const res = await fetch(EQUIPMENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Higeco-Token': token,
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`Equipment request failed: ${res.status}`);

  const json = await res.json();

  if (isSessionExpiredResponse(json)) {
    notifySessionExpired();
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  const outer = json?.DATI?.[0]?.DATI;
  if (!outer?.dati) throw new Error('Unexpected response structure');

  const raw: [number, number, string][] = outer.dati;

  // Peak demand = the single highest kVA reading in the month
  let maxKva = 0;
  for (const [, , val] of raw) {
    const kva = parseFloat(val) || 0;
    if (kva > maxKva) maxKva = kva;
  }

  return Math.round(maxKva * 10) / 10;
}
