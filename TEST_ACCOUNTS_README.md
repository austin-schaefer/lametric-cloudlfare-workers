# Test Accounts Setup

## Overview

The OSRS app now includes comprehensive testing against real streamer accounts to ensure production-quality validation.

## Test Accounts (Popular OSRS Streamers)

These accounts are used for integration testing:

| Username | Account Type | Description |
|----------|--------------|-------------|
| `McTile` | Regular | Popular streamer, active account |
| `limpwurt` | Ironman | Active ironman account |
| `Northern UIM` | Ultimate Ironman | UIM streamer |
| `Carl Caskets` | Hardcore Ironman | HCIM content creator |

## Registration

### Automatic Registration

Run the registration script to add all test accounts:

```bash
# Register in production
./register-test-accounts.sh prod

# Register in local development
./register-test-accounts.sh local
```

This script:
1. Makes a request to each account's endpoint
2. Triggers `addCharacterToRegistry()` in the worker
3. Accounts are added to the `app:osrs:characters` KV key

### Manual Registration (If KV Write Limit Reached)

If you hit Cloudflare's free tier KV write limit (1,000 writes/day), you can manually add accounts the next day:

```bash
# Get current registry
npx wrangler kv:key get --binding CLOCK_DATA 'app:osrs:characters'

# Add new accounts to the array
npx wrangler kv:key put --binding CLOCK_DATA 'app:osrs:characters' \
  '["LavaDargon","Lynx Titan","Zezima","Uncle Jaro","McTile","limpwurt","Northern UIM","Carl Caskets"]'
```

**Note**: This operation costs 1 KV write. If you've hit the daily limit, wait until the next day (UTC midnight) for the quota to reset.

## Data Fetching

Once registered, test accounts are automatically fetched by the scheduled worker:

- **Frequency**: Every 30 minutes per account (6 rotation groups)
- **Periods**: day, week, month
- **First fetch**: May take up to 30 minutes after registration

### Verify Data is Available

```bash
# Check if data exists for an account
curl "https://lametric-backend.austin-david-schaefer.workers.dev/apps/osrs?username=McTile&period=day&mode=allstats" | jq '.'

# Should return 15 frames with XP data, not "Loading data..."
```

## Running Tests

The test suite automatically tests all registered accounts:

```bash
# Run full test suite (includes real account tests)
./test-osrs.sh prod

# Run on local dev server
./test-osrs.sh local
```

### Test Coverage for Real Accounts

The test suite (Test Suite 7) validates:

1. **Account has data**: Verifies each account returns valid frames (not "Loading data...")
2. **Frame count**: Checks that 15 frames are returned in all-stats mode
3. **Icons present**: Validates all frames have icon references
4. **XP gains**: Ensures at least one account shows non-zero XP gains

### Expected Test Results

**When accounts are freshly registered** (data not yet fetched):
```
Testing: McTile (regular) has data ... ⊘ SKIP (data not loaded yet)
  └─ Account registered but waiting for scheduled worker
```

**After scheduled worker runs** (data available):
```
Testing: McTile (regular) has data ... ✓ PASS
  └─ Frame count: 15 ✓
  └─ Has icon: i72762 ✓
```

## KV Write Limits

### Free Tier Constraints

- **Limit**: 1,000 KV writes per day
- **Current usage**: ~168 writes/day (24 counter + ~144 OSRS with smart caching)
- **Headroom**: ~832 writes/day available

### What Counts as a Write

- Character registration: 1 write per new character
- Scheduled worker updates: 0-1 write per 5 minutes (only if data changed)
- Manual KV puts: 1 write per operation

### If You Hit the Limit

**Error message**:
```
your account has reached the free usage limit for this operation for today [code: 10048]
```

**Solutions**:
1. Wait until next day (UTC midnight) for quota reset
2. Reduce test account count
3. Upgrade to Cloudflare Workers Paid plan ($5/month for 1M writes)

### Best Practices

- Register test accounts once, not repeatedly
- Use `./register-test-accounts.sh` instead of manual KV writes
- Avoid clearing and re-registering accounts during development
- Smart caching already minimizes writes (only updates when data changes)

## Troubleshooting

### Accounts Not Appearing in Registry

**Symptom**: After running registration script, accounts don't show in KV

**Cause**: KV write limit reached for the day

**Solution**:
```bash
# Check if limit was hit (look for error message)
# Wait until next day and try again
# Or manually add accounts when quota resets
```

### Accounts Return "Loading data..."

**Symptom**: Test accounts show "Loading data..." even after registration

**Cause**: Scheduled worker hasn't fetched data yet (each account updates every 30 minutes)

**Solution**:
1. Wait 30 minutes for first scheduled fetch
2. Or manually trigger scheduled event in local dev:
   ```bash
   curl http://localhost:8787/__scheduled
   ```

### Accounts Return "Internal server error"

**Symptom**: Request returns `{"error": "Internal server error"}`

**Cause**: Account not in registry or other internal error

**Solution**:
1. Check logs: `npx wrangler tail --format pretty`
2. Verify account is in registry: `npx wrangler kv:key get --binding CLOCK_DATA 'app:osrs:characters'`
3. Re-register the account if needed

### Tests Show 0 Frames

**Symptom**: Test shows "Warning: Expected 15 frames, got 0"

**Cause**: API returned error object instead of frames structure

**Solution**: Check the raw response to see what error occurred:
```bash
curl "https://lametric-backend.austin-david-schaefer.workers.dev/apps/osrs?username=AccountName&period=day&mode=allstats"
```

## Maintenance

### Adding New Test Accounts

1. Add to both scripts:
   - `register-test-accounts.sh`
   - `test-osrs.sh`

2. Update the arrays:
   ```bash
   TEST_ACCOUNTS_KEYS=("McTile" "limpwurt" "Northern UIM" "Carl Caskets" "NewAccount")
   TEST_ACCOUNTS_VALUES=("regular" "ironman" "UIM" "HCiron" "GIM")
   ```

3. Run registration:
   ```bash
   ./register-test-accounts.sh prod
   ```

### Removing Test Accounts

1. Get current registry:
   ```bash
   npx wrangler kv:key get --binding CLOCK_DATA 'app:osrs:characters'
   ```

2. Update registry (removes account from fetching):
   ```bash
   npx wrangler kv:key put --binding CLOCK_DATA 'app:osrs:characters' '["Account1","Account2"]'
   ```

3. Update test scripts to remove from test arrays

**Note**: Removing accounts from registry stops scheduled fetching but doesn't delete cached data from `app:osrs:alldata`.

## Production Notes

- Test accounts are real player accounts (publicly accessible on Wise Old Man)
- Data is publicly available on hiscores.runescape.com
- These accounts are used for testing only, not for LaMetric display
- Respect the streamers' privacy - don't use their data beyond testing

## Future Improvements

- [ ] Add CI/CD integration for automated testing
- [ ] Create separate test environment with dedicated KV namespace
- [ ] Add monitoring for test account data freshness
- [ ] Implement account rotation for testing (cycle through different accounts weekly)
