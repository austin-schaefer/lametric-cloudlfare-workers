# Weather (Multi-City)

Displays weather for multiple hardcoded cities on LaMetric devices. Personal app, not published to the store.

## Configuration

**No API key required.** Uses [Open-Meteo](https://open-meteo.com/) (free, no signup).

**Enable app in wrangler.toml:**
```toml
[vars]
ENABLED_APPS = "counter,osrs,stoxx,weather"
```

**Customize cities** in `src/apps/weather.ts`:
```typescript
const CITIES: CityConfig[] = [
  { name: 'Portland', lat: 45.5152, lon: -122.6784, icon: 'i2056' },
  // Add/remove cities here
];
```

**Customize icons:** Replace `i2056` with city-specific icon IDs from the LaMetric icon store.

## How It Works

**Update schedule:**
- Every 15 minutes (:00, :15, :30, :45)
- Smart caching: skips KV write if weather hasn't changed

**Frame limit handling:**
- 5 cities x 3 frames = 15 (exactly at LaMetric limit)
- Adding a 6th+ city activates automatic page rotation by minute

**All temperatures in Fahrenheit.**

## Output

3 frames per city:
- High/Low: `H48 L35`
- Now/Feels like: `N42 F38` (N=Now, F=Feels)
- Condition: `RAIN`, `CLEAR`, `SNOW`, `PTLY CLDY`, etc.

## Testing

```bash
# Test production
./test-weather.sh prod

# Test local
./test-weather.sh local

# Test scheduled handler directly (bypasses throttle)
curl http://localhost:8787/test/weather
```

## LaMetric Setup

1. Go to https://developer.lametric.com/applications
2. Create "Indicator App" or "Metric App"
3. Choose "Poll" data source
4. Configure:
   - URL: `https://your-worker.workers.dev/apps/weather`
   - Poll frequency: 1-5 minutes
   - Data format: Predefined (LaMetric Format)
5. Define fallback frame (icon + text like "Loading...")
6. Publish and install
