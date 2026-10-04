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
$hostName = ($suffix -split '[:/]')[0]

# Supabase's direct connection resolves to IPv6 only unless the paid IPv4
# add-on is enabled, so on most home and campus networks it cannot be reached
# at all. The pooler is dual-stack. Catch this up front rather than letting it
# surface as an opaque "No such host is known" from the driver.
if ($hostName -match '^db\..*\.supabase\.co$') {
    Write-Host ''
    Write-Host 'That is the DIRECT connection string, which will not work here.' -ForegroundColor Red
    Write-Host ''
    Write-Host '  Supabase publishes only an IPv6 address for direct connections'
    Write-Host '  unless the IPv4 add-on is purchased. The pooler is reachable over IPv4.'
    Write-Host ''
    Write-Host 'In the Supabase Connect dialog, choose Session pooler instead.' -ForegroundColor Cyan
    Write-Host 'You can tell them apart by shape:' -ForegroundColor Cyan
    Write-Host ''
    Write-Host '  direct   postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres' -ForegroundColor DarkGray
    Write-Host '  pooler   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres' -ForegroundColor Green
    Write-Host ''
    Write-Host 'The pooler one has a dot-ref in the username and pooler.supabase.com as the host.'
    exit 1
}

if ($suffix -match ':6543') {
    Write-Host ''
    Write-Host 'Note: that is the TRANSACTION pooler (port 6543).' -ForegroundColor Yellow
    Write-Host 'Migrations are more reliable on the SESSION pooler (port 5432).' -ForegroundColor Yellow
    $go = Read-Host 'Continue anyway? (y/N)'
    if ($go -ne 'y') { Write-Host 'Aborted.'; exit 1 }
}

# Fail fast and legibly if the host has no IPv4 route from this machine.
try {
    $v4 = Resolve-DnsName -Name $hostName -Type A -ErrorAction Stop |
          Where-Object { $_.IPAddress } | Select-Object -First 1
    if (-not $v4) { throw 'no A record' }
    Write-Host "Resolved $hostName -> $($v4.IPAddress)" -ForegroundColor DarkGray
}
catch {
    Write-Host ''
    Write-Host "Cannot reach $hostName over IPv4." -ForegroundColor Red
    Write-Host 'Check the host spelling, or pick the Session pooler in the Connect dialog.'
    exit 1
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

    # Check credentials first, so a wrong password produces one clear line
    # rather than a Django traceback.
    Write-Host '--- Checking connection ---' -ForegroundColor Cyan
    & $python (Join-Path $PSScriptRoot '_dbcheck.py')
    $checkCode = $LASTEXITCODE

    if ($checkCode -eq 2) {
        Write-Host ''
        Write-Host 'The database password was not accepted.' -ForegroundColor Red
        Write-Host ''
        Write-Host '  This is the database password, which is separate from your'
        Write-Host '  Supabase account login. It was generated when the project was'
        Write-Host '  created and is not shown again afterwards.'
        Write-Host ''
        Write-Host '  If you do not have it, reset it:' -ForegroundColor Cyan
        Write-Host '    Supabase -> Settings -> Database -> Database password -> Reset'
        Write-Host '  Then re-run this script with the new one.'
        Write-Host ''
        Write-Host '  Note: the pooler reports the upstream role, so the message says'
        Write-Host '  user "postgres" even when your username is correct.' -ForegroundColor DarkGray
        exit 1
    }
    if ($checkCode -ne 0) {
        Write-Host ''
        Write-Host 'Could not reach the database. Check the host and port above.' -ForegroundColor Red
        exit 1
    }

    if ($ShowMigrations) {
        & $python $manage showmigrations core
        return
    }

    Write-Host ''
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
