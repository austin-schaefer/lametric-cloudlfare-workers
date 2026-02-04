#!/bin/bash

# Stocks LaMetric App Test Suite
# Tests gainers/losers display and market hours logic
# Usage: ./test-stoxx.sh [environment]
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
echo "Stocks LaMetric App Test Suite"
echo "=========================================="
echo ""

# ====================
# Test Suite 1: Basic Response Tests
# ====================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. BASIC RESPONSE TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1.1: Endpoint returns valid JSON
run_test \
    "Valid JSON response" \
    "$BASE_URL/apps/stoxx" \
    'check_equals "$result" "object"' \
    'type'

# Test 1.2: Response has frames array
run_test \
    "Response has frames array" \
    "$BASE_URL/apps/stoxx" \
    'check_equals "$result" "true"' \
    'has("frames")'

# Test 1.3: Response has at least 1 frame
run_test \
    "Response has at least 1 frame" \
    "$BASE_URL/apps/stoxx" \
    'check_gt "$result" "0"' \
    '.frames | length'

echo ""

# ====================
# Test Suite 2: Data Format Tests
# ====================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. DATA FORMAT TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 2.1: Frames have text field
run_test \
    "All frames have text field" \
    "$BASE_URL/apps/stoxx" \
    'check_equals "$result" "true"' \
    'all(.frames[]; has("text"))'

# Test 2.2: Frames have icon field
run_test \
    "All frames have icon field" \
    "$BASE_URL/apps/stoxx" \
    'check_equals "$result" "true"' \
    'all(.frames[]; has("icon"))'

echo ""

# ====================
# Test Suite 3: Content Validation
# ====================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. CONTENT VALIDATION TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Display actual response for manual inspection
echo "Current Response:"
response=$(curl -s "$BASE_URL/apps/stoxx")
echo "$response" | jq .

echo ""

# Check if we have stock data or market closed message
first_frame_text=$(echo "$response" | jq -r '.frames[0].text // empty')

if [[ "$first_frame_text" == *"Market closed"* ]]; then
    echo -e "${YELLOW}Market is currently closed${NC}"
    echo "Response shows cached data with market closed indicator"
    echo ""
elif [[ "$first_frame_text" == "No data" ]]; then
    echo -e "${YELLOW}No data available yet${NC}"
    echo "Scheduled worker may not have run yet"
    echo "Try running: curl http://localhost:8787/test/stoxx (local only)"
    echo ""
else
    # Market is open - check for gainer/loser format
    echo "Checking for gainer/loser format..."

    # Test 3.1: First frame should contain a symbol and percentage
    if [[ "$first_frame_text" =~ ^[A-Z]+\ [+-][0-9]+\.[0-9]+% ]]; then
        echo -e "${GREEN}✓ First frame has valid gainer/loser format${NC}"
        echo "  └─ Text: $first_frame_text"
        ((PASSED++))
    else
        echo -e "${RED}✗ First frame format invalid${NC}"
        echo "  └─ Expected format: 'SYMBOL +X.X%' or 'SYMBOL -X.X%'"
        echo "  └─ Got: $first_frame_text"
        ((FAILED++))
    fi

    # Test 3.2: Check icons are correct
    first_icon=$(echo "$response" | jq -r '.frames[0].icon')
    if [[ "$first_icon" == "i72948" ]] || [[ "$first_icon" == "i72947" ]]; then
        echo -e "${GREEN}✓ First frame has valid icon (gain or loss)${NC}"
        echo "  └─ Icon: $first_icon"
        ((PASSED++))
    else
        echo -e "${RED}✗ First frame icon invalid${NC}"
        echo "  └─ Expected: i72948 (gain) or i72947 (loss)"
        echo "  └─ Got: $first_icon"
        ((FAILED++))
    fi
fi

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
