<#
.SYNOPSIS
  Registers the Manday Estimation Node.js server as a Windows service, so it
  starts with the machine and restarts if it crashes.

.DESCRIPTION
  Uses NSSM (https://nssm.cc) because `sc.exe` cannot supervise a plain node
  process. Download nssm.exe once and put it on PATH, or pass -NssmPath.

  The service runs `node server.js` from the release folder. IIS reverse-proxies
  to it (see web.config); the port is never exposed outside the machine.

.EXAMPLE
  # from an elevated PowerShell prompt
  .\install-service.ps1 -AppDir D:\apps\est-manday -Port 3100 `
      -DataPath D:\appdata\est-manday\estmanday.db

.NOTES
  Run elevated. Re-running updates the existing service in place.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$AppDir,
  [string]$ServiceName = 'EstManday',
  [int]$Port = 3100,
  [string]$DataPath = 'D:\appdata\est-manday\estmanday.db',
  [string]$NssmPath = 'nssm.exe',
  [string]$NodePath = '',
  # Windows account the service runs as. Must be able to write $DataPath and the
  # log folder, and to read $AppDir. A dedicated service account is preferred.
  [string]$ServiceAccount = '',
  [securestring]$ServiceAccountPassword
)

$ErrorActionPreference = 'Stop'

if (-not ([Security.Principal.WindowsPrincipal] `
      [Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run this script from an elevated PowerShell prompt.'
}

$AppDir = (Resolve-Path $AppDir).Path
if (-not (Test-Path (Join-Path $AppDir 'server.js'))) {
  throw "server.js not found in $AppDir - is this the release folder?"
}

if (-not $NodePath) {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { throw 'node.exe not found on PATH; pass -NodePath.' }
  $NodePath = $node.Source
}

$nssm = Get-Command $NssmPath -ErrorAction SilentlyContinue
if (-not $nssm) {
  throw "nssm.exe not found ('$NssmPath'). Download it from https://nssm.cc and pass -NssmPath."
}
$nssm = $nssm.Source

# SESSION_SECRET signs the login cookie. It must stay the same across restarts,
# or everyone is signed out on every deploy, and it must never be committed.
$secretFile = Join-Path (Split-Path $DataPath -Parent) 'session-secret.txt'
New-Item -ItemType Directory -Force -Path (Split-Path $DataPath -Parent) | Out-Null
if (Test-Path $secretFile) {
  $sessionSecret = (Get-Content $secretFile -Raw).Trim()
  Write-Host "==> reusing SESSION_SECRET from $secretFile"
} else {
  $bytes = [byte[]]::new(48)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  $sessionSecret = [Convert]::ToBase64String($bytes)
  Set-Content -Path $secretFile -Value $sessionSecret -Encoding ascii -NoNewline
  # Readable only by Administrators and the service account.
  icacls $secretFile /inheritance:r /grant:r 'BUILTIN\Administrators:(R)' | Out-Null
  Write-Host "==> generated SESSION_SECRET and stored it in $secretFile"
}

$logDir = Join-Path $AppDir 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$exists = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($exists) {
  Write-Host "==> stopping existing service $ServiceName"
  & $nssm stop $ServiceName | Out-Null
} else {
  Write-Host "==> installing service $ServiceName"
  & $nssm install $ServiceName $NodePath 'server.js'
  if ($LASTEXITCODE -ne 0) { throw 'nssm install failed' }
}

& $nssm set $ServiceName Application $NodePath | Out-Null
& $nssm set $ServiceName AppParameters 'server.js' | Out-Null
& $nssm set $ServiceName AppDirectory $AppDir | Out-Null
& $nssm set $ServiceName DisplayName 'Manday Estimation (PTT Digital)' | Out-Null
& $nssm set $ServiceName Description  'Next.js app for MD estimation; IIS reverse-proxies to it.' | Out-Null
& $nssm set $ServiceName Start SERVICE_AUTO_START | Out-Null

# Bind to loopback only: IIS is the sole entry point.
& $nssm set $ServiceName AppEnvironmentExtra `
  "NODE_ENV=production" `
  "PORT=$Port" `
  "HOSTNAME=127.0.0.1" `
  "DATABASE_PATH=$DataPath" `
  "SESSION_SECRET=$sessionSecret" | Out-Null

# Restart on failure, and roll the logs so they cannot fill the disk.
& $nssm set $ServiceName AppExit Default Restart | Out-Null
& $nssm set $ServiceName AppRestartDelay 5000 | Out-Null
& $nssm set $ServiceName AppStdout (Join-Path $logDir 'stdout.log') | Out-Null
& $nssm set $ServiceName AppStderr (Join-Path $logDir 'stderr.log') | Out-Null
& $nssm set $ServiceName AppRotateFiles 1 | Out-Null
& $nssm set $ServiceName AppRotateBytes 10485760 | Out-Null

if ($ServiceAccount) {
  if (-not $ServiceAccountPassword) {
    throw 'Pass -ServiceAccountPassword together with -ServiceAccount.'
  }
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ServiceAccountPassword))
  & $nssm set $ServiceName ObjectName $ServiceAccount $plain | Out-Null
  $plain = $null
  Write-Host "==> service will run as $ServiceAccount"
  Write-Host "    grant it Modify on $(Split-Path $DataPath -Parent) and Read on $AppDir"
}

Write-Host "==> starting $ServiceName"
& $nssm start $ServiceName
Start-Sleep -Seconds 3

$svc = Get-Service -Name $ServiceName
Write-Host "==> $ServiceName is $($svc.Status)" -ForegroundColor Green

try {
  $probe = Invoke-WebRequest "http://127.0.0.1:$Port/login" -UseBasicParsing `
    -TimeoutSec 15 -MaximumRedirection 0 -ErrorAction Stop
  Write-Host "==> app answered HTTP $($probe.StatusCode) on port $Port" -ForegroundColor Green
} catch {
  Write-Warning "app did not answer on port $Port yet: $($_.Exception.Message)"
  Write-Warning "check $logDir\stderr.log"
}
