# Ticker (Personal Watchlist)

Displays daily % gain/loss for a hardcoded list of tickers on LaMetric devices.

## Tickers

| Display | Symbol | Asset |
|---------|--------|-------|
| SCHB | SCHB | Schwab US Broad Market ETF |
| QQQM | QQQM | Invesco Nasdaq-100 ETF |
| VXUS | VXUS | Vanguard Total International Stock ETF |
| VGK | VGK | Vanguard FTSE Europe ETF |
| BTC | BTCUSD | Bitcoin |
| GOLD | GCUSD | Gold Futures |

To change the list, edit the `TICKERS` array in `src/apps/ticker.ts`.

## Configuration

**Required secrets** (shared with Stoxx app):
```bash
# Production
wrangler secret put FMP_API_KEY

# Local dev (.dev.vars)
FMP_API_KEY=your-key-here
```

Get a free API key from [Financial Modeling Prep](https://financialmodelingprep.com).

**Enable app in wrangler.toml:**
```toml
[vars]
ENABLED_APPS = "counter,osrs,ticker"
```

## How It Works

**Update schedule:** Every 15 minutes, regardless of market hours.

**Smart caching:** Only writes to KV when any ticker's percentage changes (compared at 1 decimal precision). Typically ~48-96 writes/day.

**Data source:** FMP `/stable/quote` endpoint — one API call per update for all symbols.

**Note on gold:** `GC=F` (Yahoo Finance notation for Gold Futures) maps to `GCUSD` in FMP. If gold data doesn't appear, try `XAUUSD` (gold spot) in the `TICKERS` config.

## Output

One frame per ticker: e.g., `SCHB +1.2%` with up/down arrow icon.

- Green up arrow: positive day
- Red down arrow: negative day

## Testing

```bash
# Trigger scheduled handler locally (bypasses throttle)
curl http://localhost:8787/test/ticker

# Check output
curl http://localhost:8787/apps/ticker
```

## LaMetric Setup

1. Go to https://developer.lametric.com/applications
2. Create "Indicator App" or "Metric App"
3. Choose "Poll" data source
4. Configure:
   - URL: `https://your-worker.workers.dev/apps/ticker`
   - Poll frequency: 1-5 minutes
   - Data format: Predefined (LaMetric Format)
5. Define fallback frame (icon + text like "Loading...")
6. Publish and install
