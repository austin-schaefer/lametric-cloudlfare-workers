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
```

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
- Calls each app's `fetchData()`
- Stores results in KV using the app's `kvKey`
- Includes error handling per-app (one failure shouldn't cascade)
- Logs all successes/failures

## Wrangler Configuration

`wrangler.toml` defines:
- KV namespace binding (name: `CLOCK_DATA`)
- Cron schedule in `triggers.crons`
- Environment-specific KV namespace IDs

Secrets (API keys) are set via `wrangler secret put` and accessed as `env.KEY_NAME`.

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

**Production testing:**
```bash
# Monitor live logs
wrangler tail --format pretty

# Test endpoints
curl https://your-worker.workers.dev/health
curl https://your-worker.workers.dev/apps/counter
```

## LaMetric Device Configuration

When creating a LaMetric app:
1. Select "Indicator app" or "Metric app"
2. Choose "Poll" as data source
3. Set URL to: `https://your-worker.workers.dev/apps/appname`
4. Set poll frequency (e.g., 1 minute)
5. Select "Predefined (LaMetric Format)" as data format
6. **Important:** Define a fallback frame (icon + text) - this displays if the API is unreachable. Example: any icon with text `#0` or `Loading...`
7. The fallback frame is required by LaMetric's UI but will be overridden by your API's actual data

## Adding New Apps

1. Create `src/apps/newapp.ts` following the module pattern
2. Register in `src/apps/index.ts`
3. Add required API keys: `wrangler secret put API_KEY_NAME`
4. Deploy: `wrangler deploy`
5. Configure LaMetric device to poll `https://your-worker.workers.dev/apps/newapp`
