#!/bin/bash

# Weather LaMetric App Test Suite
# Tests multi-city weather display
# Usage: ./test-weather.sh [environment]
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
echo "Weather LaMetric App Test Suite"
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
    "$BASE_URL/apps/weather" \
    'check_equals "$result" "object"' \
    'type'

# Test 1.2: Response has frames array
run_test \
    "Response has frames array" \
    "$BASE_URL/apps/weather" \
    'check_equals "$result" "true"' \
    'has("frames")'

# Test 1.3: Response has at least 1 frame
run_test \
    "Response has at least 1 frame" \
    "$BASE_URL/apps/weather" \
    'check_gt "$result" "0"' \
    '.frames | length'

echo ""

# ====================
# Test Suite 2: Frame Structure Tests
# ====================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. FRAME STRUCTURE TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 2.1: All frames have text field
run_test \
    "All frames have text field" \
    "$BASE_URL/apps/weather" \
    'check_equals "$result" "true"' \
    'all(.frames[]; has("text"))'

# Test 2.2: All frames have icon field
run_test \
    "All frames have icon field" \
    "$BASE_URL/apps/weather" \
    'check_equals "$result" "true"' \
    'all(.frames[]; has("icon"))'

# Test 2.3: Frame count is a multiple of 3 (3 frames per city)
run_test \
    "Frame count is multiple of 3" \
    "$BASE_URL/apps/weather" \
    'check_equals "$result" "0"' \
    '(.frames | length) % 3'

# Test 2.4: Frame count is at most 15 (LaMetric limit)
response=$(curl -s "$BASE_URL/apps/weather")
frame_count=$(echo "$response" | jq '.frames | length')
echo -n "Testing: Frame count <= 15 (got $frame_count) ... "
if [ "$frame_count" -le 15 ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "  Expected <= 15 frames, got $frame_count"
    ((FAILED++))
fi

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
echo "$response" | jq .
echo ""

# Validate frame pattern: every group of 3 frames should be [high/low, current/feels, condition]
num_cities=$((frame_count / 3))
echo "Detected $num_cities cities in response"
echo ""

for ((i = 0; i < num_cities; i++)); do
    base=$((i * 3))
    city_num=$((i + 1))

    # Frame 1: High/Low (e.g., "H72 L55")
    hl_text=$(echo "$response" | jq -r ".frames[$base].text")
    echo -n "Testing: City $city_num high/low format ... "
    if [[ "$hl_text" =~ ^H-?[0-9]+\ L-?[0-9]+$ ]]; then
        echo -e "${GREEN}✓ PASS${NC} ($hl_text)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Expected format: 'H72 L55'"
        echo "  Got: $hl_text"
        ((FAILED++))
    fi

    # Frame 2: Now/Feels (e.g., "N69 F65")
    cf_text=$(echo "$response" | jq -r ".frames[$((base + 1))].text")
    echo -n "Testing: City $city_num now/feels format ... "
    if [[ "$cf_text" =~ ^N-?[0-9]+\ F-?[0-9]+$ ]]; then
        echo -e "${GREEN}✓ PASS${NC} ($cf_text)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Expected format: 'N69 F65'"
        echo "  Got: $cf_text"
        ((FAILED++))
    fi

    # Frame 3: Condition (e.g., "CLEAR", "RAIN", etc.)
    cond_text=$(echo "$response" | jq -r ".frames[$((base + 2))].text")
    echo -n "Testing: City $city_num condition is non-empty ... "
    if [ -n "$cond_text" ] && [ "$cond_text" != "null" ]; then
        echo -e "${GREEN}✓ PASS${NC} ($cond_text)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Got empty or null condition"
        ((FAILED++))
    fi
done

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
