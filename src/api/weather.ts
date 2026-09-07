/**
 * Public weather data for Parc du Cap (Bellville, Cape Town) via Open-Meteo.
 * Used to annotate below-trend solar irradiance days with the actual weather
 * (sunny, partly cloudy, rain, thunderstorm, etc.).
 *
 * Open-Meteo is free and requires no API key:
 *   - Forecast API : covers the last ~92 days plus upcoming days
 *   - Archive API  : full history from 1940 onward (used for older ranges)
 */

export interface DailyWeatherPoint {
  /** ISO date (calendar day, Africa/Johannesburg timezone) */
  date: string;
  /** WMO weather interpretation code (0–99) */
  weatherCode: number;
  /** Mean cloud cover (%) — may be null */
  cloudCoverPct: number | null;
  /** Total precipitation for the day (mm) — may be null */
  precipitationMm: number | null;
  /** Max 2 m temperature (°C) — may be null */
  maxTempC: number | null;
}

export type WeatherKind =
  | 'sunny'
  | 'partly-cloudy'
  | 'cloudy'
  | 'rain'
  | 'storm'
  | 'fog'
  | 'snow'
  | 'drizzle';

export interface WeatherCondition {
  label: string;
  emoji: string;
  kind: WeatherKind;
}

/** Parc du Cap — Bellville, Cape Town, Western Cape. */
export const BELLVILLE_COORDS = { latitude: -33.9003, longitude: 18.6297 };

const FORECAST_API_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_API_URL = 'https://archive-api.open-meteo.com/v1/archive';
const DAILY_FIELDS = 'daily=weather_code,cloud_cover_mean,precipitation_sum,temperature_2m_max';

const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

interface OpenMeteoDailyResponse {
  daily?: {
    time?: string[];
    weather_code?: (number | null)[];
    cloud_cover_mean?: (number | null)[];
    precipitation_sum?: (number | null)[];
    temperature_2m_max?: (number | null)[];
  };
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function requestOpenMeteo(url: string): Promise<DailyWeatherPoint[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo request failed (HTTP ${res.status})`);
  }
  const json = (await res.json()) as OpenMeteoDailyResponse;
  const daily = json.daily;
  if (!daily?.time) return [];

  return daily.time.map((date, i) => ({
    date,
    weatherCode: daily.weather_code?.[i] ?? -1,
    cloudCoverPct: daily.cloud_cover_mean?.[i] ?? null,
    precipitationMm: daily.precipitation_sum?.[i] ?? null,
    maxTempC: daily.temperature_2m_max?.[i] ?? null,
  }));
}

/**
 * Fetch daily weather for the given inclusive date range (ISO yyyy-mm-dd).
 * Merges the Forecast API (recent ~92 days) and the Archive API (older days)
 * so both short dashboard windows and long custom ranges work.
 */
export async function fetchDailyWeather(startDate: string, endDate: string): Promise<DailyWeatherPoint[]> {
  const byDate = new Map<string, DailyWeatherPoint>();
  const failures: unknown[] = [];

  const cutoff = new Date(Date.now() + SAST_OFFSET_MS);
  cutoff.setDate(cutoff.getDate() - 92);
  const cutoffIso = toIsoDate(cutoff);

  const common = `latitude=${BELLVILLE_COORDS.latitude}&longitude=${BELLVILLE_COORDS.longitude}&${DAILY_FIELDS}&timezone=Africa%2FJohannesburg`;

  // Recent days — Forecast API (includes history up to 92 days back).
  if (endDate >= cutoffIso) {
    const forecastStart = startDate >= cutoffIso ? startDate : cutoffIso;
    try {
      const url = `${FORECAST_API_URL}?${common}&start_date=${forecastStart}&end_date=${endDate}&forecast_days=1`;
      for (const p of await requestOpenMeteo(url)) byDate.set(p.date, p);
    } catch (err) {
      failures.push(err);
    }
  }

  // Older days — Historical Archive API.
  if (startDate < cutoffIso) {
    const archiveEnd = endDate < cutoffIso
      ? endDate
      : toIsoDate(new Date(new Date(`${cutoffIso}T00:00:00Z`).getTime() - 86400000));
    if (startDate <= archiveEnd) {
      try {
        const url = `${ARCHIVE_API_URL}?${common}&start_date=${startDate}&end_date=${archiveEnd}`;
        for (const p of await requestOpenMeteo(url)) byDate.set(p.date, p);
      } catch (err) {
        failures.push(err);
      }
    }
  }

  if (byDate.size === 0 && failures.length > 0) {
    throw new Error('Could not load public weather data');
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Map a WMO weather code to a friendly condition (label + emoji). */
export function classifyWeatherCode(code: number): WeatherCondition {
  switch (code) {
    case 0: return { label: 'Clear sky', emoji: '☀️', kind: 'sunny' };
    case 1: return { label: 'Mostly sunny', emoji: '🌤️', kind: 'sunny' };
    case 2: return { label: 'Partly cloudy', emoji: '⛅', kind: 'partly-cloudy' };
    case 3: return { label: 'Overcast', emoji: '☁️', kind: 'cloudy' };
    case 45:
    case 48: return { label: 'Fog', emoji: '🌫️', kind: 'fog' };
    case 51:
    case 53:
    case 55: return { label: 'Drizzle', emoji: '🌦️', kind: 'drizzle' };
    case 56:
    case 57: return { label: 'Freezing drizzle', emoji: '🌧️', kind: 'drizzle' };
    case 61: return { label: 'Light rain', emoji: '🌦️', kind: 'rain' };
    case 63: return { label: 'Moderate rain', emoji: '🌧️', kind: 'rain' };
    case 65: return { label: 'Heavy rain', emoji: '🌧️', kind: 'rain' };
    case 66:
    case 67: return { label: 'Freezing rain', emoji: '🌧️', kind: 'rain' };
    case 71: return { label: 'Light snow', emoji: '❄️', kind: 'snow' };
    case 73:
    case 75:
    case 77: return { label: 'Snow', emoji: '❄️', kind: 'snow' };
    case 80: return { label: 'Light rain showers', emoji: '🌦️', kind: 'rain' };
    case 81: return { label: 'Rain showers', emoji: '🌧️', kind: 'rain' };
    case 82: return { label: 'Heavy showers', emoji: '🌧️', kind: 'storm' };
    case 85:
    case 86: return { label: 'Snow showers', emoji: '🌨️', kind: 'snow' };
    case 95: return { label: 'Thunderstorm', emoji: '⛈️', kind: 'storm' };
    case 96:
    case 99: return { label: 'Thunderstorm with hail', emoji: '⛈️', kind: 'storm' };
    default: return { label: 'Unknown', emoji: '🌐', kind: 'cloudy' };
  }
}

/** Human-readable weather description, including precipitation when it rained. */
export function describeWeather(point: DailyWeatherPoint): string {
  const condition = classifyWeatherCode(point.weatherCode);
  const mm = point.precipitationMm;
  if (mm != null && mm >= 0.1) {
    return `${condition.label} · ${mm.toFixed(1)} mm`;
  }
  return condition.label;
}
