import { Env, LaMetricResponse } from '../types';
import { createFrame, createResponse } from '../utils/lametric';

export const name = 'stoxx';
export const kvKey = 'app:stoxx:data';

// LaMetric icons
const ICON_GAIN = 'i72948';  // Up arrow / green
const ICON_LOSS = 'i72947';  // Down arrow / red
const ICON_MARKET_CLOSED = 'i3313';  // Clock/info icon

// FMP API endpoints (new stable endpoints)
const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';

// Wikipedia S&P 500 source
const WIKIPEDIA_SP500_URL = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies';

// Data structure
interface StockGainerLoser {
  symbol: string;
  name: string;
  change: number;
  price: number;
  changesPercentage: number;
  exchange?: string;
}

interface CachedStocksData {
  topGainer: StockGainerLoser | null;
  topLoser: StockGainerLoser | null;
  lastUpdated: string;
  marketClosed: boolean;
  sp500Symbols?: string[];  // Cached S&P 500 symbols from Wikipedia
  sp500LastFetched?: string;  // When S&P 500 list was last updated
}

// Time zone helpers
function isMarketOpen(): boolean {
  // US market hours: Mon-Fri, 9:30 AM - 4:00 PM Eastern Time
  const now = new Date();

  // Convert to ET (UTC-5 or UTC-4 depending on DST)
  // For simplicity, using Intl API to get ET time
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const dayOfWeek = etTime.getDay(); // 0 = Sunday, 6 = Saturday
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();

  // Check if weekday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // Check if between 9:30 AM and 4:00 PM ET
  const currentMinutes = hours * 60 + minutes;
  const marketOpen = 9 * 60 + 30;  // 9:30 AM
  const marketClose = 16 * 60;      // 4:00 PM

  return currentMinutes >= marketOpen && currentMinutes < marketClose;
}

function shouldUpdateSP500List(lastFetched?: string): boolean {
  if (!lastFetched) return true;

  const lastUpdate = new Date(lastFetched);
  const now = new Date();
  const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

  // Update once per day (24 hours)
  return hoursSinceUpdate >= 24;
}

// Fetch S&P 500 constituent list from Wikipedia
async function fetchSP500FromWikipedia(): Promise<string[]> {
  console.log('Fetching S&P 500 list from Wikipedia');

  const response = await fetch(WIKIPEDIA_SP500_URL, {
    headers: {
      'User-Agent': 'LaMetric-Stocks-App/1.0 (Educational/Personal Use)'
    }
  });

  if (!response.ok) {
    throw new Error(`Wikipedia fetch failed: ${response.status}`);
  }

  const html = await response.text();

  // Parse HTML to extract ticker symbols from the table
  // The S&P 500 constituents table has symbols in the first column
  // Format: <td><a href="/wiki/Ticker_Symbol" title="...">SYMBOL</a></td>

  const symbols: string[] = [];

  // Match table rows with ticker symbols
  // Looking for pattern: <td><a href="/wiki/..." ...>SYMBOL</a>
  const symbolRegex = /<tr>\s*<td><a[^>]*>([A-Z.]+)<\/a>/g;

  let match;
  while ((match = symbolRegex.exec(html)) !== null) {
    const symbol = match[1];
    // Filter out likely false matches (too long, contains spaces, etc.)
    if (symbol.length <= 5 && !symbol.includes(' ')) {
      symbols.push(symbol);
    }
  }

  // Deduplicate and sort
  const uniqueSymbols = Array.from(new Set(symbols)).sort();

  console.log(`Parsed ${uniqueSymbols.length} S&P 500 symbols from Wikipedia`);

  // Sanity check: S&P 500 should have around 500-505 companies
  if (uniqueSymbols.length < 400 || uniqueSymbols.length > 600) {
    console.warn(`Warning: Unexpected number of symbols parsed (${uniqueSymbols.length}). Expected ~500.`);
  }

  return uniqueSymbols;
}

// FMP API functions
async function fetchGainersLosers(
  apiKey: string,
  sp500Symbols: string[]
): Promise<{ topGainer: StockGainerLoser | null; topLoser: StockGainerLoser | null }> {
  // Fetch both endpoints in parallel using new stable API
  const [gainersResponse, losersResponse] = await Promise.all([
    fetch(`${FMP_BASE_URL}/biggest-gainers?apikey=${apiKey}`),
    fetch(`${FMP_BASE_URL}/biggest-losers?apikey=${apiKey}`)
  ]);

  if (!gainersResponse.ok || !losersResponse.ok) {
    throw new Error('FMP API error fetching gainers/losers');
  }

  const gainers: StockGainerLoser[] = await gainersResponse.json();
  const losers: StockGainerLoser[] = await losersResponse.json();

  console.log(`Fetched ${gainers.length} gainers, ${losers.length} losers`);

  // Filter to S&P 500 symbols only
  const sp500Set = new Set(sp500Symbols);
  const sp500Gainers = gainers.filter(stock => sp500Set.has(stock.symbol));
  const sp500Losers = losers.filter(stock => sp500Set.has(stock.symbol));

  console.log(`Filtered to ${sp500Gainers.length} S&P 500 gainers, ${sp500Losers.length} S&P 500 losers`);

  // Get top S&P 500 gainer and loser (API already returns sorted by percentage)
  const topGainer = sp500Gainers.length > 0 ? sp500Gainers[0] : null;
  const topLoser = sp500Losers.length > 0 ? sp500Losers[0] : null;

  if (topGainer) {
    console.log(`Top S&P 500 gainer: ${topGainer.symbol} ${topGainer.changesPercentage.toFixed(2)}%`);
  }
  if (topLoser) {
    console.log(`Top S&P 500 loser: ${topLoser.symbol} ${topLoser.changesPercentage.toFixed(2)}%`);
  }

  return { topGainer, topLoser };
}

