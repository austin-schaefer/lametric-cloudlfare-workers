import { Env, LaMetricResponse } from '../types';
import { createFrame, createResponse } from '../utils/lametric';

export const name = 'ticker';
export const kvKey = 'app:ticker:data';

// LaMetric icons
const ICON_GAIN = 'i72948';  // Up arrow / green
const ICON_LOSS = 'i72947';  // Down arrow / red
const ICON_INFO = 'i3313';   // Clock/info icon

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';

// Hardcoded ticker list: [display name, FMP symbol]
// BTC-USD → BTCUSD, GC=F (Gold Futures) → GCUSD
const TICKERS: { display: string; fmpSymbol: string }[] = [
  { display: 'SCHB', fmpSymbol: 'SCHB' },
  { display: 'QQQM', fmpSymbol: 'QQQM' },
  { display: 'VXUS', fmpSymbol: 'VXUS' },
  { display: 'VGK',  fmpSymbol: 'VGK' },
  { display: 'BTC',  fmpSymbol: 'BTCUSD' },
  { display: 'GOLD', fmpSymbol: 'GCUSD' },
];

interface TickerQuote {
  display: string;
  fmpSymbol: string;
  price: number;
  changesPercentage: number;
}

interface CachedTickerData {
  tickers: TickerQuote[];
  lastUpdated: string;
}

async function fetchQuotes(apiKey: string): Promise<TickerQuote[]> {
  const symbols = TICKERS.map(t => t.fmpSymbol).join(',');
  const response = await fetch(
    `${FMP_BASE_URL}/quote?symbol=${symbols}&apikey=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`FMP API error: ${response.status}`);
  }

  const quotes: any[] = await response.json();

  const results: TickerQuote[] = [];
  for (const ticker of TICKERS) {
    const quote = quotes.find((q: any) => q.symbol === ticker.fmpSymbol);
    if (quote) {
      results.push({
        display: ticker.display,
        fmpSymbol: ticker.fmpSymbol,
        price: quote.price,
        changesPercentage: quote.changesPercentage,
      });
    } else {
      console.warn(`No quote returned for ${ticker.fmpSymbol}`);
    }
  }

  return results;
}

export async function customScheduledHandler(env: Env, scheduledTime?: number): Promise<void> {
  if (!env.FMP_API_KEY) {
    console.error('FMP_API_KEY not configured');
    return;
  }

  // Throttle to every 15 minutes (:00, :15, :30, :45)
  if (scheduledTime) {
    const minutes = new Date(scheduledTime).getMinutes();
    if (minutes % 15 !== 0) {
      console.log('Skipping ticker update (not :00, :15, :30, or :45)');
      return;
    }
  }

  const tickers = await fetchQuotes(env.FMP_API_KEY);
  console.log(`Fetched quotes for ${tickers.length}/${TICKERS.length} symbols`);

  const existingRaw = await env.CLOCK_DATA.get(kvKey);
  const existing: CachedTickerData | null = existingRaw ? JSON.parse(existingRaw) : null;

  // Smart cache: only write if any percentage changed (compare at 1 decimal precision)
  const dataChanged =
    !existing ||
    tickers.length !== existing.tickers.length ||
    tickers.some(t => {
      const prev = existing.tickers.find(e => e.fmpSymbol === t.fmpSymbol);
      return !prev || t.changesPercentage.toFixed(1) !== prev.changesPercentage.toFixed(1);
    });

  if (dataChanged) {
    const newData: CachedTickerData = {
      tickers,
      lastUpdated: new Date().toISOString(),
    };
    await env.CLOCK_DATA.put(kvKey, JSON.stringify(newData));
    console.log('Updated ticker data');
  } else {
    console.log('Skipped ticker KV write (no changes)');
  }
}

// Standard fetchData for app pattern compatibility
export async function fetchData(env: Env): Promise<CachedTickerData | null> {
  const cached = await env.CLOCK_DATA.get(kvKey);
  return cached ? JSON.parse(cached) : null;
}

export function formatResponse(data: CachedTickerData): LaMetricResponse {
  if (!data || !data.tickers || data.tickers.length === 0) {
    return createResponse([createFrame('No data', ICON_INFO)]);
  }

  const frames = data.tickers.map(ticker => {
    const sign = ticker.changesPercentage >= 0 ? '+' : '';
    const text = `${ticker.display} ${sign}${ticker.changesPercentage.toFixed(1)}%`;
    const icon = ticker.changesPercentage >= 0 ? ICON_GAIN : ICON_LOSS;
    return createFrame(text, icon);
  });

  return createResponse(frames);
}
