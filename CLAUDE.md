# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Cloudflare Workers backend service for LaMetric Time clocks. The architecture uses scheduled workers to fetch data from external APIs, cache it in KV storage, and serve it to LaMetric devices on request.

## Architecture Pattern

```
[External APIs] → [Scheduled Worker (cron)] → [KV Store] ← [Request Handler] ← [LaMetric Clock]
```

- **Scheduled worker**: Cron-triggered fetches from external APIs, stores in KV
- **Request handler**: Serves cached KV data formatted for LaMetric protocol
- **KV Store**: Decouples fetching from serving, prevents rate limits

## Enabling/Disabling Apps

Apps can be toggled on/off via the `ENABLED_APPS` variable in `wrangler.toml`:

```toml
[vars]
ENABLED_APPS = "counter,osrs"
```

**How it works:**
- Apps listed in `ENABLED_APPS` are fully operational
- Apps not listed are completely disabled:
  - Scheduled worker skips them (no API fetches, no KV writes)
  - Request handler returns 404 for disabled apps
- Format: comma-separated list of app names
- Default: If `ENABLED_APPS` is not set, all apps are enabled
- Invalid app names in the list will be logged as warnings (helps catch typos)

**Example configurations:**
```toml
# Enable all apps
ENABLED_APPS = "counter,osrs"

# Enable only OSRS
ENABLED_APPS = "osrs"

# Enable only counter
ENABLED_APPS = "counter"
```

After changing `ENABLED_APPS`, deploy with `wrangler deploy` for changes to take effect.

## Development Commands

```bash
# Local development with hot reload
wrangler dev --local

# Local development with scheduled event testing
wrangler dev --local --test-scheduled

# Trigger scheduled event in local dev (when using --test-scheduled)
curl http://localhost:8787/__scheduled

# Login to Cloudflare (first time only)
wrangler login

# Deploy to Cloudflare
wrangler deploy

# View live logs from deployed worker
wrangler tail

# KV namespace operations
wrangler kv:namespace create CLOCK_DATA
wrangler kv:key list --binding CLOCK_DATA
wrangler kv:key get --binding CLOCK_DATA "keyname"
wrangler kv:key put --binding CLOCK_DATA "keyname" "value"

# Manage secrets
wrangler secret put KEY_NAME

# Run comprehensive test suite
./test-osrs.sh prod     # Test production
./test-osrs.sh local    # Test local dev server
./test-stoxx.sh prod    # Test stocks app
./test-stoxx.sh local   # Test stocks app locally
./test-weather.sh prod  # Test weather app
./test-weather.sh local # Test weather app locally
```

## Testing

The repository includes comprehensive test suites:

**`./test-osrs.sh [environment]`**
- Tests all three display modes (allstats, top5, top10)
- Validates parameter handling (mode, accountType, period)
- Checks frame counts, icons, and data formatting
- Environment: `prod` (default) or `local`

**Test coverage:**
- ✓ Display mode tests (15/6/11 frame counts)
- ✓ Icon tests (all frames have icons)
- ✓ Account type tests (7 account types with correct icons)
- ✓ Data format tests (skill names, XP formatting)
- ✓ Parameter validation tests (invalid inputs)
- ✓ Period tests (day/week/month)

**`./test-stoxx.sh [environment]`**
- Tests stocks app (S&P 500 gainers/losers)
- Validates JSON response structure
- Checks data formatting and icons
- Displays current market status
- Environment: `prod` (default) or `local`

**Test coverage:**
- ✓ Basic response validation
- ✓ Frame structure tests
- ✓ Icon validation (gain/loss icons)
- ✓ Market hours detection
- ✓ Data format validation (ticker symbols, percentages)

Run these test suites after making changes to ensure nothing breaks.

## LaMetric Response Protocol

The clock expects this JSON structure:

```json
{
  "frames": [
    {"text": "Hello", "icon": "i123"},
    {"text": "World", "icon": "a456"}
  ]
}
```

- Keep text to ~10-12 characters visible
- Icons: `i` prefix for static (i123), `a` prefix for animated (a456)
- Icons reference LaMetric's icon gallery

## App Module Pattern

Each app in `src/apps/` must export:

