import { Env, LaMetricResponse } from '../types';
import { createFrame, createResponse } from '../utils/lametric';

// ============================================================
// City Configuration
// ============================================================
// Each city has its own LaMetric icon. Update icon IDs after
// uploading/finding your city icons in the LaMetric icon store.
// Icon prefix: "i" = static, "a" = animated
// ============================================================

interface CityConfig {
  name: string;
  lat: number;
  lon: number;
  icon: string;
}

const CITIES: CityConfig[] = [
  { name: 'Portland',    lat: 45.5299, lon: -122.5205, icon: 'i73071' },
  { name: 'LA',          lat: 34.0585, lon: -118.4161, icon: 'i73072' },
  { name: 'NYC',         lat: 40.7809, lon: -73.9668,  icon: 'i73073' },
  { name: 'Kona',        lat: 19.6400, lon: -155.9969, icon: 'i73074' },
  { name: 'Vrsac',       lat: 45.1167, lon: 21.3033,   icon: 'i73075' },
];

const FRAMES_PER_CITY = 3;
const LAMETRIC_FRAME_LIMIT = 15;

const MAX_CITIES_PER_PAGE = Math.floor(LAMETRIC_FRAME_LIMIT / FRAMES_PER_CITY);

// ============================================================
// WMO Weather Code → Short display label
// ============================================================

function weatherLabel(code: number): string {
  switch (code) {
    case 0:  return 'CLEAR';
    case 1:  return 'CLEAR';
    case 2:  return 'PTLY CLDY';
    case 3:  return 'OVERCAST';
    case 45: return 'FOG';
    case 48: return 'FOG';
    case 51: return 'DRIZZLE';
    case 53: return 'DRIZZLE';
    case 55: return 'DRIZZLE';
    case 56: return 'FRZ DRZL';
    case 57: return 'FRZ DRZL';
    case 61: return 'LT RAIN';
    case 63: return 'RAIN';
    case 65: return 'POURING';
    case 66: return 'FRZ RAIN';
    case 67: return 'FRZ RAIN';
    case 71: return 'LT SNOW';
    case 73: return 'SNOW';
    case 75: return 'HVY SNOW';
    case 77: return 'SNOW';
    case 80: return 'SHOWERS';
    case 81: return 'RAIN';
    case 82: return 'POURING';
    case 85: return 'SNOW SHWR';
    case 86: return 'HVY SNOW';
    case 95: return 'TSTORM';
    case 96: return 'HAIL';
    case 99: return 'HAIL';
    default: return 'UNKNOWN';
  }
}

// ============================================================
// Data types
// ============================================================

interface CityWeather {
  name: string;
  icon: string;
  high: number;
  low: number;
  current: number;
  feelsLike: number;
  conditionCode: number;
  condition: string;
}

export interface WeatherData {
  cities: CityWeather[];
  fetchedAt: number;
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
  };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

// ============================================================
// Module exports (standard app pattern)
// ============================================================

export const name = 'weather';
export const kvKey = 'app:weather';

export async function fetchData(env: Env): Promise<WeatherData> {
  const cities: CityWeather[] = [];

  for (const city of CITIES) {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${city.lat}&longitude=${city.lon}` +
        `&current=temperature_2m,apparent_temperature,weather_code` +
        `&daily=temperature_2m_max,temperature_2m_min` +
        `&temperature_unit=fahrenheit` +
        `&timezone=auto&forecast_days=1`;

      const resp = await fetch(url);
      if (!resp.ok) {
        console.error(`Weather fetch failed for ${city.name}: ${resp.status}`);
        continue;
      }

      const data: OpenMeteoResponse = await resp.json();

      cities.push({
        name: city.name,
        icon: city.icon,
        high: Math.round(data.daily.temperature_2m_max[0]),
        low: Math.round(data.daily.temperature_2m_min[0]),
        current: Math.round(data.current.temperature_2m),
        feelsLike: Math.round(data.current.apparent_temperature),
        conditionCode: data.current.weather_code,
        condition: weatherLabel(data.current.weather_code),
      });
    } catch (error) {
      console.error(`Weather fetch error for ${city.name}:`, error);
    }
  }

  return { cities, fetchedAt: Date.now() };
}

export function formatResponse(data: WeatherData): LaMetricResponse {
  if (!data?.cities?.length) {
    return createResponse([createFrame('No weather data', 'i2056')]);
  }

  // Rotation: if more cities than fit in one page, rotate by minute parity
  let citiesToShow = data.cities;
  if (data.cities.length > MAX_CITIES_PER_PAGE) {
    const currentMinute = new Date().getMinutes();
    const totalPages = Math.ceil(data.cities.length / MAX_CITIES_PER_PAGE);
    const pageIndex = currentMinute % totalPages;
    const start = pageIndex * MAX_CITIES_PER_PAGE;
    citiesToShow = data.cities.slice(start, start + MAX_CITIES_PER_PAGE);
  }

  const frames = citiesToShow.flatMap((city) => [
    createFrame(`H${city.high} L${city.low}`, city.icon),
    createFrame(`N${city.current} F${city.feelsLike}`, city.icon),
    createFrame(city.condition, city.icon),
  ]);

  return createResponse(frames);
}

// ============================================================
// Custom scheduled handler (throttle to every 15 minutes)
// ============================================================

export async function customScheduledHandler(env: Env, scheduledTime?: number): Promise<void> {
  // Throttle: only run at :00, :15, :30, :45
  if (scheduledTime) {
    const minutes = new Date(scheduledTime).getMinutes();
    if (minutes % 15 !== 0) {
      console.log('Skipping weather update (not quarter-hour)');
      return;
    }
  }

  const data = await fetchData(env);

  if (data.cities.length === 0) {
    console.error('All weather fetches failed, keeping existing data');
    return;
  }

  const newValue = JSON.stringify(data);

  // Smart caching: only write if weather data actually changed
  // Compare without fetchedAt timestamp to avoid unnecessary writes
  const existingRaw = await env.CLOCK_DATA.get(kvKey);
  if (existingRaw) {
    const existing: WeatherData = JSON.parse(existingRaw);
    const existingComparable = JSON.stringify(existing.cities);
    const newComparable = JSON.stringify(data.cities);
    if (existingComparable === newComparable) {
      console.log('Skipped weather KV write (no changes)');
      return;
    }
  }

  await env.CLOCK_DATA.put(kvKey, newValue);
  console.log(`Updated weather data for ${data.cities.length} cities`);
}
