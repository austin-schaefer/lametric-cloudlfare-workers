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
wrangler dev

# Deploy to Cloudflare
wrangler deploy

# View live logs from deployed worker
wrangler tail

# KV namespace operations
wrangler kv:namespace create CLOCK_DATA
wrangler kv:key list --binding CLOCK_DATA
wrangler kv:key get --binding CLOCK_DATA "keyname"

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

## Adding New Apps

1. Create `src/apps/newapp.ts` following the module pattern
2. Register in `src/apps/index.ts`
3. Add required API keys: `wrangler secret put API_KEY_NAME`
4. Configure LaMetric device to poll `https://your-worker.workers.dev/apps/newapp`