```typescript
export const name = "appname";
export const kvKey = "app:appname";
export async function fetchData(env: Env): Promise<RawData> { /* ... */ }
export function formatResponse(data: RawData): LaMetricResponse { /* ... */ }
```

This pattern allows the scheduled worker and request handler to process all apps uniformly through the registry in `src/apps/index.ts`.

## Request Routing

- `/apps/:appName` - Returns LaMetric-formatted JSON for the specified app
- `/health` - Health check endpoint

The request handler reads from KV; it does not fetch external APIs directly.

## Scheduled Worker Design

The cron handler (runs every 5 minutes by default):
- Iterates through all registered apps
- Calls each app's `fetchData()` or custom handler
- Stores results in KV using the app's `kvKey`
- Includes error handling per-app (one failure shouldn't cascade)
- Logs all successes/failures

### KV Write Optimizations

To stay within Cloudflare's free tier limit (1,000 writes/day), the scheduled worker implements:

1. **Throttling:** Counter app only updates once per hour (not every 5 minutes)
2. **Smart caching:** Only writes to KV if data actually changed
3. **Aggregated storage:** OSRS app stores all character data in a single KV entry (`app:osrs:alldata`) instead of separate keys per character/period
4. **Character rotation:** OSRS app divides characters into 6 rotation groups, updating each group every 30 minutes

**OSRS Data Structure:**
```json
{
  "username1": {
    "day": {username, period, lastUpdated, gains},
    "week": {username, period, lastUpdated, gains},
    "month": {username, period, lastUpdated, gains}
  },
  "username2": { ... }
}
```

This reduces writes from ~1,152/day to ~150-400/day depending on data change frequency.

### OSRS App Rate Limiting

The OSRS app implements sophisticated rate limiting to respect Wise Old Man's 100 requests/minute limit:

1. **Rotation groups:** Characters are hashed into 6 groups (0-5)
2. **30-minute cycles:** Each group updates every 30 minutes (6 groups × 5-min cron = 30 min)
3. **Sequential processing:** Characters processed one-at-a-time with 700ms delays between API calls
4. **Scalability:** With 500 characters:
   - 500 ÷ 6 groups = ~83 characters per group
   - 83 × 3 periods = 249 API requests per batch
   - 249 requests × 0.7s = ~175 seconds (under 3 minutes)
   - Well within 100 req/min limit and 5-minute cron window

This ensures the service scales gracefully without hitting rate limits or causing API abuse.

### Stocks App Market Hours Logic

The Stocks app (`stoxx`) tracks S&P 500 gainers and losers with intelligent market hours handling:

**Update frequency:**
- Runs every 15 minutes (:00, :15, :30, :45) during market hours
- Skips updates when market is closed

**Market hours detection:**
- US stock market hours: Monday-Friday, 9:30 AM - 4:00 PM Eastern Time
- Properly handles time zone conversion using `America/New_York`
- Outside market hours, returns cached data with `marketClosed: true` flag

**S&P 500 constituent list:**
- Fetched from Wikipedia once per 24 hours and cached in KV
- Source: `https://en.wikipedia.org/wiki/List_of_S%26P_500_companies`
- Parsed from HTML table, typically ~500 symbols
- Falls back to cached list if Wikipedia fetch fails
- Automatic updates without manual maintenance

**Data caching:**
- S&P 500 symbols: Updated once per day (24 hours)
- Gainers/losers: Updated every 15 minutes during market hours, filtered to S&P 500 only
- Single KV entry (`app:stoxx:data`) contains all data including cached symbol list
- Cached data shown outside market hours with closed indicator

**Smart caching to minimize KV writes:**
- Only writes to KV when data actually changes (top gainer/loser symbols change)
- Skips writes when market closed flag is already set (prevents ~512 unnecessary writes/week)
- Skips writes when S&P 500 list hasn't been updated
- Example: During a quiet 15-minute period, fetches data but skips KV write if same stocks on top

**API endpoints used:**
- Wikipedia: S&P 500 constituent list (free, once per day)
- FMP `/stable/biggest-gainers` - Top gainers, filtered to S&P 500
- FMP `/stable/biggest-losers` - Top losers, filtered to S&P 500

**Output format:**
- Frame 1: Top S&P 500 gainer (e.g., "NVDA +4.3%" with icon i72948)
- Frame 2: Top S&P 500 loser (e.g., "TSLA -3.7%" with icon i72947)
- Frame 3 (if market closed): "Market closed" with info icon

This approach minimizes API calls while providing timely S&P 500-specific updates during active trading hours.

### Weather App

The Weather app shows multi-city weather on the LaMetric clock. It's a personal (hardcoded) app, not published to the LaMetric store.

**Cities:** Portland OR, Los Angeles, NYC, Kailua-Kona HI, Vrsac Serbia

**API:** [Open-Meteo](https://open-meteo.com/) (free, no API key required)

**Frames per city (3 frames each):**
- High/Low: `72H / 55L`
- Current/Feels like: `69C, 65F` (C=Current, F=Feels)
- Condition: `CLEAR`, `RAIN`, `SNOW`, etc. (mapped from WMO weather codes)

**All temperatures in Fahrenheit.**

**Frame limit handling:**
- 5 cities × 3 frames = 15 frames (exactly at LaMetric limit)
- If cities exceed the limit, automatic rotation by minute parity (like OSRS odd/even)
- `MAX_CITIES_PER_PAGE = 5` (15 frames ÷ 3 frames/city)

**Update frequency:**
- Runs every 15 minutes (:00, :15, :30, :45)
- Smart caching: only writes KV if weather data actually changed
- ~96 API calls/day (5 cities × 4 updates/hour × ~5 hours of changes), well within Open-Meteo's 10,000/day limit

**Icons:** Each city has its own icon ID in the `CITIES` config. Update icon IDs in `src/apps/weather.ts` after finding/uploading city-specific icons in the LaMetric icon store.

**Adding/removing cities:** Edit the `CITIES` array in `src/apps/weather.ts`. If total cities > 5, frame rotation activates automatically.

## Wrangler Configuration

`wrangler.toml` defines:
- KV namespace binding (name: `CLOCK_DATA`)
- Cron schedule in `triggers.crons`
- Environment-specific KV namespace IDs

Secrets (API keys) are set via `wrangler secret put` and accessed as `env.KEY_NAME`.

### Required Secrets

**WISEOLDMAN_API_KEY** (OSRS app)
- Official Wise Old Man API key for enhanced rate limits and priority access
- Set in production: `wrangler secret put WISEOLDMAN_API_KEY`
- Set for local dev: Add `WISEOLDMAN_API_KEY=your-key-here` to `.dev.vars` file
- The app will work without the key but with lower rate limits

**FMP_API_KEY** (Stocks app)
- Financial Modeling Prep API key (free tier available at financialmodelingprep.com)
- Required for fetching S&P 500 gainers/losers data
- Set in production: `wrangler secret put FMP_API_KEY`
- Set for local dev: Add `FMP_API_KEY=your-key-here` to `.dev.vars` file
- The app requires this key to function

## Security and Secrets Management

**CRITICAL: This repository is public on GitHub. Never commit secrets.**

**Safe to commit:**
- KV namespace IDs (e.g., `d069416f7d2044eda76d4a0e8a1dde56`) - Just identifiers, useless without Cloudflare account access
- Worker URLs (already public by design)
- Source code without hardcoded credentials

**NEVER commit:**
- API keys or tokens
- Authentication credentials
- Private keys or certificates
- `.dev.vars` file (already in `.gitignore`)

**When adding new services/apps:**
1. **Never hardcode API keys** in source files
2. Use `wrangler secret put API_KEY_NAME` to store secrets securely in Cloudflare
3. Access secrets via `env.API_KEY_NAME` in your code
4. For local development, use `.dev.vars` file (gitignored):
   ```
   API_KEY_NAME=your-dev-key-here
   ```
5. Before committing, verify no secrets are included:
   ```bash
   git diff
   # Review all changes carefully
   ```

**Example of proper secret usage:**
```typescript
// ❌ WRONG - Never do this
const apiKey = "sk_live_12345...";

// ✅ CORRECT - Use environment variables
export async function fetchData(env: Env): Promise<Data> {
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${env.API_KEY_NAME}` }
  });
}
```

## Deployment Notes

**First-time deployment:**
1. Run `wrangler login` to authenticate
2. Register a workers.dev subdomain via Cloudflare dashboard (Workers & Pages section)
3. Run `wrangler deploy`
4. If scheduled worker hasn't run yet, manually seed KV: `wrangler kv:key put --binding CLOCK_DATA "app:appname" "initial_value"`

**Scheduled workers:**
- May take several minutes to activate after first deployment
- Run at the configured cron interval (:00, :05, :10, etc.)
- Manual KV seeding allows immediate testing without waiting for first cron run

## Testing

**Local testing:**
```bash
# Start dev server with scheduled event support
wrangler dev --local --test-scheduled

