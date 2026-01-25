# OSRS XP Tracker - LaMetric App

A LaMetric app that displays Old School RuneScape (OSRS) XP gains over configurable time periods using the WiseOldMan API.

## Features

- Track XP gains for any OSRS character
- Configurable time periods: day, week, or month
- Displays all 24 skills with custom icons
- Automatic data refresh every 5 minutes
- Supports multiple users tracking different characters
- XP values formatted with k/M/B suffixes

## How It Works

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   LaMetric  │────>│ Cloudflare Worker│────>│  KV Storage │
│   Device    │     │  (Request Handler)│     │             │
└─────────────┘     └──────────────────┘     └─────────────┘
                             ▲                        ▲
                             │                        │
                    ┌────────┴────────┐              │
                    │ Scheduled Worker│──────────────┘
                    │  (Every 5 min)  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ WiseOldMan API  │
                    └─────────────────┘
```

1. **User installs app** from LaMetric App Store with their OSRS username
2. **LaMetric device polls** your Cloudflare Worker: `https://your-worker.workers.dev/apps/osrs?username=USERNAME&period=day`
3. **First request** adds username to character registry, returns "Loading data..."
4. **Scheduled worker** (runs every 5 min) fetches XP gains from WiseOldMan API for all registered characters
5. **Subsequent requests** return cached XP data formatted as LaMetric frames
6. **Device displays** skill frames cycling through all 24 skills

## Publishing to LaMetric App Store

### Step 1: Deploy Your Cloudflare Worker

```bash
# Deploy to production
npx wrangler deploy

# Note your worker URL
# Example: https://lametric-osrs.your-subdomain.workers.dev
```

### Step 2: Create LaMetric Developer Account

1. Go to https://developer.lametric.com
2. Sign up or log in with your LaMetric account
3. Click "Create App"

### Step 3: Configure the App

#### Basic Information
- **App Name**: `OSRS XP Tracker`
- **Description**: `Track your Old School RuneScape XP gains over time. Displays all 24 skills with XP earned over the last day, week, or month.`
- **Category**: Games
- **App Icon**: Upload an OSRS-themed icon (optional)

#### Communication Type
- **Type**: **Poll**
- **URL**: `https://your-worker.workers.dev/apps/osrs?`
  - Replace `your-worker.workers.dev` with your actual Cloudflare Worker domain
  - **Important**: End the URL with `?` - LaMetric automatically appends parameters
- **Data Format**: **Predefined (LaMetric Format)**
- **Poll Frequency**: User-configurable (recommend default: 5 minutes)
- **How it works**: When you define parameters below, LaMetric automatically appends them like: `?&username=VALUE&period=VALUE`

#### User Parameters

**Parameter 1 - Username:**
- **Field Name**: `username`
- **Field Type**: Text
- **Display Name**: `OSRS Username`
- **Description**: `Your Old School RuneScape character name (spaces are OK)`
- **Required**: Yes
- **Placeholder**: `Enter username`
- **Note**: LaMetric automatically URL-encodes spaces and special characters

**Parameter 2 - Time Period:**
- **Field Name**: `period`
- **Field Type**: Dropdown
- **Display Name**: `Time Period`
- **Description**: `Track XP gains over this period`
- **Required**: Yes
- **Options**:
  - `day` - Last 24 hours
  - `week` - Last 7 days
  - `month` - Last 30 days
- **Default**: `day`

#### Fallback Frame
LaMetric requires a fallback frame for when the API is unreachable:
- **Icon**: `i3313` (or any icon)
- **Text**: `Loading...`

#### Example Final URL
When a user installs your app with username "Lynx Titan" and period "day", LaMetric will poll:
```
https://your-worker.workers.dev/apps/osrs?&username=Lynx%20Titan&period=day
```

For usernames without spaces (e.g., "Zezima"), LaMetric polls:
```
https://your-worker.workers.dev/apps/osrs?&username=Zezima&period=week
```

### Step 4: Test the App

Before publishing:

1. Click "Save" (saves as draft)
2. Click "Install on Device" to test privately
3. Enter a test username (e.g., "Lynx Titan")
4. Select a period (e.g., "day")
5. Verify the app appears on your LaMetric device
6. Wait 5 minutes for scheduled worker to fetch data
7. Verify skill frames display correctly

### Step 5: Publish

