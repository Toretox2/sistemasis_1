param(
  [Parameter(Mandatory=$true)][string]$Endpoint,
  [Parameter(Mandatory=$true)][string]$Token,
  [string]$DeviceInfo = "ps-test"
)

$body = @{ token = $Token; device_info = $DeviceInfo } | ConvertTo-Json
Write-Host "POSTing to $Endpoint"
$resp = Invoke-RestMethod -Uri $Endpoint -Method Post -ContentType 'application/json' -Body $body -ErrorAction Stop
Write-Output $resp
