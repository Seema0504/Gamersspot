# Gamers Spot - Database Setup Script (PowerShell)
# This script automates the Docker database setup

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Gamers Spot - Database Setup (Docker)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if Docker is running
Write-Host "[1/4] Checking Docker Desktop..." -ForegroundColor Yellow
try {
    $null = docker ps 2>&1
    Write-Host "✓ Docker Desktop is running" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Docker Desktop is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Step 2: Start PostgreSQL container
Write-Host "[2/4] Starting PostgreSQL container..." -ForegroundColor Yellow
try {
    docker-compose up -d
    if ($LASTEXITCODE -ne 0) {
        throw "docker-compose failed"
    }
    Write-Host "✓ Container started" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to start container!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Step 3: Wait for database to be ready
Write-Host "[3/4] Waiting for database to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
Write-Host "✓ Waiting complete" -ForegroundColor Green
Write-Host ""

# Step 4: Verify tables were created
Write-Host "[4/4] Verifying database setup..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
try {
    $result = docker exec gamersspot-db psql -U postgres -d gamersspot -c "\dt" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Database setup verified" -ForegroundColor Green
        
        # Show tables
        Write-Host ""
        Write-Host "Created tables:" -ForegroundColor Cyan
        docker exec gamersspot-db psql -U postgres -d gamersspot -c "\dt" | Select-String -Pattern "public" | ForEach-Object {
            Write-Host "  - $_" -ForegroundColor White
        }
    } else {
        Write-Host "WARNING: Could not verify tables. Database might still be initializing." -ForegroundColor Yellow
        Write-Host "Please wait a few more seconds and check manually." -ForegroundColor Yellow
    }
} catch {
    Write-Host "WARNING: Could not verify tables." -ForegroundColor Yellow
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Database Connection Info:" -ForegroundColor Cyan
Write-Host "  Host: localhost" -ForegroundColor White
Write-Host "  Port: 5432" -ForegroundColor White
Write-Host "  Username: postgres" -ForegroundColor White
Write-Host "  Password: postgres" -ForegroundColor White
Write-Host "  Database: gamersspot" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Create .env.local file with:" -ForegroundColor Yellow
Write-Host "   POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/gamersspot" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Start your app: npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Cyan
Write-Host "  - View logs: docker-compose logs postgres" -ForegroundColor Gray
Write-Host "  - Stop database: docker-compose down" -ForegroundColor Gray
Write-Host "  - Access CLI: docker exec -it gamersspot-db psql -U postgres -d gamersspot" -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to exit"