1. Once testing is successful, click "Publish"
2. LaMetric team reviews your app (usually 1-3 days)
3. Once approved, users can find it in the LaMetric App Store

## User Installation Experience

### For End Users

1. **Open LaMetric app** on mobile device
2. **Browse App Store** → Search for "OSRS XP Tracker"
3. **Install app** → Fill in configuration:
   - OSRS Username: `Lynx Titan`
   - Time Period: `day`
4. **Add to device** → Choose position on clock
5. **Wait ~5 minutes** for first data fetch
6. **Enjoy!** → Skill frames cycle automatically

### What Users See

First 5 minutes:
```
[Loading data...]
```

After scheduled worker runs:
```
[Overall: +139.9k]
[Attack: +20]
[Strength: +116]
[Defence: +40]
[Ranged: +68.9k]
... (24 skills total)
```

## Backend Architecture

### Character Registry
**KV Key**: `app:osrs:characters`
**Format**: JSON array of usernames
```json
["Lynx Titan", "Zezima", "TestUser"]
```

### Per-Character Data
**KV Keys**: `app:osrs:data:{username}:{period}`
**Format**: Cached WiseOldMan API response
```json
{
  "username": "Lynx Titan",
  "period": "day",
  "lastUpdated": "2026-01-24T12:00:00Z",
  "gains": {
    "startsAt": "2026-01-23T12:00:00Z",
    "endsAt": "2026-01-24T12:00:00Z",
    "data": {
      "skills": {
        "overall": {
          "experience": { "gained": 139900 }
        },
        "attack": {
          "experience": { "gained": 20 }
        }
        // ... all 24 skills
      }
    }
  }
}
```

### Request Flow

```
User's LaMetric Device
  │
  ├─> GET /apps/osrs?username=Lynx%20Titan&period=day
  │
  ├─> Worker checks KV for: app:osrs:data:Lynx Titan:day
  │
  ├─> If not found:
  │   ├─> Add "Lynx Titan" to character registry
  │   └─> Return: { "frames": [{ "text": "Loading data...", "icon": "i3313" }] }
  │
  └─> If found:
      ├─> Format 24 skills as LaMetric frames
      └─> Return: { "frames": [{ "text": "Overall: +139.9k", "icon": "i186" }, ...] }
```

### Scheduled Worker Flow

```
Cron Trigger (Every 5 minutes)
  │
  ├─> Fetch character registry from KV
  │   ["Lynx Titan", "Zezima"]
  │
  ├─> For each character:
  │   ├─> Fetch day/week/month gains from WiseOldMan API (parallel)
  │   ├─> Store at: app:osrs:data:{username}:day
  │   ├─> Store at: app:osrs:data:{username}:week
  │   └─> Store at: app:osrs:data:{username}:month
  │
  └─> Log results
```

## Skill Display Order

All 24 skills displayed in this exact order:

1. **Overall** (always first)
2. Combat: Attack, Strength, Defence, Ranged, Prayer, Magic
3. Support: Runecrafting, Construction, Hitpoints, Agility, Herblore
4. Gathering: Thieving, Crafting, Fletching, Slayer, Hunter
5. Production: Mining, Smithing, Fishing, Cooking, Firemaking
6. Other: Woodcutting, Farming, Sailing

## Skill Icons

Each skill has a custom LaMetric icon:

| Skill | Icon ID | Description |
|-------|---------|-------------|
| Overall | i186 | Trophy |
| Attack | i120 | Sword |
| Strength | i157 | Muscle |
| Defence | i155 | Shield |
| Ranged | i45 | Target |
| Prayer | i34 | Praying hands |
| Magic | i67 | Sparkles |
| ... | ... | ... |

*Note: Icon IDs may need adjustment based on LaMetric's icon gallery. Test on device to verify appearance.*

## Testing Locally

### Start Dev Server
```bash
# Terminal 1: Start dev server with scheduled event support
npx wrangler dev --local --test-scheduled
```

### Test Endpoints
```bash
# Terminal 2: Test various scenarios

# Test with new username (should show "Loading data...")
curl "http://localhost:8787/apps/osrs?username=Lynx%20Titan&period=day"

# Trigger scheduled worker to fetch data
curl "http://localhost:8787/__scheduled"

# Test again (should show skill data)
curl "http://localhost:8787/apps/osrs?username=Lynx%20Titan&period=day" | jq .

# Test different periods
curl "http://localhost:8787/apps/osrs?username=Lynx%20Titan&period=week" | jq .
curl "http://localhost:8787/apps/osrs?username=Lynx%20Titan&period=month" | jq .

# Test error cases
curl "http://localhost:8787/apps/osrs"  # Missing username
curl "http://localhost:8787/apps/osrs?username=Test&period=invalid"  # Invalid period
```

