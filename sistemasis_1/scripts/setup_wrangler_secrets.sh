#!/usr/bin/env bash
set -euo pipefail

echo "Este script usa wrangler para crear secrets en tu cuenta Cloudflare."
echo "Asegúrate de haber ejecutado: wrangler login"

if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler no está instalado. Instala con: npm install -g wrangler"
  exit 1
fi

read -p "Introduce el nombre del worker (ej: sistemasis-attendance-worker): " WORKER_NAME

echo "Creando secrets..."
echo "Introduce el valor para SUPABASE_SERVICE_ROLE_KEY (se ocultará):"
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name SUPABASE_SERVICE_ROLE_KEY

echo "Introduce el valor para SUPABASE_URL (se ocultará):"
wrangler secret put SUPABASE_URL --name SUPABASE_URL

echo "Introduce el valor para ALLOWED_ORIGINS (opcional, ejemplo: https://midominio.com):"
wrangler secret put ALLOWED_ORIGINS --name ALLOWED_ORIGINS

echo "Secrets creados. Publica el worker con: wrangler publish workers/log_attendance --env production"