# In another terminal, trigger scheduled event
curl http://localhost:8787/__scheduled

# Test endpoints
curl http://localhost:8787/health
curl http://localhost:8787/apps/counter
```

**Testing apps with throttling (scryfall, counter, stoxx, etc.):**

Some apps use throttling in production to reduce KV writes. For local development, use test endpoints to bypass throttling:

```bash
# Directly invoke app's scheduled handler (skips throttling)
curl http://localhost:8787/test/scryfall
curl http://localhost:8787/test/osrs
curl http://localhost:8787/test/stoxx
curl http://localhost:8787/test/weather

# This populates KV immediately without waiting for scheduled updates
# Only works on localhost for security
```

This allows immediate testing without waiting for scheduled events or manually seeding KV data.

**Production testing:**
```bash
# Monitor live logs
wrangler tail --format pretty

# Test endpoints
curl https://your-worker.workers.dev/health
curl https://your-worker.workers.dev/apps/counter
```

## LaMetric Device Configuration

### Basic App Setup (No Parameters)

For apps without URL parameters (e.g., counter):
1. Select "Indicator app" or "Metric app"
2. Choose "Poll" as data source
3. Set URL to: `https://your-worker.workers.dev/apps/appname`
4. Set poll frequency (e.g., 1 minute)
5. Select "Predefined (LaMetric Format)" as data format
6. **Important:** Define a fallback frame (icon + text) - this displays if the API is unreachable. Example: any icon with text `#0` or `Loading...`
7. The fallback frame is required by LaMetric's UI but will be overridden by your API's actual data

