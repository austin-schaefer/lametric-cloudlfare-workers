# LaMetric Clock Backend

A simple backend service for LaMetric Time clocks using Cloudflare Workers and KV storage. This handles API calls and data caching so the clock just reads pre-fetched data.

## Architecture Overview

```
[External APIs] → [Scheduled Worker (cron)] → [KV Store] ← [Request Handler] ← [LaMetric Clock]
```

- **Scheduled worker**: Runs on a cron schedule, fetches data from external APIs, stores in KV
- **Request handler**: Responds to clock requests by reading from KV and formatting for LaMetric
- **KV Store**: Caches all data so clock requests are fast and don't hit rate limits

## Technical Requirements

- Cloudflare Workers (free tier: 100k requests/day)
- Cloudflare KV for storage
- TypeScript
- Wrangler CLI for deployment

## Project Structure

```
lametric-backend/
├── src/
│   ├── index.ts              # Main entry: routing and request handling
│   ├── scheduled.ts          # Cron job logic for all API fetches
│   ├── types.ts              # TypeScript types for LaMetric responses, app configs
│   ├── utils/
│   │   └── lametric.ts       # Helper to format LaMetric JSON responses
│   └── apps/
│       ├── index.ts          # App registry and routing
│       └── example.ts        # Example app module (template for others)
├── wrangler.toml             # Cloudflare config: KV bindings, crons, routes
├── package.json
├── tsconfig.json
└── README.md
```

## LaMetric Response Format

The clock expects JSON in this format:

```json
{
  "frames": [
    {
      "text": "Hello",
      "icon": "i123"
    },
    {
      "text": "World",
      "icon": "i456"
    }
  ]
}
```

- `frames`: Array of frames that cycle on the clock
- `text`: Display text (keep short, ~10-12 chars visible)
- `icon`: Icon ID from LaMetric's icon gallery (format: `i` + number, or `a` + number for animated)
- Optional: `goalData`, `chartData` for other widget types

## Implementation Details

### Entry Point (src/index.ts)

Handle two types of requests:
1. **App endpoints**: `/apps/:appName` - Returns LaMetric-formatted JSON for a specific app
2. **Health check**: `/health` - Simple status endpoint

Use the URL path to route to the appropriate app handler.

### Scheduled Worker (src/scheduled.ts)

- Export a `scheduled` handler that runs on cron triggers
- Fetch data from all configured external APIs
- Store results in KV with appropriate keys (e.g., `app:weather`, `app:stocks`)
- Include error handling so one failed API doesn't break others
- Log successes/failures for debugging

### App Module Pattern (src/apps/example.ts)

Each app module should export:
- `name`: String identifier for routing
- `fetchData(env)`: Async function to fetch from external API(s)
- `formatResponse(data)`: Function to convert raw data to LaMetric frames
- `kvKey`: String key for KV storage

### Utility Functions (src/utils/lametric.ts)

Create helpers for:
- `createFrame(text, icon)`: Build a single frame object
- `createResponse(frames)`: Wrap frames array in response object
- `truncateText(text, maxLength)`: Safely truncate for display

### Types (src/types.ts)

Define interfaces for:
- `LaMetricFrame`: Single frame with text, icon, optional goal/chart data
- `LaMetricResponse`: The full response with frames array
- `AppConfig`: Configuration for each app module
- `Env`: Cloudflare Worker environment with KV binding

## Wrangler Configuration

The `wrangler.toml` should include:

```toml
name = "lametric-backend"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# KV namespace binding
[[kv_namespaces]]
binding = "CLOCK_DATA"
id = "your-kv-namespace-id"

# Cron triggers - runs every 5 minutes
[triggers]
crons = ["*/5 * * * *"]

# Environment variables for API keys (set via wrangler secret)
# Access in code as env.WEATHER_API_KEY, etc.
```

## Example App: Simple Counter

As a starting point, implement a simple counter app that:
1. Stores a number in KV
2. Increments it each time the cron runs
3. Returns the current count to the clock

This tests the full flow without needing external APIs.

## Adding New Apps Later

To add a new app:
1. Create a new file in `src/apps/`
2. Implement the app module pattern (fetchData, formatResponse, kvKey)
3. Register it in `src/apps/index.ts`
4. Add any required API keys as secrets via `wrangler secret put KEY_NAME`

## Deployment Steps

1. Create the KV namespace: `wrangler kv:namespace create CLOCK_DATA`
2. Update `wrangler.toml` with the returned namespace ID
3. Deploy: `wrangler deploy`
4. Note the deployed URL (e.g., `https://lametric-backend.username.workers.dev`)
5. Configure LaMetric app to poll `https://your-url.workers.dev/apps/appname`

## Development Commands

- `wrangler dev`: Local development server
- `wrangler deploy`: Deploy to Cloudflare
- `wrangler tail`: View live logs
- `wrangler kv:key list --binding CLOCK_DATA`: List KV keys
- `wrangler kv:key get --binding CLOCK_DATA "keyname"`: Read a KV value

## Initial Task

Scaffold the project with:
1. Basic project structure and config files
2. Working request handler with routing
3. Scheduled handler that runs on cron
4. The simple counter example app
5. Type definitions
6. Utility functions

Keep it minimal and well-organized so adding real apps later is straightforward.
