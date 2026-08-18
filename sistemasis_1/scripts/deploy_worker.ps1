param(
  [string]$AccountId,
  [string]$WorkerName = 'get_attendance_logs'
)

if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
  Write-Error 'Install wrangler (npm i -g wrangler) and run wrangler login first.'; exit 1
}

if (-not $AccountId) {
  $AccountId = Read-Host 'Cloudflare account_id'
}

$wrangler = @"
name = "$WorkerName"
main = "workers/get_attendance_logs/index.js"
compatibility_date = "2026-01-01"
account_id = "$AccountId"
"@

$wrangler | Out-File -FilePath wrangler.toml -Encoding utf8

Write-Output "Run the following to set secrets (you will be prompted):"
Write-Output "wrangler secret put SUPABASE_SERVICE_ROLE_KEY"
Write-Output "wrangler secret put SUPABASE_URL"
Write-Output "Optional: wrangler secret put ALLOWED_ORIGINS"

Write-Output 'Publishing (requires secrets configured)...'
wrangler publish
