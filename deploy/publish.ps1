<#
.SYNOPSIS
  Builds the app and assembles a self-contained release folder ready to copy
  onto the IIS host.

.EXAMPLE
  .\deploy\publish.ps1
  .\deploy\publish.ps1 -OutDir D:\release\est-manday

.NOTES
  Run from the repository root on a machine that has Node.js and the same
  processor architecture as the server (better-sqlite3 ships a native binding).
#>
[CmdletBinding()]
param(
  [string]$OutDir = "$PSScriptRoot\..\release"
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\.."
Set-Location $root

# npm and next write progress to stderr, which PowerShell would otherwise treat
# as a terminating error. Judge these by their exit code instead.
function Invoke-Native {
  param([string]$What, [scriptblock]$Command)
  Write-Host "==> $What" -ForegroundColor Cyan
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Command } finally { $ErrorActionPreference = $previous }
  if ($LASTEXITCODE -ne 0) { throw "$What failed (exit $LASTEXITCODE)" }
}

Invoke-Native 'npm ci' { npm ci }
Invoke-Native 'next build' { npx next build }

if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$OutDir = Resolve-Path $OutDir

Write-Host "==> assembling $OutDir" -ForegroundColor Cyan

# The standalone server, plus the two folders Next.js deliberately leaves out.
Copy-Item "$root\.next\standalone\*" $OutDir -Recurse -Force
New-Item -ItemType Directory -Force -Path "$OutDir\.next\static" | Out-Null
Copy-Item "$root\.next\static\*" "$OutDir\.next\static" -Recurse -Force
if (Test-Path "$root\public") {
  New-Item -ItemType Directory -Force -Path "$OutDir\public" | Out-Null
  Copy-Item "$root\public\*" "$OutDir\public" -Recurse -Force
}

# next build copies the local .env into the standalone folder. Secrets belong in
# the service environment, not in the release, so drop it.
Remove-Item "$OutDir\.env" -Force -ErrorAction SilentlyContinue

# Schema migration and seeding run on the server, so ship what they need:
# the plain-JS scripts, the generated SQL migrations and the master data.
foreach ($dir in 'deploy', 'scripts', 'drizzle') {
  New-Item -ItemType Directory -Force -Path "$OutDir\$dir" | Out-Null
  Copy-Item "$root\$dir\*" "$OutDir\$dir" -Recurse -Force
}
New-Item -ItemType Directory -Force -Path "$OutDir\src\lib\db" | Out-Null
Copy-Item "$root\src\lib\db\standard-matrix.json" "$OutDir\src\lib\db" -Force

# next build traces only what the app imports. The scripts also need the
# migrator and bcrypt, so make sure they came along.
foreach ($mod in 'better-sqlite3', 'drizzle-orm', 'bcryptjs') {
  if (-not (Test-Path "$OutDir\node_modules\$mod")) {
    Write-Warning "node_modules\$mod is missing from the release; copying it"
    Copy-Item "$root\node_modules\$mod" "$OutDir\node_modules\$mod" -Recurse -Force
  }
}

$sizeMb = [math]::Round(
  ((Get-ChildItem $OutDir -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 1)
Write-Host "==> done: $OutDir ($sizeMb MB)" -ForegroundColor Green
Write-Host '    next: follow deploy/DEPLOY.md, step 3 (install on the server)'
