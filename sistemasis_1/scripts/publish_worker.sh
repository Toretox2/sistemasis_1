#!/usr/bin/env bash
set -euo pipefail

if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler CLI not found. Install with: npm install -g wrangler"
  exit 1
fi

: ${SUPABASE_URL:=$(read -p "SUPABASE_URL (https://<project>.supabase.co): " tmp && echo $tmp)}
: ${SUPABASE_SERVICE_ROLE_KEY:=$(read -s -p "SUPABASE_SERVICE_ROLE_KEY (input hidden): " tmp && echo $tmp; echo)}
: ${ALLOWED_ORIGINS:=$(read -p "ALLOWED_ORIGINS (optional, comma-separated): " tmp && echo $tmp)}

echo "Creating secrets (non-interactive where possible)..."

printf '%s' "$SUPABASE_SERVICE_ROLE_KEY" | wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production || { echo "Interactive fallback for SUPABASE_SERVICE_ROLE_KEY"; wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production; }

if [ -n "$SUPABASE_URL" ]; then
  printf '%s' "$SUPABASE_URL" | wrangler secret put SUPABASE_URL --env production || { echo "Interactive fallback for SUPABASE_URL"; wrangler secret put SUPABASE_URL --env production; }
fi

if [ -n "$ALLOWED_ORIGINS" ]; then
  printf '%s' "$ALLOWED_ORIGINS" | wrangler secret put ALLOWED_ORIGINS --env production || { echo "Interactive fallback for ALLOWED_ORIGINS"; wrangler secret put ALLOWED_ORIGINS --env production; }
fi

echo "Publishing worker..."
wrangler publish workers/log_attendance --env production
