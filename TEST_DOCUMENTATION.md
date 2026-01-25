# OSRS LaMetric App Test Suite Documentation

## Overview

The `test-osrs.sh` script provides comprehensive automated testing for the OSRS LaMetric app. It validates all three display modes, parameter handling, data formatting, and error cases.

## Usage

```bash
# Test production deployment
./test-osrs.sh prod

# Test local development server
./test-osrs.sh local

# Default (no argument) tests production
./test-osrs.sh
```

## Prerequisites

- **jq**: JSON processor (install with `brew install jq` on macOS)
- **curl**: HTTP client (pre-installed on most systems)
- **Production testing**: Deployed worker must be running
- **Local testing**: Local dev server must be running (`wrangler dev --local --test-scheduled`)

## Test Suites

### 1. Display Mode Tests (4 tests)

Tests that each display mode returns the correct number of frames:

- **All-stats mode**: 15 frames (odd/even rotation)
- **Top5 mode**: 6 frames (1 + 5 skills)
- **Top10 mode**: 11 frames (1 + 10 skills)
- **Default mode**: 15 frames (defaults to allstats)

**Why this matters**: LaMetric devices have frame limits. Incorrect frame counts cause display issues.

### 2. Icon Tests (5 tests)

Validates that all frames include proper icon references:

- All-stats mode: Every frame has an icon
- Top5 mode: Every frame has an icon
- Top10 mode: Every frame has an icon
- Top5 first frame: Has totalXpGained icon (i72749)
- Top10 first frame: Has totalXpGained icon (i72749)

**Why this matters**: Missing icons cause blank displays on LaMetric devices.

### 3. Account Type Tests (4 tests)

Tests that account type icons display correctly in all-stats mode:

- Regular account: i72762
- Ironman: i72751
- Ultimate Ironman (UIM): i72753
- Default (no param): i72762 (regular)

**Note**: These tests only run during odd minutes when the username frame is visible. During even minutes, the test suite skips these tests with a warning.

**Why this matters**: Users want their account type badge to show correctly.

### 4. Data Format Tests (4 tests)

Validates the text formatting of frames:

- Top5 frames include ":" (skill name format)
- Top5 frames include "+" (XP gain prefix)
- Top10 frames include ":" (skill name format)
- All-stats frames have non-empty text

**Why this matters**: Ensures XP gains are displayed in a readable format.

### 5. Parameter Validation Tests (4 tests)

Tests error handling for invalid parameters:

- Invalid mode: Returns "Invalid mode" error
- Invalid account type: Returns "Invalid account type" error
- Invalid period: Returns "Invalid period" error
- Missing username: Returns "Configure username" message

**Why this matters**: Prevents crashes and provides helpful error messages to users.

### 6. Period Tests (3 tests)

Tests that all three time periods work correctly:

- Day period: Returns data
- Week period: Returns data
- Month period: Returns data

**Why this matters**: Users should be able to track XP gains over different time periods.

## Test Output

The script provides color-coded output:

- 🟢 **Green ✓**: Test passed
- 🔴 **Red ✗**: Test failed
- 🟡 **Yellow**: Warning (e.g., skipped tests during even minutes)

Example output:
```
Testing: All-stats mode frame count ... ✓ PASS
Testing: Top5 mode frame count ... ✓ PASS
Testing: Top10 mode frame count ... ✓ PASS

==========================================
TEST SUMMARY
==========================================

Total tests: 24
Passed: 24
Failed: 0

✓ All tests passed!
```

## Exit Codes

- **0**: All tests passed
- **1**: One or more tests failed

Use this in CI/CD pipelines:
```bash
if ./test-osrs.sh prod; then
    echo "Tests passed, safe to deploy"
else
    echo "Tests failed, do not deploy"
    exit 1
fi
```

## Test Configuration

The script tests against a specific username by default:

```bash
TEST_USERNAME="Zezima"
```

**Why Zezima?**: This account has cached data in production, ensuring tests can verify actual API responses. When testing locally, make sure this user is registered and has cached data (trigger a scheduled event first).

