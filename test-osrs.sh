#!/bin/bash

# OSRS LaMetric App Test Suite
# Tests all three display modes and parameter validation
# Usage: ./test-osrs.sh [environment]
#   environment: "local" or "prod" (default: prod)

set -e

# Configuration
ENV=${1:-prod}
if [ "$ENV" = "local" ]; then
    BASE_URL="http://localhost:8787"
    echo "Testing LOCAL environment: $BASE_URL"
else
    BASE_URL="https://lametric-backend.austin-david-schaefer.workers.dev"
    echo "Testing PRODUCTION environment: $BASE_URL"
fi

# Test configuration
TEST_USERNAME="Zezima"
PASSED=0
FAILED=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to run a test
run_test() {
    local test_name="$1"
    local url="$2"
    local expected_condition="$3"
    local jq_query="$4"

    echo -n "Testing: $test_name ... "

    local response=$(curl -s "$url")
    local result=$(echo "$response" | jq -r "$jq_query")

    if eval "$expected_condition"; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Expected: $expected_condition"
        echo "  Got: $result"
        echo "  Full response: $response"
        ((FAILED++))
        return 1
    fi
}

# Helper function to check if value equals expected
check_equals() {
    [ "$1" = "$2" ]
}

# Helper function to check if value is greater than threshold
check_gt() {
    [ "$1" -gt "$2" ]
}

echo ""
echo "=========================================="
echo "OSRS LaMetric App Test Suite"
echo "=========================================="
echo ""

# ====================
# Test Suite 1: Mode Tests
# ====================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. DISPLAY MODE TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1.1: All-stats mode returns 15 frames
run_test \
    "All-stats mode frame count" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=allstats" \
    'check_equals "$result" "15"' \
    '.frames | length'

# Test 1.2: Top5 mode returns 6 frames
run_test \
    "Top5 mode frame count" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=top5" \
    'check_equals "$result" "6"' \
    '.frames | length'

# Test 1.3: Top10 mode returns 11 frames
run_test \
    "Top10 mode frame count" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=top10" \
    'check_equals "$result" "11"' \
    '.frames | length'

# Test 1.4: Default mode (no mode param) returns 15 frames
run_test \
    "Default mode (allstats) frame count" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day" \
    'check_equals "$result" "15"' \
    '.frames | length'

echo ""

# ====================
# Test Suite 2: Icon Tests
# ====================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. ICON TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 2.1: All-stats mode has icon in every frame
run_test \
    "All-stats mode - all frames have icons" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=allstats" \
    'check_equals "$result" "15"' \
    '[.frames[] | select(.icon != null)] | length'

# Test 2.2: Top5 mode has icon in every frame
run_test \
    "Top5 mode - all frames have icons" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=top5" \
    'check_equals "$result" "6"' \
    '[.frames[] | select(.icon != null)] | length'

# Test 2.3: Top10 mode has icon in every frame
run_test \
    "Top10 mode - all frames have icons" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=top10" \
    'check_equals "$result" "11"' \
    '[.frames[] | select(.icon != null)] | length'

# Test 2.4: Top5 first frame has totalXpGained icon
run_test \
    "Top5 first frame has correct icon (i72749)" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=top5" \
    'check_equals "$result" "i72749"' \
    '.frames[0].icon'

# Test 2.5: Top10 first frame has totalXpGained icon
run_test \
    "Top10 first frame has correct icon (i72749)" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=top10" \
    'check_equals "$result" "i72749"' \
    '.frames[0].icon'

echo ""

# ====================
# Test Suite 3: Account Type Tests
# ====================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. ACCOUNT TYPE TESTS (Odd-Minute Rotation)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get current minute to check if we're in odd or even rotation
CURRENT_MINUTE=$(date +%M)
IS_ODD=$((CURRENT_MINUTE % 2))

if [ $IS_ODD -eq 1 ]; then
    echo "Current minute: $CURRENT_MINUTE (ODD - username frame visible)"
    echo ""

    # Test 3.1: Regular account type icon
    run_test \
        "Regular account type icon (i72762)" \
        "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=allstats&accountType=regular" \
        'check_equals "$result" "i72762"' \
        '.frames[0].icon'

    # Test 3.2: Ironman account type icon
    run_test \
        "Ironman account type icon (i72751)" \
        "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=allstats&accountType=ironman" \
        'check_equals "$result" "i72751"' \
        '.frames[0].icon'

    # Test 3.3: UIM account type icon
    run_test \
        "UIM account type icon (i72753)" \
        "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=allstats&accountType=UIM" \
        'check_equals "$result" "i72753"' \
        '.frames[0].icon'

    # Test 3.4: Default account type (no param) should be regular
    run_test \
        "Default account type (regular, i72762)" \
        "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=allstats" \
        'check_equals "$result" "i72762"' \
        '.frames[0].icon'
else
    echo -e "${YELLOW}Current minute: $CURRENT_MINUTE (EVEN - username frame not visible)${NC}"
    echo "Skipping account type icon tests (wait for odd minute to test)"
    echo ""
fi

echo ""

# ====================
# Test Suite 4: Data Format Tests
# ====================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. DATA FORMAT TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 4.1: Top5 frames have skill names with colon format
run_test \
    "Top5 frame format includes colon" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=top5" \
    '[ "$result" = "true" ]' \
    '.frames[1].text | contains(":")'

# Test 4.2: Top5 frames show + prefix for XP gains
run_test \
    "Top5 frame shows + prefix" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=top5" \
    '[ "$result" = "true" ]' \
    '.frames[1].text | contains("+")'

# Test 4.3: Top10 frames have skill names with colon format
run_test \
    "Top10 frame format includes colon" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=top10" \
    '[ "$result" = "true" ]' \
    '.frames[1].text | contains(":")'

# Test 4.4: All frames have non-empty text
run_test \
    "All-stats mode - all frames have text" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=allstats" \
    'check_equals "$result" "15"' \
    '[.frames[] | select(.text != "" and .text != null)] | length'

echo ""

# ====================
# Test Suite 5: Parameter Validation Tests
# ====================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. PARAMETER VALIDATION TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 5.1: Invalid mode returns error
run_test \
    "Invalid mode returns error message" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=invalid" \
    'check_equals "$result" "Invalid mode"' \
    '.frames[0].text'

# Test 5.2: Invalid account type returns error
run_test \
    "Invalid account type returns error message" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&accountType=invalid" \
    'check_equals "$result" "Invalid account type"' \
    '.frames[0].text'

# Test 5.3: Invalid period returns error
run_test \
    "Invalid period returns error message" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=invalid" \
    'check_equals "$result" "Invalid period"' \
    '.frames[0].text'

# Test 5.4: Missing username returns configuration message
run_test \
    "Missing username returns config message" \
    "$BASE_URL/apps/osrs" \
    'check_equals "$result" "Configure username"' \
    '.frames[0].text'

echo ""

# ====================
# Test Suite 6: Period Tests
# ====================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. PERIOD TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 6.1: Day period works
run_test \
    "Day period returns data" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=day&mode=top5" \
    'check_equals "$result" "6"' \
    '.frames | length'

# Test 6.2: Week period works
run_test \
    "Week period returns data" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=week&mode=top5" \
    'check_equals "$result" "6"' \
    '.frames | length'

# Test 6.3: Month period works
run_test \
    "Month period returns data" \
    "$BASE_URL/apps/osrs?username=$TEST_USERNAME&period=month&mode=top5" \
    'check_equals "$result" "6"' \
    '.frames | length'

echo ""

# ====================
# Summary
# ====================
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo ""
echo -e "Total tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