// Custom scheduled handler (called every 5 minutes by cron)
export async function customScheduledHandler(env: Env, scheduledTime?: number): Promise<void> {
  console.log('Stocks scheduled handler started');

  if (!env.FMP_API_KEY) {
    console.error('FMP_API_KEY not configured');
    return;
  }

  // Throttle to every 15 minutes (:00, :15, :30, :45)
  if (scheduledTime) {
    const currentTime = new Date(scheduledTime);
    const minutes = currentTime.getMinutes();
    const isQuarterHour = minutes % 15 === 0;
    if (!isQuarterHour) {
      console.log('Skipping stocks update (not :00, :15, :30, or :45)');
      return;
    }
  }

  // Load existing cached data
  const existingDataRaw = await env.CLOCK_DATA.get(kvKey);
  const existingData: CachedStocksData | null = existingDataRaw
    ? JSON.parse(existingDataRaw)
    : null;

  // Check if we need to update S&P 500 list (once per day)
  let sp500Symbols = existingData?.sp500Symbols || [];
  let sp500LastFetched = existingData?.sp500LastFetched;

  if (shouldUpdateSP500List(sp500LastFetched)) {
    try {
      sp500Symbols = await fetchSP500FromWikipedia();
      sp500LastFetched = new Date().toISOString();
      console.log('Updated S&P 500 constituent list from Wikipedia');
    } catch (error) {
      console.error('Failed to update S&P 500 list from Wikipedia:', error);
      // Continue with cached list if available
      if (sp500Symbols.length === 0) {
        console.error('No S&P 500 list available, cannot proceed');
        return;
      }
      console.log(`Using cached S&P 500 list (${sp500Symbols.length} symbols)`);
    }
  } else {
    console.log(`Using cached S&P 500 list (${sp500Symbols.length} symbols, last updated: ${sp500LastFetched})`);
  }

  // Check if market is open (skip check if called from test endpoint)
  const isTestInvocation = !scheduledTime;
  const marketOpen = isMarketOpen();

  if (!marketOpen && !isTestInvocation) {
    console.log('Market is closed, using cached data');

    // Only write to KV if something actually changed
    if (existingData) {
      const needsUpdate =
        existingData.marketClosed !== true ||  // Market status changed
        sp500LastFetched !== existingData.sp500LastFetched;  // S&P 500 list was updated

      if (needsUpdate) {
        const cachedData: CachedStocksData = {
          ...existingData,
          marketClosed: true,
          sp500Symbols,
          sp500LastFetched,
        };

        await env.CLOCK_DATA.put(kvKey, JSON.stringify(cachedData));
        console.log('Updated cached data with marketClosed flag');
      } else {
        console.log('Skipped KV write (no changes needed)');
      }
    }

    return;
  }

  // Market is open (or test mode) - fetch fresh data
  if (isTestInvocation) {
    console.log('Test invocation - bypassing market hours check');
  }

  try {
    const { topGainer, topLoser } = await fetchGainersLosers(env.FMP_API_KEY, sp500Symbols);

    // Smart caching: only write if data actually changed
    const dataChanged =
      !existingData ||
      existingData.topGainer?.symbol !== topGainer?.symbol ||
      existingData.topLoser?.symbol !== topLoser?.symbol ||
      existingData.marketClosed !== !marketOpen ||
      sp500LastFetched !== existingData.sp500LastFetched;

    if (dataChanged) {
      const newData: CachedStocksData = {
        topGainer,
        topLoser,
        lastUpdated: new Date().toISOString(),
        marketClosed: !marketOpen,
        sp500Symbols,
        sp500LastFetched,
      };

      await env.CLOCK_DATA.put(kvKey, JSON.stringify(newData));
      console.log('Updated stocks data');
    } else {
      console.log('Skipped stocks KV write (no changes)');
    }
  } catch (error) {
    console.error('Failed to fetch gainers/losers:', error);

    // Keep existing data on error, but update S&P 500 list if it was refreshed
    if (existingData && sp500LastFetched !== existingData.sp500LastFetched) {
      await env.CLOCK_DATA.put(kvKey, JSON.stringify({
        ...existingData,
        sp500Symbols,
        sp500LastFetched,
      }));
    }
  }
}

// No-op fetchData for compatibility with standard app pattern
export async function fetchData(env: Env): Promise<CachedStocksData | null> {
  const cachedData = await env.CLOCK_DATA.get(kvKey);
  return cachedData ? JSON.parse(cachedData) : null;
}

// Format response - converts stock data to LaMetric frames
export function formatResponse(data: CachedStocksData): LaMetricResponse {
  if (!data || (!data.topGainer && !data.topLoser)) {
    return createResponse([
      createFrame('No data', ICON_MARKET_CLOSED)
    ]);
  }

  const frames = [];

  // Top gainer
  if (data.topGainer) {
    const gainerText = `${data.topGainer.symbol} +${data.topGainer.changesPercentage.toFixed(1)}%`;
    frames.push(createFrame(gainerText, ICON_GAIN));
  }

  // Top loser
  if (data.topLoser) {
    const loserText = `${data.topLoser.symbol} ${data.topLoser.changesPercentage.toFixed(1)}%`;
    frames.push(createFrame(loserText, ICON_LOSS));
  }

  // Add market closed indicator if applicable
  if (data.marketClosed) {
    frames.push(createFrame('Market closed', ICON_MARKET_CLOSED));
  }

  return createResponse(frames);
}
