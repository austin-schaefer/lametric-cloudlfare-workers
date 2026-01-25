# OSRS Multi-Mode Display Implementation - Complete

## ✅ Implementation Status: DEPLOYED

The OSRS LaMetric app has been successfully refactored to support three display modes with optimized KV storage.

## What Was Implemented

### 1. Three Display Modes

**Mode A: All Stats (30 frames, rotated by odd/even minute)**
- **Odd minutes (15 frames)**: Username + account type icon, Total XP, Total XP gained, Attack through Thieving
- **Even minutes (15 frames)**: Crafting through Sailing, Boss kills, Clue scrolls, Rank change
- **Poll frequency**: Recommend 1 minute to see full rotation

**Mode B: Top 5 XP Gains (6 frames)**
- Total XP gained + top 5 skills by XP gained
- **Poll frequency**: 1-5 minutes (user configurable)

**Mode C: Top 10 XP Gains (11 frames)**
- Total XP gained + top 10 skills by XP gained
- **Poll frequency**: 1-5 minutes (user configurable)

### 2. New Query Parameters

**`mode`** (optional, default: `allstats`)
- `allstats` - All stats with odd/even rotation
- `top5` - Top 5 XP gains
- `top10` - Top 10 XP gains

**`accountType`** (optional, default: `regular`)
- `regular` - Regular account (icon i72762)
- `ironman` - Ironman (icon i72751)
- `HCiron` - Hardcore Ironman (icon i72752)
- `UIM` - Ultimate Ironman (icon i72753)
- `GIM` - Group Ironman (icon i72754)
- `HCGIM` - Hardcore Group Ironman (icon i72756)
- `URGIM` - Unranked Group Ironman (icon i72755)

### 3. New Stats

- **Total XP**: Current total XP (not gained) - icon i72683
- **Total XP Gained**: XP gained in period - icon i72749
- **Boss Kills**: Sum of all boss kills gained - icon i72760
- **Clue Scrolls**: Total clues completed - icon i72758
- **Rank Change**: Rank gained (negative = improved) - icon i72761

### 4. Icon Updates

All new icons have been added to the codebase:
- Account type icons (7 types)
- New stat icons (boss kills, clue scrolls, rank change)
- Separate icon for Total XP vs Total XP Gained

## LaMetric Device Configuration

### URL Format

```
https://lametric-backend.austin-david-schaefer.workers.dev/apps/osrs
```

### Required Parameters

1. **username** (text, required)
   - Your OSRS username

2. **period** (dropdown, default: `day`)
   - Options: `day`, `week`, `month`

3. **mode** (dropdown, default: `allstats`)
   - Options: `allstats`, `top5`, `top10`

4. **accountType** (dropdown, default: `regular`)
   - Options: `regular`, `ironman`, `HCiron`, `UIM`, `GIM`, `HCGIM`, `URGIM`

### Example URLs

**All stats with ironman account (1-minute poll)**
```
https://lametric-backend.austin-david-schaefer.workers.dev/apps/osrs?username=YourName&period=day&mode=allstats&accountType=ironman
```

**Top 5 XP gains (5-minute poll)**
```
https://lametric-backend.austin-david-schaefer.workers.dev/apps/osrs?username=YourName&period=week&mode=top5
```

**Top 10 XP gains (5-minute poll)**
```
https://lametric-backend.austin-david-schaefer.workers.dev/apps/osrs?username=YourName&period=month&mode=top10
```

## How It Works

### Odd/Even Minute Rotation (All-Stats Mode)

The all-stats mode displays 30 total frames across two 1-minute polling cycles:

**Odd minutes (00:01, 00:03, 00:05, etc.)**
- Username with account type icon
- Total XP (current, not gained)
- Total XP gained
- Skills 1-12 (Attack through Thieving)

**Even minutes (00:00, 00:02, 00:04, etc.)**
- Skills 13-24 (Crafting through Sailing)
- Boss kills
- Clue scrolls
- Rank change

With 1-minute polling, your LaMetric will automatically alternate between these two sets, showing all 30 frames over 2 minutes.

### Data Updates

- Data is fetched from Wise Old Man API every 30 minutes per character
- Characters are divided into 6 rotation groups
- Smart caching: KV writes only when data actually changes
- No additional KV writes from new display modes (formatting happens at request time)

## Testing Results

All tests passed successfully:

✅ All-stats mode: 15 frames
✅ Top5 mode: 6 frames
✅ Top10 mode: 11 frames
✅ Invalid mode validation: Error message displayed
✅ Invalid account type validation: Error message displayed
✅ Default mode: Correctly defaults to allstats
✅ Skill name format: "Skillname: +XP"

## KV Storage Impact

**No increase in KV writes** - All three display modes read from the same cached data. Formatting happens in the request handler (0 KV writes).

**Current write frequency**: ~168 writes/day (well under 1,000 limit)
- Counter app: 24 writes/day
- OSRS app: ~144 writes/day (with smart caching)

## Files Modified

1. `/src/apps/osrs.ts` - Added display mode logic, new stats, icon mappings
2. `/src/index.ts` - Updated request handler for new parameters
3. No changes to `/src/scheduled.ts` - Data fetching unchanged

## Next Steps

1. **Update LaMetric App Configuration**:
   - Add `mode` parameter (dropdown: allstats, top5, top10)
   - Add `accountType` parameter (dropdown: regular, ironman, HCiron, UIM, GIM, HCGIM, URGIM)
   - Set poll frequency to 1 minute for allstats mode

2. **Install on Device**:
   - Configure with your username, preferred period, mode, and account type
   - For allstats mode, watch as it rotates between two 15-frame sets every minute

3. **Monitor**:
   - Check that frames display correctly
   - Verify odd/even rotation works (allstats mode)
   - Confirm account type icon shows correctly on username frame

## Support

If you encounter any issues:
- Check the logs: `npx wrangler tail --format pretty`
- Verify your username is spelled correctly
- Ensure the character exists on Wise Old Man (https://wiseoldman.net)
- Wait 30 minutes after first registration for data to populate

---

**Deployment**: ✅ Live at https://lametric-backend.austin-david-schaefer.workers.dev
**Version**: 96b4aaa1-1ca2-48c2-a6a1-3303930e9f6e
**Date**: 2026-01-25