### Apps with URL Parameters (Developer Portal)

For apps with configurable parameters (e.g., OSRS, Scryfall), configure in the LaMetric Developer Portal:

**CRITICAL: URL must end with `?` for validation**

When LaMetric validates your app configuration, it will test the URL with just the trailing `?`. Your app must handle this gracefully by using default parameter values.

**Example: OSRS App**
```
URL to get data from: https://your-worker.workers.dev/apps/osrs?
Sample params: &username=&period=day&mode=allstats&accountType=regular

Parameters:
- TEXT field: id=username, title=Username
- SINGLE CHOICE: id=period, title=Show gains from last..., choices=[day, week, month]
- SINGLE CHOICE: id=mode, title=Stats to display, choices=[allstats, top5, top10]
- SINGLE CHOICE: id=accountType, title=Account type (allstats icon), choices=[regular, ironman, HCiron, UIM, GIM, HCGIM, URGIM]
```

**Example: Scryfall App**
```
URL to get data from: https://your-worker.workers.dev/apps/scryfall?
Sample params: &cardType=paper&currency=usd

Parameters:
- SINGLE CHOICE: id=cardType, title=Card type, choices=[old-school, old-border, paper, any]
- SINGLE CHOICE: id=currency, title=Currency, choices=[usd, eur, tix, none]
```

**How parameter handling works:**
1. LaMetric appends parameters like `&param1=value1&param2=value2` to the URL
2. Your app receives requests like: `https://your-worker.workers.dev/apps/osrs?&username=PlayerName&period=day`
3. Parse query parameters with `url.searchParams.get('param')`
4. Provide sensible defaults for when parameters are missing (validation request)

## Adding New Apps

1. Create `src/apps/newapp.ts` following the module pattern
2. Register in `src/apps/index.ts`
3. Add app to `ENABLED_APPS` in `wrangler.toml`: `ENABLED_APPS = "counter,osrs,newapp"`
4. Add required API keys: `wrangler secret put API_KEY_NAME`
5. Deploy: `wrangler deploy`
6. Configure LaMetric device to poll `https://your-worker.workers.dev/apps/newapp`
