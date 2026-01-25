# LaMetric Clock Backend

A Cloudflare Workers backend service for LaMetric Time clocks. Fetches data from external APIs on a schedule, caches it in KV storage, and serves it to LaMetric devices.

**Live URL:** https://lametric-backend.austin-david-schaefer.workers.dev

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Login to Cloudflare (first time only):
   ```bash
   npx wrangler login
   ```

3. Register a workers.dev subdomain:
   - Visit the [Cloudflare dashboard](https://dash.cloudflare.com/)
   - Go to Workers & Pages
   - Register your workers.dev subdomain (e.g., `yourname.workers.dev`)

4. Create a KV namespace:
   ```bash
   npx wrangler kv:namespace create CLOCK_DATA
   ```

5. Update `wrangler.toml` with the KV namespace ID from step 4

6. Deploy:
   ```bash
   npm run deploy
   ```

7. (Optional) Seed initial data if scheduled worker hasn't run yet:
   ```bash
   npx wrangler kv:key put --binding CLOCK_DATA "app:counter" "0"
   ```

## Development

Run locally with hot reload and scheduled event support:
```bash
npx wrangler dev --local --test-scheduled
```

In another terminal, trigger the scheduled worker:
```bash
curl http://localhost:8787/__scheduled
```

Test endpoints:
```bash
curl http://localhost:8787/health
curl http://localhost:8787/apps/counter
```

## LaMetric Device Configuration

1. Go to https://developer.lametric.com/applications
2. Create a new "Indicator App" or "Metric App"
3. Choose "Poll" as the data source
4. Configure:
   - **URL:** `https://your-worker.workers.dev/apps/counter`
   - **Poll frequency:** 1 minute (or your preference)
   - **Data format:** Predefined (LaMetric Format)
5. Define a fallback frame:
   - **Icon:** Select any icon you like
   - **Text:** `#0` or `Loading...`
   - This frame only displays if your API is unreachable
6. Publish and install the app on your LaMetric device

## How It Works

- **Scheduled worker** runs every 5 minutes (configured in `wrangler.toml`)
- Fetches/updates data and stores in KV
- LaMetric device polls the `/apps/counter` endpoint
- Returns cached data formatted as LaMetric frames
- Counter increments automatically: `#1`, `#2`, `#3`, etc.
- Random icon from LaMetric's gallery on each request

## Monitoring

View live logs from your deployed worker:
```bash
npx wrangler tail --format pretty
```

## Adding New Apps

See `CLAUDE.md` for the app module pattern and instructions.
