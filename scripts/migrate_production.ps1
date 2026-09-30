<#
.SYNOPSIS
    Run Django migrations against the Supabase Postgres database.

.DESCRIPTION
    Prompts for the database password instead of taking it as an argument, so
    it never lands in PowerShell's history file, the terminal scrollback, or
    any file on disk. The password is URL-encoded before being placed into the
    connection string, so special characters cannot corrupt it.

    DATABASE_URL is set only for the duration of this script and cleared
    afterwards, leaving local development on SQLite.

.EXAMPLE
    .\scripts\migrate_production.ps1
    .\scripts\migrate_production.ps1 -CreateSuperuser
    .\scripts\migrate_production.ps1 -Seed
#>
[CmdletBinding()]
param(
    [switch]$CreateSuperuser,
    [switch]$Seed,
    [switch]$ShowMigrations
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $repoRoot 'backend\.venv\Scripts\python.exe'
$manage = Join-Path $repoRoot 'backend\manage.py'

if (-not (Test-Path $python)) {
    throw "Virtualenv not found at $python. Create it first (see README Quick start)."
}

Write-Host ''
Write-Host 'Supabase -> Connect -> Session pooler, and copy the connection string.' -ForegroundColor Cyan
Write-Host 'It still contains the [YOUR-PASSWORD] placeholder; that is fine.' -ForegroundColor DarkGray
Write-Host ''

$template = (Read-Host 'Paste the connection string').Trim()
if (-not $template) { throw 'No connection string provided.' }

# postgresql://USER:PASSWORD@HOST:PORT/DBNAME
$pattern = '^(postgres(?:ql)?://[^:/@]+):([^@]*)@(.+)$'
$match = [regex]::Match($template, $pattern)
if (-not $match.Success) {
    throw "That does not look like a Postgres connection string. Expected the form postgresql://user:password@host:port/dbname"
}

$prefix = $match.Groups[1].Value
$suffix = $match.Groups[3].Value

if ($suffix -match ':6543') {
    Write-Host ''
    Write-Host 'Note: that is the TRANSACTION pooler (port 6543).' -ForegroundColor Yellow
    Write-Host 'Migrations are more reliable on the SESSION pooler (port 5432).' -ForegroundColor Yellow
    $go = Read-Host 'Continue anyway? (y/N)'
    if ($go -ne 'y') { Write-Host 'Aborted.'; exit 1 }
}

$secure = Read-Host 'Database password' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
if (-not $plain) { throw 'No password provided.' }

# Percent-encode so characters like @ : / ? # cannot break the URL.
$encoded = [uri]::EscapeDataString($plain)
$databaseUrl = "$prefix`:$encoded@$suffix"
$plain = $null

# Echo back everything except the password, as a sanity check.
$shown = [regex]::Replace($databaseUrl, '^(postgres(?:ql)?://[^:/@]+):([^@]*)@', '$1:********@')
Write-Host ''
Write-Host "Target: $shown" -ForegroundColor Green
Write-Host ''

try {
    $env:DATABASE_URL = $databaseUrl
    $env:PYTHONIOENCODING = 'utf-8'

    if ($ShowMigrations) {
        & $python $manage showmigrations core
        return
    }

    Write-Host '--- Applying migrations ---' -ForegroundColor Cyan
    & $python $manage migrate
    if ($LASTEXITCODE -ne 0) { throw "migrate failed with exit code $LASTEXITCODE" }

    Write-Host ''
    Write-Host '--- Migration state ---' -ForegroundColor Cyan
    & $python $manage showmigrations core

    if ($CreateSuperuser) {
        Write-Host ''
        Write-Host '--- Creating admin account ---' -ForegroundColor Cyan
        & $python $manage createsuperuser
    }

    if ($Seed) {
        Write-Host ''
        Write-Host '--- Seeding sample catalogue data ---' -ForegroundColor Cyan
        & $python $manage seed_demo
    }

    Write-Host ''
    Write-Host 'Done. The production database schema is up to date.' -ForegroundColor Green
}
finally {
    # Always clear, so local development goes back to SQLite.
    Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
    $databaseUrl = $null
    $encoded = $null
}
