param(
  [string]$Token,
  [string]$DeviceInfo = "ps-cli-test"
)

function Read-Secret([string]$prompt) {
  $s = Read-Host -AsSecureString $prompt
  return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
}

$SUPABASE_URL = $env:SUPABASE_URL
if (-not $SUPABASE_URL) {
  $SUPABASE_URL = Read-Host 'SUPABASE_URL (https://<project>.supabase.co)'
}

$SERVICE_ROLE = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $SERVICE_ROLE) {
  $SERVICE_ROLE = Read-Secret 'SUPABASE_SERVICE_ROLE_KEY (input hidden)'
}

if (-not $Token) {
  $Token = Read-Host 'Token (qr_token) to test'
}

$endpoint = "$SUPABASE_URL/rest/v1/rpc/log_attendance_by_token"

$body = @{ p_token = $Token; p_device_info = $DeviceInfo } | ConvertTo-Json

try {
  $headers = @{
    'Content-Type' = 'application/json'
    'apikey' = $SERVICE_ROLE
    'Authorization' = "Bearer $SERVICE_ROLE"
  }
  $resp = Invoke-RestMethod -Uri $endpoint -Method Post -Headers $headers -Body $body -ErrorAction Stop
  Write-Output ($resp | ConvertTo-Json -Depth 5)
} catch {
  Write-Error "Request failed: $_"
}
