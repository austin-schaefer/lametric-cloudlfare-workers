# Stoxx (S&P 500 Stocks)

Displays top S&P 500 gainer and loser on LaMetric devices.

## Configuration

**Required secrets:**
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
ENABLED_APPS = "counter,osrs,stoxx"
```

## How It Works

**Update schedule:**
- Every 15 minutes during market hours (Mon-Fri, 9:30 AM - 4:00 PM ET)
- Skips updates when market closed

**S&P 500 constituents:**
- Fetched from Wikipedia once per day
- ~500 symbols cached in KV
- Falls back to cached list if Wikipedia unavailable

**Data sources:**
- Wikipedia: S&P 500 constituent list
- FMP API: `/stable/biggest-gainers` and `/stable/biggest-losers`

**Smart caching:**
- Only writes to KV when data changes (top symbols change)
- Skips writes when market closed flag already set
- Reduces KV writes to ~200-300/day

## Output

- Frame 1: Top S&P 500 gainer (e.g., "NVDA +4.3%")
- Frame 2: Top S&P 500 loser (e.g., "TSLA -3.7%")
- Frame 3 (if closed): "Market closed"

## Testing

```bash
# Test production
./test-stoxx.sh prod

# Test local
./test-stoxx.sh local

# Test scheduled handler directly (bypasses market hours check)
curl http://localhost:8787/test/stoxx
```

## LaMetric Setup

1. Go to https://developer.lametric.com/applications
2. Create "Indicator App" or "Metric App"
3. Choose "Poll" data source
4. Configure:
   - URL: `https://your-worker.workers.dev/apps/stoxx`
   - Poll frequency: 1-5 minutes
   - Data format: Predefined (LaMetric Format)
5. Define fallback frame (icon + text like "Loading...")
6. Publish and install
