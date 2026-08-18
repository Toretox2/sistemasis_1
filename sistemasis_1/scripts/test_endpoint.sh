#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Uso: $0 <endpoint-url> <token> [device_info]"
  exit 1
fi

ENDPOINT="$1"
TOKEN="$2"
DEVICE_INFO="${3:-curl-test}"

echo "POSTing token to $ENDPOINT..."
curl -sS -X POST "$ENDPOINT" \
  -H 'Content-Type: application/json' \
  -d "{\"token\": \"$TOKEN\", \"device_info\": \"$DEVICE_INFO\" }" | jq || true
