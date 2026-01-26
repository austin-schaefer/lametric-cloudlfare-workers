# OSRS App

Displays Old School RuneScape XP gains from Wise Old Man API on LaMetric devices. Supports multiple display modes, all account types, and tracks skills, boss kills, clues, and rank changes.

## Display Modes & Parameters

| Parameter | Required | Default | Options |
|-----------|----------|---------|---------|
| `username` | Yes | - | OSRS username |
| `mode` | No | `allstats` | `allstats`, `top5`, `top10` |
| `period` | No | `day` | `day`, `week`, `month` |
| `accountType` | No | `regular` | `regular`, `ironman`, `HCiron`, `UIM`, `GIM`, `HCGIM`, `URGIM` |

**Display modes:**
- `allstats`: 30 frames split across odd/even minute rotations (15 frames each)
- `top5`: 6 frames (total XP + top 5 skills)
- `top10`: 11 frames (total XP + top 10 skills)

## Rate Limiting & Data Updates

Characters divided into 6 rotation groups, each updating every 30 minutes. Sequential processing with 700ms delays between API calls respects Wise Old Man's 100 req/min limit.

Smart caching only writes to KV when data changes, reducing writes by ~50%.

**Scaling:** With 6 groups, supports up to ~300 characters. For more, increase modulo in `src/scheduled.ts:customScheduledHandler`.

## Testing

Run comprehensive test suite (29 tests covering display modes, icons, account types, data formatting, parameter validation):

```bash
./test-osrs.sh prod   # Test production
./test-osrs.sh local  # Test local dev server
```

Requires `jq` (install: `brew install jq`).

**Register test accounts:**
```bash
./register-test-accounts.sh prod
```

Accounts update every 30 minutes after registration. Test suite skips accounts with no data yet.

## KV Storage

**Keys:**
- `app:osrs:characters` - Array of registered usernames
- `app:osrs:alldata` - Aggregated data for all characters and periods

**View registry:**
```bash
wrangler kv:key get --binding CLOCK_DATA 'app:osrs:characters'
```

**View all data:**
```bash
wrangler kv:key get --binding CLOCK_DATA 'app:osrs:alldata' | jq '.'
```

**Data structure:**
```json
{
  "username1": {
    "day": {username, period, lastUpdated, gains},
    "week": {...},
    "month": {...}
  }
}
```

Aggregated storage reduces KV writes from ~1,152/day to ~150-400/day.
