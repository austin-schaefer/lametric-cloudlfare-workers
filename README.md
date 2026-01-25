# LaMetric Clock Backend

A Cloudflare Workers backend service for LaMetric Time clocks. Fetches data from external APIs on a schedule, caches it in KV storage, and serves it to LaMetric devices.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a KV namespace:
   ```bash
   wrangler kv:namespace create CLOCK_DATA
   ```

3. Update `wrangler.toml` with the KV namespace ID from step 2

4. Deploy:
   ```bash
   npm run deploy
   ```

## Development

Run locally with hot reload:
```bash
npm run dev
```

## Usage

Configure your LaMetric device to poll:
```
https://your-worker.workers.dev/apps/counter
```

The counter app increments every 5 minutes when the scheduled worker runs.

## Adding New Apps

See `CLAUDE.md` for the app module pattern and instructions.
