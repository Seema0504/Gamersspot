# Setup Fresh Game Management System Database
Write-Host "🚀 Setting up Game Management System Database..." -ForegroundColor Cyan

$CONTAINER_NAME = "game-management-system"
$DB_NAME = "gamersspot"
$DB_USER = "postgres"
$DB_PASSWORD = "postgres"
$DB_PORT = "5434"

# Step 1: Remove old container if exists
Write-Host "`n📋 Checking for existing container..." -ForegroundColor Yellow
$existing = docker ps -a --filter "name=$CONTAINER_NAME" --format "{{.Names}}"
if ($existing -eq $CONTAINER_NAME) {
    Write-Host "⚠️  Removing old container..." -ForegroundColor Yellow
    docker rm -f $CONTAINER_NAME | Out-Null
    Write-Host "✅ Old container removed" -ForegroundColor Green
}

# Step 2: Create new container
Write-Host "`n📦 Creating new PostgreSQL container..." -ForegroundColor Yellow
docker run -d --name $CONTAINER_NAME -e POSTGRES_USER=$DB_USER -e POSTGRES_PASSWORD=$DB_PASSWORD -e POSTGRES_DB=$DB_NAME -p ${DB_PORT}:5432 -v game-management-data:/var/lib/postgresql/data postgres:15

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create container" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Container created" -ForegroundColor Green

# Step 3: Wait for PostgreSQL
Write-Host "`n⏳ Waiting for PostgreSQL..." -ForegroundColor Yellow
$maxAttempts = 30
for ($i = 1; $i -le $maxAttempts; $i++) {
    $result = docker exec $CONTAINER_NAME pg_isready -U $DB_USER 2>&1
    if ($result -match "accepting connections") {
        Write-Host "✅ PostgreSQL is ready" -ForegroundColor Green
        break
    }
    Write-Host "   Attempt $i/$maxAttempts..." -ForegroundColor Gray
    Start-Sleep -Seconds 1
}

# Step 4: Apply schema from file
Write-Host "`n🔨 Creating database schema..." -ForegroundColor Yellow
$sqlFile = Join-Path $PSScriptRoot "scripts\local-db-schema.sql"
docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < $sqlFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Schema created successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to create schema" -ForegroundColor Red
    exit 1
}

# Step 5: Display info
Write-Host "`n🎉 Setup completed!" -ForegroundColor Green
Write-Host "`n📝 Connection Details:" -ForegroundColor Cyan
Write-Host "   postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}" -ForegroundColor Yellow
Write-Host "`n🔑 Login:" -ForegroundColor Cyan
Write-Host "   Super Admin: admin / admin2026" -ForegroundColor White
Write-Host "   Shop Owner: shop1 / admin2026" -ForegroundColor White
Write-Host "`n⚙️  Update .env:" -ForegroundColor Cyan
Write-Host "   POSTGRES_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}" -ForegroundColor Yellow