## Troubleshooting

### Test fails: "Loading data..."

**Cause**: The test username doesn't have cached data yet.

**Solution**:
1. Production: Wait for the scheduled worker to run (runs every 5 minutes)
2. Local: Trigger a scheduled event: `curl http://localhost:8787/__scheduled`
3. Change `TEST_USERNAME` to a registered user with cached data

### Test fails during even minutes

**Cause**: Account type tests check the username frame, which only appears during odd minutes.

**Solution**: Wait for an odd minute (00:01, 00:03, 00:05, etc.) and rerun the test. The test suite will automatically skip these tests during even minutes.

### Local tests fail: Connection refused

**Cause**: Local dev server isn't running.

**Solution**: Start the dev server in another terminal:
```bash
wrangler dev --local --test-scheduled
```

### All tests fail: Invalid JSON response

**Cause**: Worker crashed or returned HTML error page.

**Solution**: Check worker logs:
```bash
npx wrangler tail --format pretty
```

## Extending the Tests

### Adding a New Test

1. Choose the appropriate test suite section
2. Add a new `run_test` call:

```bash
run_test \
    "Test description" \
    "$BASE_URL/apps/osrs?param1=value1&param2=value2" \
    'check_equals "$result" "expected_value"' \
    '.frames[0].text'
```

Parameters:
- **Test description**: Human-readable test name
- **URL**: Full URL to test
- **Expected condition**: Bash condition to check (use check_equals or check_gt helpers)
- **jq query**: JSON query to extract the value to test

### Available Helper Functions

```bash
# Check if value equals expected
check_equals "$result" "expected"

# Check if value is greater than threshold
check_gt "$result" 10
```

### Testing Custom Scenarios

Create a custom test script based on `test-osrs.sh`:

```bash
#!/bin/bash
BASE_URL="https://lametric-backend.austin-david-schaefer.workers.dev"

# Test with your own username
curl -s "$BASE_URL/apps/osrs?username=YourName&period=day&mode=allstats" | jq '.'

# Test with different parameters
curl -s "$BASE_URL/apps/osrs?username=YourName&period=week&mode=top5" | jq '.'
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Test OSRS App

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install jq
        run: sudo apt-get install -y jq
      - name: Run tests
        run: ./test-osrs.sh prod
```

### Pre-deployment Hook

Add to your deployment script:

```bash
#!/bin/bash

echo "Running tests before deployment..."
if ./test-osrs.sh prod; then
    echo "Tests passed, deploying..."
    npx wrangler deploy
else
    echo "Tests failed, aborting deployment"
    exit 1
fi
```

## Maintenance

### When to Update Tests

Update tests when:
- Adding new display modes
- Changing frame counts
- Adding new query parameters
- Modifying data formatting
- Changing icon IDs
- Adding new error cases

### Test Review Checklist

Before merging changes:
- [ ] All existing tests pass
- [ ] New features have corresponding tests
- [ ] Error cases are tested
- [ ] Both local and production environments tested
- [ ] Test documentation updated

## Performance

The test suite makes ~30 HTTP requests and takes approximately:
- **Production**: 15-30 seconds
- **Local**: 5-10 seconds

**Note**: Test duration may increase during even minutes if account type tests are skipped (fewer tests = faster completion).

## Known Limitations

1. **Odd/even minute dependency**: Account type tests only run during odd minutes
2. **Cached data requirement**: Tests require the test username to have cached data
3. **Rate limiting**: Running tests repeatedly may hit rate limits (use with caution)
4. **Time zone**: Test minute detection uses system time zone

## Support

If tests fail unexpectedly:

1. Check worker logs: `npx wrangler tail --format pretty`
2. Verify test username has data: `curl https://lametric-backend.austin-david-schaefer.workers.dev/apps/osrs?username=Zezima&period=day&mode=allstats`
3. Check Wise Old Man API status: https://wiseoldman.net
4. Review recent code changes that might affect the OSRS app

## Version History

- **v1.0** (2026-01-25): Initial test suite with 24 tests covering all display modes
