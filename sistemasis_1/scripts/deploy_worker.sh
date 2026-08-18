#!/usr/bin/env bash
set -euo pipefail

if ! command -v wrangler >/dev/null 2>&1; then
  echo "Install wrangler (npm i -g wrangler) and authenticate first: wrangler login"
  exit 1
fi

# Usage: ./scripts/deploy_worker.sh <account_id> <name>
ACCOUNT_ID=${1:-}
WORKER_NAME=${2:-get_attendance_logs}

if [ -z "$ACCOUNT_ID" ]; then
  echo "Usage: $0 <account_id> [worker_name]"
  exit 1
fi

echo "Publishing worker $WORKER_NAME to account $ACCOUNT_ID"

cat > wrangler.toml <<EOF
name = "$WORKER_NAME"
main = "workers/get_attendance_logs/index.js"
compatibility_date = "2026-01-01"
account_id = "$ACCOUNT_ID"
EOF

echo "Run: wrangler secret put SUPABASE_SERVICE_ROLE_KEY" 
echo "Run: wrangler secret put SUPABASE_URL"
echo "Optional: wrangler secret put ALLOWED_ORIGINS (comma separated)"

echo "Now publishing (requires secrets configured)..."
wrangler publish
