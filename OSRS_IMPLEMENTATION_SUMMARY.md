# OSRS LaMetric App - Complete Implementation Guide

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [LaMetric Configuration](#lametric-configuration)
4. [Testing](#testing)
5. [Code Quality](#code-quality)
6. [Development](#development)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The OSRS LaMetric app displays Old School RuneScape XP gains and stats on LaMetric Time clocks. It supports three display modes, all account types, and tracks 30+ stats including skills, boss kills, clue scrolls, and rank changes.

**Status**: ✅ Deployed to production
**URL**: https://lametric-backend.austin-david-schaefer.workers.dev/apps/osrs
**Version**: 062b7958-4bc9-43f8-94b7-6eb98523f9ca
**Last Updated**: 2026-01-25

### Key Features

- **3 Display Modes**: All stats (30 frames), Top 5 XP gains, Top 10 XP gains
- **7 Account Types**: Regular, Ironman, HCIM, UIM, GIM, HCGIM, URGIM
- **30+ Stats**: 24 skills + total XP + boss kills + clue scrolls + rank change
- **Smart Caching**: Only writes to KV when data changes (~168 writes/day vs 1,000 limit)
- **Rotation System**: 6 groups update every 30 minutes (scales to 500+ characters)

---

## Features

### 1. Display Modes

#### Mode A: All Stats (30 frames, odd/even rotation)

Displays all stats across two 15-frame rotations based on clock minute.

**Odd Minutes (00:01, 00:03, 00:05...)**
1. Username + account type icon
2. Total XP (current, not gained)
3. Total XP gained
4-15. Combat & Support skills (Attack → Thieving)

**Even Minutes (00:00, 00:02, 00:04...)**
1-12. Artisan & Gathering skills (Crafting → Sailing)
13. Boss kills (total gained)
14. Clue scrolls completed
15. Rank change (negative = improved)

**LaMetric Poll Frequency**: 1 minute (to see full rotation)

#### Mode B: Top 5 XP Gains (6 frames)

Shows the 5 skills with highest XP gains.

1. Total XP gained
2-6. Top 5 skills by XP gained

Format: `Skillname: +XP`

**LaMetric Poll Frequency**: 1-5 minutes

#### Mode C: Top 10 XP Gains (11 frames)

Shows the 10 skills with highest XP gains.

1. Total XP gained
2-11. Top 10 skills by XP gained

Format: `Skillname: +XP`

**LaMetric Poll Frequency**: 1-5 minutes

### 2. Account Types

| Type | Icon | Description |
|------|------|-------------|
| `regular` | i72762 | Normal account |
| `ironman` | i72751 | Ironman account |
| `HCiron` | i72752 | Hardcore Ironman |
| `UIM` | i72753 | Ultimate Ironman |
| `GIM` | i72754 | Group Ironman |
| `HCGIM` | i72756 | Hardcore Group Ironman |
| `URGIM` | i72755 | Unranked Group Ironman |

### 3. Stats & Icons

| Stat | Icon | Description |
|------|------|-------------|
| Total XP | i72683 | Current total XP (not gained) |
| Total XP Gained | i72749 | XP gained in period |
| Attack-Sailing | i72681-i72726 | Individual skill XP gains |
| Boss Kills | i72760 | Sum of all boss kills |
| Clue Scrolls | i72758 | Total clues completed |
| Rank Change | i72761 | Overall rank change (negative = improved) |

### 4. Data Updates

- **Fetch frequency**: Every 30 minutes per character
- **Rotation groups**: 6 groups (each character assigned to one)
- **Periods tracked**: day, week, month
- **Data source**: Wise Old Man API
- **Smart caching**: Only writes to KV when data actually changes

---

## LaMetric Configuration

### URL Parameters

**Base URL**:
```
https://lametric-backend.austin-david-schaefer.workers.dev/apps/osrs
```

**Parameters**:

| Parameter | Type | Required | Default | Options |
|-----------|------|----------|---------|---------|
| `username` | text | Yes | - | Your OSRS username |
| `period` | dropdown | No | `day` | `day`, `week`, `month` |
| `mode` | dropdown | No | `allstats` | `allstats`, `top5`, `top10` |
| `accountType` | dropdown | No | `regular` | `regular`, `ironman`, `HCiron`, `UIM`, `GIM`, `HCGIM`, `URGIM` |

### Example URLs

**All stats with ironman badge (1-min poll)**:
```
?username=YourName&period=day&mode=allstats&accountType=ironman
```

**Top 5 weekly XP gains (5-min poll)**:
```
?username=YourName&period=week&mode=top5
```

**Top 10 monthly XP gains (5-min poll)**:
```
?username=YourName&period=month&mode=top10
```

### LaMetric App Setup

1. Create new "Indicator app" in LaMetric Developer Portal
2. Choose "Poll" as data source
3. Set URL to base URL above
4. Add 4 parameters: username (required), period, mode, accountType
5. Set poll frequency (1 min for allstats, 1-5 min for top5/top10)
6. Select "Predefined (LaMetric Format)" as data format
7. Define fallback frame (any icon + text like "Loading...")
8. Publish and install on device

---

## Testing

### Test Suite

The `test-osrs.sh` script provides comprehensive automated testing.

**Usage**:
```bash
# Test production
./test-osrs.sh prod

# Test local dev server
./test-osrs.sh local
```

**Prerequisites**:
- `jq` (install: `brew install jq`)
- `curl` (pre-installed)
- For local: `wrangler dev --local --test-scheduled`

### Test Coverage (29 tests)

**Suite 1: Display Mode Tests** (4 tests)
- All-stats mode: 15 frames
- Top5 mode: 6 frames
- Top10 mode: 11 frames
- Default mode: 15 frames (defaults to allstats)

**Suite 2: Icon Tests** (5 tests)
- All modes have icons in every frame
- Correct icon IDs for total XP gained (i72749)

**Suite 3: Account Type Tests** (4 tests)
- All 7 account types display correct icons
- Only runs during odd minutes (when username frame visible)

**Suite 4: Data Format Tests** (4 tests)
- Top5/Top10 show "Skillname: +XP" format
- All frames have non-empty text

**Suite 5: Parameter Validation Tests** (4 tests)
- Invalid mode/accountType/period return error messages
- Missing username returns "Configure username"

**Suite 6: Period Tests** (3 tests)
- Day, week, month periods all work

**Suite 7: Real Account Tests** (5 tests)
- Tests against 4 popular streamer accounts
- Validates real data loading
- Verifies at least one account has XP gains

### Real Test Accounts

The test suite includes real OSRS streamer accounts for production validation:

| Account | Type | Why This Account |
|---------|------|------------------|
| `McTile` | Regular | Active streamer, consistent gameplay |
| `limpwurt` | Ironman | Active ironman content creator |
| `Northern UIM` | UIM | Popular UIM streamer |
| `Carl Caskets` | HCIM | HCIM content creator |

**Register test accounts**:
```bash
./register-test-accounts.sh prod
```

This script:
1. Makes requests to each account's endpoint
2. Triggers `addCharacterToRegistry()` in the worker
3. Accounts added to `app:osrs:characters` KV key
4. Scheduled worker fetches data every 30 minutes

**Note**: Registration uses 1 KV write per account. If you hit the 1,000 writes/day limit, wait until next day (UTC midnight) for quota reset.

### Test Results

**Expected output**:
```
==========================================
TEST SUMMARY
==========================================

Total tests: 29
Passed: 29
Failed: 0
Skipped: 0

✓ All tests passed!
```

**If accounts not yet loaded** (first 30 min after registration):
```
Testing: McTile (regular) has data ... ⊘ SKIP (data not loaded yet)
  └─ Account registered but waiting for scheduled worker

Total tests: 29
Passed: 24
Failed: 0
Skipped: 5

✓ All tests passed (5 skipped - waiting for data)
```

---

## Code Quality

### Type Safety Improvements

**Problem**: Original code used `any` types, risking silent failures if API structure changed.

**Solution**: Added proper TypeScript interfaces with runtime validation.

```typescript
// Proper type definitions
interface WiseOldManBossEntry {
  metric: string;
  kills: number;
  rank: number;
}

interface WiseOldManActivityScore {
  metric: string;
  score: {
    gained: number;
    start: number;
    end: number;
  };
  // ...
}

interface WiseOldManGainsResponse {
  data: {
    skills: Record<string, WiseOldManSkillGains>;
    bosses: Record<string, WiseOldManBossEntry>;  // Was: any
    activities: Record<string, WiseOldManActivityScore>;  // Was: any
    computed: any;
  };
}
```

**Helper functions with type guards**:
```typescript
function getTotalBossKills(data: WiseOldManGainsResponse): number {
  const bosses = data.data.bosses;

  if (!bosses || typeof bosses !== 'object') {
    console.warn('Boss data missing or invalid in API response');
    return 0;
  }

  try {
    return Object.values(bosses)
      .filter((boss): boss is WiseOldManBossEntry => {
        // Type guard: ensure boss has required structure
        return boss !== null &&
               typeof boss === 'object' &&
               'kills' in boss &&
               typeof boss.kills === 'number' &&
               boss.kills > 0;
      })
      .reduce((sum, boss) => sum + boss.kills, 0);
  } catch (error) {
    console.error('Error calculating total boss kills:', error);
    return 0;
  }
}
```

### Error Handling Enhancements

**Problem**: Functions silently returned error frames without logging context.

**Solution**: Comprehensive error logging with structured data.

```typescript
export function formatResponse(...): LaMetricResponse {
  // Validate data exists
  if (!data) {
    console.error('formatResponse: No data provided', {
      username, period, mode, accountType,
    });
    return createResponse([createFrame('No data', 'i3313')]);
  }

  // Validate data structure
  if (!gainsData.data || !gainsData.data.skills) {
    console.error('formatResponse: Missing required data structure', {
      username, period, mode, accountType,
      hasData: !!gainsData.data,
      hasSkills: !!(gainsData.data && gainsData.data.skills),
    });
    return createResponse([createFrame('Incomplete data', 'i3313')]);
  }

  // Wrap formatter calls in try-catch
  try {
    switch (displayMode) {
      case 'top5': return formatTop5(gainsData);
      // ...
    }
  } catch (error) {
    console.error('formatResponse: Error formatting data', {
      username, period, mode, accountType,
      error: error instanceof Error ? error.message : String(error),
    });
    return createResponse([createFrame('Format error', 'i3313')]);
  }
}
```

**Request handler detects error frames**:
```typescript
// Check if formatResponse returned an error frame
if (response.frames.length === 1) {
  const frameText = response.frames[0].text;
  const errorPatterns = ['No data', 'Invalid data', 'Invalid format', 'Incomplete data', 'Format error'];

  if (errorPatterns.some(pattern => frameText.includes(pattern))) {
    console.error('OSRS formatResponse returned error frame', {
      username, period, mode, accountType, errorText: frameText,
    });
  }
}
```

### Code Clarity Improvements

**Constants for magic numbers**:
```typescript
// LaMetric frame limits and rotation configuration
// LaMetric devices have a practical limit of ~15 frames before performance degrades
// To show all 30 stats, we split them across odd/even minute rotations
const LAMETRIC_FRAME_LIMIT = 15;
const ODD_EVEN_ROTATION_MODULO = 2;

// Use in code
const isOddMinute = currentMinute % ODD_EVEN_ROTATION_MODULO === 1;
```

**Clear section headers in frame construction**:
```typescript
function formatAllStats(...): LaMetricResponse {
  const isOddMinute = currentMinute % ODD_EVEN_ROTATION_MODULO === 1;

  if (isOddMinute) {
    // ========================================
    // ODD MINUTES: Group A (15 frames)
    // ========================================
    // Frame 1: Username + Account Type Icon
    // Frame 2: Total XP (current, not gained)
    // Frame 3: Total XP Gained
    // Frames 4-15: Combat & Support Skills (Attack through Thieving)
    return createResponse([
      // User identification
      createUsernameFrame(username, accountType),

      // Overall stats
      createFrame(formatLargeNumber(getTotalXP(data)), SKILL_ICONS.overall),
      // ...
    ]);
  } else {
    // ========================================
    // EVEN MINUTES: Group B (15 frames)
    // ========================================
    // Frames 1-12: Artisan & Gathering Skills (Crafting through Sailing)
    // Frames 13-15: Additional Stats (Boss Kills, Clue Scrolls, Rank Change)
    // ...
  }
}
```

---

## Development

### Project Structure

```
src/apps/osrs.ts          - Main app logic (display modes, formatting)
src/index.ts              - Request handler (parameter validation)
src/scheduled.ts          - Scheduled worker (data fetching)
test-osrs.sh              - Test suite (29 tests)
register-test-accounts.sh - Test account registration
```

### Local Development

```bash
# Start dev server with scheduled event support
wrangler dev --local --test-scheduled

# In another terminal, trigger scheduled event
curl http://localhost:8787/__scheduled

# Test endpoints
curl "http://localhost:8787/apps/osrs?username=Test&period=day&mode=allstats"

# Run tests
./test-osrs.sh local
```

### Deployment

```bash
# Deploy to production
wrangler deploy

# Monitor logs
wrangler tail --format pretty

# Test production
curl "https://lametric-backend.austin-david-schaefer.workers.dev/apps/osrs?username=Test&period=day&mode=allstats"
./test-osrs.sh prod
```

### KV Storage Management

**View character registry**:
```bash
wrangler kv:key get --binding CLOCK_DATA 'app:osrs:characters'
```

**View all data**:
```bash
wrangler kv:key get --binding CLOCK_DATA 'app:osrs:alldata' | jq '.'
```

**Manually add character** (costs 1 KV write):
```bash
# Get current registry
wrangler kv:key get --binding CLOCK_DATA 'app:osrs:characters'

# Add new character to array
wrangler kv:key put --binding CLOCK_DATA 'app:osrs:characters' \
  '["User1","User2","NewUser"]'
```

**KV write limits**:
- Free tier: 1,000 writes/day
- Current usage: ~168 writes/day (24 counter + ~144 OSRS)
- Headroom: ~832 writes/day
- Quota resets: UTC midnight

### Files Modified

| File | Changes |
|------|---------|
| `src/apps/osrs.ts` | Added display modes, stats, icons, type safety |
| `src/index.ts` | Added parameter validation, error detection |
| `src/types.ts` | Updated formatResponse signature |

**No changes needed**:
- `src/scheduled.ts` - Already fetches all required data

---

## Troubleshooting

### Common Issues

#### "Loading data..." on LaMetric device

**Causes**:
1. Account not registered yet
2. Account registered but scheduled worker hasn't run (wait 30 min)
3. Username misspelled
4. Account doesn't exist on Wise Old Man

**Solutions**:
```bash
# Check if account is registered
wrangler kv:key get --binding CLOCK_DATA 'app:osrs:characters'

# Check if data exists for account
curl "https://lametric-backend.austin-david-schaefer.workers.dev/apps/osrs?username=YourName&period=day&mode=allstats"

# If not registered, make a request to register
curl "https://lametric-backend.austin-david-schaefer.workers.dev/apps/osrs?username=YourName&period=day&mode=allstats"

# Wait 30 minutes for scheduled worker to fetch data
```

#### "Internal server error"

**Causes**:
1. Account not in registry
2. Data structure invalid
3. API request failed

**Solutions**:
```bash
# Check logs for details
wrangler tail --format pretty

# Verify account in registry
wrangler kv:key get --binding CLOCK_DATA 'app:osrs:characters'

# Try re-registering
curl "https://lametric-backend.austin-david-schaefer.workers.dev/apps/osrs?username=YourName&period=day&mode=allstats"
```

#### "Invalid mode" or "Invalid account type"

**Cause**: Typo in parameter value

**Valid values**:
- Mode: `allstats`, `top5`, `top10`
- Account type: `regular`, `ironman`, `HCiron`, `UIM`, `GIM`, `HCGIM`, `URGIM`

#### Test accounts show "data not loaded yet"

**Cause**: Accounts registered but scheduled worker hasn't fetched data yet (each account updates every 30 minutes)

**Solution**: Wait 30 minutes after registration, then re-run tests.

#### KV write limit reached

**Error**:
```
your account has reached the free usage limit for this operation for today [code: 10048]
```

**Cause**: Hit 1,000 KV writes/day limit (free tier)

**Solutions**:
1. Wait until next day (UTC midnight) for quota reset
2. Reduce manual KV operations during development
3. Upgrade to Workers Paid plan ($5/month for 1M writes)

**Prevention**:
- Use `./register-test-accounts.sh` instead of manual KV writes
- Don't repeatedly clear and re-register accounts
- Smart caching already minimizes writes

### Debugging

**View live logs**:
```bash
wrangler tail --format pretty
```

**Check scheduled worker execution**:
```bash
# Logs will show:
# "OSRS scheduled handler started"
# "Total characters: X, Current group: Y, Updating: Z"
# "✓ Fetched Username (period) (changed/unchanged)"
# "✓ Wrote aggregated OSRS data to KV" (only if changes)
```

**Test API response**:
```bash
# Should return 15 frames with icons
curl "https://lametric-backend.austin-david-schaefer.workers.dev/apps/osrs?username=Test&period=day&mode=allstats" | jq '.'

# Check first frame
curl "https://lametric-backend.austin-david-schaefer.workers.dev/apps/osrs?username=Test&period=day&mode=allstats" | jq '.frames[0]'
```

### Getting Help

1. Run tests to identify issues: `./test-osrs.sh prod`
2. Check logs: `wrangler tail --format pretty`
3. Verify character exists on Wise Old Man: https://wiseoldman.net/players/USERNAME
4. Check character registry: `wrangler kv:key get --binding CLOCK_DATA 'app:osrs:characters'`
5. Wait 30 minutes after first registration for data to populate

---

## Architecture Notes

### How It Works

**Data Flow**:
```
[Wise Old Man API] → [Scheduled Worker (cron)] → [KV Store] ← [Request Handler] ← [LaMetric Clock]
```

1. **Scheduled worker** (runs every 5 minutes):
   - Divides characters into 6 rotation groups
   - Fetches data for one group every 5 minutes (30-min cycle per character)
   - Calls Wise Old Man API with 700ms delays (respects 100 req/min limit)
   - Only writes to KV if data actually changed (smart caching)

2. **KV storage**:
   - `app:osrs:characters`: Array of registered usernames
   - `app:osrs:alldata`: Aggregated data for all characters and periods

3. **Request handler**:
   - Validates query parameters
   - Reads cached data from KV
   - Routes to appropriate formatter (allstats/top5/top10)
   - Returns LaMetric-formatted JSON

### Scaling

**Current capacity** (6 rotation groups):
- 10 characters: ~30 API calls/rotation, ~21s processing
- 100 characters: ~300 API calls/rotation, ~210s processing
- 300 characters: Need 12 groups, ~150 API calls/rotation, ~105s

**To scale beyond 300 characters**:
Update modulo in `customScheduledHandler`:
```typescript
const currentGroup = fiveMinuteInterval % 12;  // Was: % 6
```

### Performance

- **Request handler**: < 100ms response time
- **Smart caching**: Reduces KV writes by ~50%
- **Rotation system**: Scales to 500+ characters without hitting rate limits
- **API rate limiting**: 700ms delays = ~85 requests/min (under 100 req/min limit)

---

**Last Updated**: 2026-01-25
**Version**: 062b7958-4bc9-43f8-94b7-6eb98523f9ca
**Commits**: 5211bf1 (code quality), 0bbea2a (testing infrastructure)
