#!/bin/bash

ENV=${1:-prod}

if [ "$ENV" = "local" ]; then
  BASE_URL="http://localhost:8787"
else
  BASE_URL="https://lametric-backend.austin-david-schaefer.workers.dev"
fi

echo "Testing Scryfall app on $ENV environment ($BASE_URL)"
echo "================================================"

# Test all cardType values
echo -e "\n### Testing cardType variations ###"
for cardType in "old-school" "old-border" "paper" "any"; do
  echo "Testing cardType=$cardType..."
  response=$(curl -s "$BASE_URL/apps/scryfall?cardType=$cardType&currency=usd")
  frame_count=$(echo "$response" | jq '.frames | length')
  echo "  ✓ Frames: $frame_count (expect 3-4)"
done

# Test all currency values
echo -e "\n### Testing currency variations ###"
for currency in "usd" "eur" "tix" "none"; do
  echo "Testing currency=$currency..."
  response=$(curl -s "$BASE_URL/apps/scryfall?cardType=paper&currency=$currency")
  frame_count=$(echo "$response" | jq '.frames | length')
  if [ "$currency" = "none" ]; then
    echo "  ✓ Frames: $frame_count (expect exactly 3, no price)"
  else
    echo "  ✓ Frames: $frame_count (expect 3-4)"
  fi
done

# Test invalid parameters
echo -e "\n### Testing invalid parameters ###"
echo "Testing invalid cardType..."
response=$(curl -s "$BASE_URL/apps/scryfall?cardType=invalid")
error_text=$(echo "$response" | jq -r '.frames[0].text')
echo "  ✓ Error: $error_text"

echo "Testing invalid currency..."
response=$(curl -s "$BASE_URL/apps/scryfall?currency=invalid")
error_text=$(echo "$response" | jq -r '.frames[0].text')
echo "  ✓ Error: $error_text"

# Test default values
echo -e "\n### Testing default values ###"
echo "Testing no parameters (should use paper + usd)..."
response=$(curl -s "$BASE_URL/apps/scryfall")
frame_count=$(echo "$response" | jq '.frames | length')
echo "  ✓ Frames: $frame_count (expect 3-4)"

# Verify icon presence
echo -e "\n### Verifying icon presence ###"
response=$(curl -s "$BASE_URL/apps/scryfall?cardType=paper&currency=usd")
frames_with_icons=$(echo "$response" | jq '[.frames[] | select(.icon != null)] | length')
total_frames=$(echo "$response" | jq '.frames | length')
echo "  ✓ Frames with icons: $frames_with_icons / $total_frames"

echo -e "\n### Tests complete ###"