### Check KV Storage
```bash
# View character registry
npx wrangler kv:key get --binding CLOCK_DATA "app:osrs:characters"

# View specific character data
npx wrangler kv:key get --binding CLOCK_DATA "app:osrs:data:Lynx Titan:day"

# List all OSRS keys
npx wrangler kv:key list --binding CLOCK_DATA --prefix "app:osrs"
```

## Production Monitoring

### View Logs
```bash
# Stream live logs
npx wrangler tail --format pretty

# You'll see:
# - Character registrations: "Added Lynx Titan to character registry"
# - Scheduled runs: "Fetching data for 2 character(s): Lynx Titan, Zezima"
# - API calls: "✓ Updated Lynx Titan (day)"
# - Errors: "✗ Failed to update Zezima (week): ..."
```

### Test Production Endpoint
```bash
# Test your live worker
curl "https://your-worker.workers.dev/apps/osrs?username=Lynx%20Titan&period=day" | jq .

# Should return 24 skill frames
```

## WiseOldMan API Integration

### Endpoint
```
GET https://api.wiseoldman.net/v2/players/{username}/gained?period={period}
```

### Parameters
- `username`: OSRS username (URL encoded)
- `period`: `day`, `week`, or `month`

### Rate Limiting
- **Current**: No API key required, free public API
- **Future**: If WiseOldMan adds authentication:
  ```bash
  # Store API key
  npx wrangler secret put WISEOLDMAN_API_KEY

  # Code already supports env.WISEOLDMAN_API_KEY
  # Just uncomment the header in src/apps/osrs.ts
  ```

### Error Handling
- **404 (Player not found)**: Keeps in registry, logs warning, uses cached data
- **429 (Rate limited)**: Skips this run, retries in 5 minutes
- **Timeout**: Falls back to cached data
- **Invalid data**: Returns zero gains for all skills

## Scalability

### Storage
- Each character: ~30KB (3 periods × ~10KB)
- 100 characters: ~3MB total
- 1,000 characters: ~30MB total
- Well within Cloudflare KV limits (no issues expected)

### API Calls
- N characters × 3 periods × 12 runs/hour = 36N calls/hour
- 100 characters = 3,600 API calls/hour
- WiseOldMan API should handle this easily (free tier)

### Cost (Cloudflare)
- Free tier: 100,000 requests/day, 1GB storage
- Typical usage: <1,000 requests/day
- Cost: **$0/month** for most use cases

## Troubleshooting

### "Loading data..." Never Updates
- **Cause**: Scheduled worker hasn't run yet
- **Fix**: Wait up to 5 minutes for next cron trigger
- **Test**: Manually trigger with `curl http://localhost:8787/__scheduled` (local) or wait for next :00/:05/:10 interval (production)

### "No data available yet" Error
- **Cause**: KV cache is empty
- **Fix**: Wait for scheduled worker to populate data
- **Check**: `wrangler kv:key get --binding CLOCK_DATA "app:osrs:characters"`

### Character Not Updating
- **Cause**: WiseOldMan API error or player not tracked
- **Check logs**: `wrangler tail --format pretty`
- **Verify player exists**: Visit `https://wiseoldman.net/players/{username}`

### Icons Not Displaying Correctly
- **Cause**: Invalid icon IDs
- **Fix**: Test icons on LaMetric device, adjust IDs in `src/apps/osrs.ts`
- **Icon gallery**: https://developer.lametric.com/icons

## Support

### For End Users
- Report issues in your app's LaMetric App Store page
- Provide: OSRS username, time period, error message

### For Developers
- Check Cloudflare Worker logs: `wrangler tail`
- Check KV storage: `wrangler kv:key list`
- Verify WiseOldMan API status: https://wiseoldman.net

## License

This project follows the repository's license. WiseOldMan API is used under their terms of service.

## Credits

- **WiseOldMan API**: https://wiseoldman.net - OSRS player tracking
- **LaMetric**: https://lametric.com - Smart clock platform
- **Cloudflare Workers**: Serverless backend hosting
