#!/bin/bash

# Register Test Accounts
# Registers popular streamer accounts for comprehensive testing
# These accounts will be fetched by the scheduled worker every 30 minutes

set -e

# Configuration
ENV=${1:-prod}
if [ "$ENV" = "local" ]; then
    BASE_URL="http://localhost:8787"
    echo "Registering test accounts in LOCAL environment"
else
    BASE_URL="https://lametric-backend.austin-david-schaefer.workers.dev"
    echo "Registering test accounts in PRODUCTION environment"
fi

# Test accounts (popular OSRS streamers)
# Note: Bash associative arrays handle spaces in keys correctly when quoted
TEST_ACCOUNTS_KEYS=("McTile" "limpwurt" "Northern UIM" "Carl Caskets")
TEST_ACCOUNTS_VALUES=("regular" "ironman" "UIM" "HCiron")

echo ""
echo "=========================================="
echo "Registering Test Accounts"
echo "=========================================="
echo ""

REGISTERED=0
FAILED=0

# Loop through accounts using index
for i in "${!TEST_ACCOUNTS_KEYS[@]}"; do
    username="${TEST_ACCOUNTS_KEYS[$i]}"
    account_type="${TEST_ACCOUNTS_VALUES[$i]}"

    echo -n "Registering: $username ($account_type) ... "

    # Make a request to register the account (this triggers addCharacterToRegistry)
    encoded_username=$(echo "$username" | sed 's/ /%20/g')
    response=$(curl -s "$BASE_URL/apps/osrs?username=$encoded_username&period=day&mode=allstats")

    # Check if response is valid JSON
    if echo "$response" | jq empty 2>/dev/null; then
        echo "✓ Registered"
        ((REGISTERED++))
    else
        echo "✗ Failed"
        echo "  Response: $response"
        ((FAILED++))
    fi
done

echo ""
echo "=========================================="
echo "Registration Complete"
echo "=========================================="
echo ""
echo "Registered: $REGISTERED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "✓ All accounts registered successfully!"
    echo ""
    echo "These accounts will now be fetched by the scheduled worker."
    echo "Data will be available after the next scheduled run (every 5 minutes)."
    echo "Each account is assigned to a rotation group and updates every 30 minutes."
    echo ""
    echo "To verify registration, run:"
    echo "  wrangler kv:key get --binding CLOCK_DATA 'app:osrs:characters'"
    exit 0
else
    echo "✗ Some accounts failed to register"
    exit 1
fi
