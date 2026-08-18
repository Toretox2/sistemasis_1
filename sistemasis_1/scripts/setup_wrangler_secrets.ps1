<#
Interactive PowerShell script to create Wrangler secrets in Cloudflare.
Requires `wrangler` CLI installed and authenticated (`wrangler login`).
#>
param()

function Ensure-Wrangler {
    if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
        Write-Host "wrangler no está instalado. Ejecuta: npm install -g wrangler" -ForegroundColor Yellow
        exit 1
    }
}

Ensure-Wrangler

Write-Host "Este script creará secrets en tu cuenta Cloudflare usando wrangler." -ForegroundColor Cyan

$svc = Read-Host -Prompt "Introduce el valor para SUPABASE_SERVICE_ROLE_KEY (secreto)"
Write-Host "Creando secret SUPABASE_SERVICE_ROLE_KEY..."
wrangler secret put SUPABASE_SERVICE_ROLE_KEY -i <<< $svc

$url = Read-Host -Prompt "Introduce el valor para SUPABASE_URL (ej: https://xxxx.supabase.co)"
Write-Host "Creando secret SUPABASE_URL..."
wrangler secret put SUPABASE_URL -i <<< $url

$origins = Read-Host -Prompt "Introduce ALLOWED_ORIGINS (opcional, coma-separado)"
if ($origins -ne "") {
    Write-Host "Creando secret ALLOWED_ORIGINS..."
    wrangler secret put ALLOWED_ORIGINS -i <<< $origins
}

Write-Host "Secrets creados. Publica el worker con: wrangler publish workers/log_attendance --env production" -ForegroundColor Green
