# ============================================================================
# Gamers Spot - Multi-Vendor Database Setup Script
# ============================================================================
# This script sets up the multivendor schema in your local PostgreSQL database
# ============================================================================

Write-Host "Gamers Spot - Multi-Vendor Database Setup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Load environment variables from .env.local
if (Test-Path ".env.local") {
    Write-Host "Loading environment variables from .env.local..." -ForegroundColor Yellow
    Get-Content .env.local | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
            Write-Host "   Loaded: $key" -ForegroundColor Green
        }
    }
    Write-Host ""
} else {
    Write-Host "WARNING: .env.local file not found!" -ForegroundColor Red
    Write-Host "   Creating default .env.local..." -ForegroundColor Yellow
    $envContent = @"
# Local PostgreSQL connection
POSTGRES_URL=postgresql://postgres:postgres@localhost:5434/gamersspot-local
"@
    $envContent | Out-File -FilePath ".env.local" -Encoding UTF8
    Write-Host "   Created .env.local with default settings" -ForegroundColor Green
    Write-Host ""
}

# Get database connection string
$POSTGRES_URL = $env:POSTGRES_URL
if (-not $POSTGRES_URL) {
    $POSTGRES_URL = "postgresql://postgres:postgres@localhost:5434/gamersspot-local"
    Write-Host "WARNING: POSTGRES_URL not set, using default: $POSTGRES_URL" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Database Connection: $POSTGRES_URL" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running (for local database)
Write-Host "Checking Docker status..." -ForegroundColor Yellow
try {
    $dockerStatus = docker ps 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Docker is running" -ForegroundColor Green
        
        # Check if gamersspot-local container is running
        $containerStatus = docker ps --filter "name=gamersspot-local" --format "{{.Names}}"
        if ($containerStatus -match "gamersspot-local") {
            Write-Host "   gamersspot-local container is running" -ForegroundColor Green
        } else {
            Write-Host "   WARNING: gamersspot-local container is not running" -ForegroundColor Yellow
            Write-Host "   Starting container..." -ForegroundColor Yellow
            docker-compose up -d
            Start-Sleep -Seconds 3
            Write-Host "   Container started" -ForegroundColor Green
        }
    } else {
        Write-Host "   WARNING: Docker is not running or not installed" -ForegroundColor Yellow
        Write-Host "   Please start Docker Desktop if using local database" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   WARNING: Could not check Docker status" -ForegroundColor Yellow
}
Write-Host ""

# Parse connection string to get psql parameters
Write-Host "Parsing connection string..." -ForegroundColor Yellow
try {
    $uri = [System.Uri]$POSTGRES_URL
    $dbHost = $uri.Host
    $dbPort = $uri.Port
    $dbName = $uri.AbsolutePath.TrimStart('/')
    $userInfo = $uri.UserInfo.Split(':')
    $dbUser = $userInfo[0]
    $dbPassword = if ($userInfo.Length -gt 1) { $userInfo[1] } else { "" }
    
    Write-Host "   Host: $dbHost" -ForegroundColor Gray
    Write-Host "   Port: $dbPort" -ForegroundColor Gray
    Write-Host "   Database: $dbName" -ForegroundColor Gray
    Write-Host "   Username: $dbUser" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "   ERROR: Failed to parse connection string!" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    exit 1
}

# Set PGPASSWORD environment variable for psql
$env:PGPASSWORD = $dbPassword

# Run the multi-vendor setup script
Write-Host "Running multi-vendor schema setup..." -ForegroundColor Cyan
Write-Host ""

$sqlFile = "database\multivendor_setup.sql"

if (-not (Test-Path $sqlFile)) {
    Write-Host "ERROR: SQL file not found: $sqlFile" -ForegroundColor Red
    exit 1
}

Write-Host "Executing: $sqlFile" -ForegroundColor Yellow
Write-Host ""

try {
    # Run psql command
    $psqlCommand = "psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $sqlFile"
    Write-Host "Command: $psqlCommand" -ForegroundColor Gray
    Write-Host ""
    
    # Execute the command
    & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $sqlFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "SUCCESS: Multi-vendor schema setup completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Summary:" -ForegroundColor Cyan
        Write-Host "   Schema: multivendor" -ForegroundColor White
        Write-Host "   Tables: 7 (tenants, stations, invoices, paid_events, snacks, customers, settings)" -ForegroundColor White
        Write-Host "   Default tenant: 'default' (Gamers Spot - Main Branch)" -ForegroundColor White
        Write-Host ""
        Write-Host "Next Steps:" -ForegroundColor Cyan
        Write-Host "   1. Update your application code to use the multivendor schema" -ForegroundColor White
        Write-Host "   2. Test the multi-vendor functionality" -ForegroundColor White
        Write-Host "   3. Add more tenants as needed" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "ERROR: Setup failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host ""
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "ERROR: Error running setup script!" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   - Make sure PostgreSQL is running" -ForegroundColor White
    Write-Host "   - Check your connection string in .env.local" -ForegroundColor White
    Write-Host "   - Verify psql is installed and in your PATH" -ForegroundColor White
    Write-Host "   - For Docker: docker-compose up -d" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Clean up
$env:PGPASSWORD = $null

Write-Host "Setup complete!" -ForegroundColor Green
Write-Host ""
