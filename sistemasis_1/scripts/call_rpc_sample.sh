#!/usr/bin/env bash
set -euo pipefail

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables before running."
  echo "Example: export SUPABASE_URL=https://<project>.supabase.co"
  exit 1
fi

ENDPOINT="$SUPABASE_URL/rest/v1/rpc/log_attendance_by_token"
TOKEN="$1"
DEVICE_INFO="${2:-cli-test}"

curl -sS -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d "{ \"p_token\": \"$TOKEN\", \"p_device_info\": \"$DEVICE_INFO\" }" | jq
