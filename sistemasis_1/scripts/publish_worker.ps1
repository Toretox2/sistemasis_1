<#
Automated script to create Wrangler secrets and publish the worker (PowerShell).
Usage: run in PowerShell after `wrangler login`.
It will prompt for values if not provided as environment variables.
#>
param()

if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
  Write-Error "wrangler CLI not found. Install with: npm install -g wrangler"
  exit 1
}

$envSupabaseUrl = $env:SUPABASE_URL
if (-not $envSupabaseUrl) { $envSupabaseUrl = Read-Host 'SUPABASE_URL (https://<project>.supabase.co)' }

$envServiceRole = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $envServiceRole) { $envServiceRole = Read-Host -AsSecureString 'SUPABASE_SERVICE_ROLE_KEY (will be hidden)'; $envServiceRole = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($envServiceRole)) }

$envAllowed = $env:ALLOWED_ORIGINS
if (-not $envAllowed) { $envAllowed = Read-Host 'ALLOWED_ORIGINS (optional, comma-separated) (press Enter to skip)' }

Write-Host 'Creating secrets (may prompt)...' -ForegroundColor Cyan

try {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($envServiceRole)
  $proc = Start-Process -FilePath wrangler -ArgumentList 'secret','put','SUPABASE_SERVICE_ROLE_KEY','--env','production' -NoNewWindow -PassThru -RedirectStandardInput Pipe
  $proc.StandardInput.Write($envServiceRole)
  $proc.StandardInput.Close()
  $proc.WaitForExit()
} catch {
  Write-Warning "Failed to create SUPABASE_SERVICE_ROLE_KEY via stdin; falling back to interactive prompt."
  wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
}

if ($envSupabaseUrl) {
  try {
    $proc = Start-Process -FilePath wrangler -ArgumentList 'secret','put','SUPABASE_URL','--env','production' -NoNewWindow -PassThru -RedirectStandardInput Pipe
    $proc.StandardInput.Write($envSupabaseUrl)
    $proc.StandardInput.Close()
    $proc.WaitForExit()
  } catch {
    Write-Warning "Failed to create SUPABASE_URL via stdin; falling back to interactive prompt."
    wrangler secret put SUPABASE_URL --env production
  }
}

if ($envAllowed) {
  try {
    $proc = Start-Process -FilePath wrangler -ArgumentList 'secret','put','ALLOWED_ORIGINS','--env','production' -NoNewWindow -PassThru -RedirectStandardInput Pipe
    $proc.StandardInput.Write($envAllowed)
    $proc.StandardInput.Close()
    $proc.WaitForExit()
  } catch {
    Write-Warning "Failed to create ALLOWED_ORIGINS via stdin; falling back to interactive prompt."
    wrangler secret put ALLOWED_ORIGINS --env production
  }
}

Write-Host 'Publishing worker...' -ForegroundColor Green
wrangler publish workers/log_attendance --env production
