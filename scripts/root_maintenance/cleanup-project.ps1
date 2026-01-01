# ============================================================================
# PROJECT CLEANUP SCRIPT
# ============================================================================
# This script removes unnecessary files from the project
# Run this to clean up redundant documentation and temporary files
# ============================================================================

Write-Host "Starting Project Cleanup..." -ForegroundColor Cyan
Write-Host ""

# Files to delete
$filesToDelete = @(
    # Old documentation files
    "AUTOMATION_TESTING.md",
    "DATABASE_DATA_SAVING.md",
    "DATABASE_OPTIMIZATION.md",
    "DATABASE_SETUP.md",
    "DEBUG_500_ERROR.md",
    "DEPLOYMENT.md",
    "DOCKER_SETUP.md",
    "FINAL_SETUP_STEPS.md",
    "FIX_CONNECTION_STRING.md",
    "FIX_ENOTFOUND.md",
    "GAMERS_SPOT_FULL_DOCS.md",
    "GAMERS_SPOT_PROJECT_DOCS.txt",
    "LOCAL_DATABASE_SETUP.md",
    "MULTI_DEVICE_SYNC.md",
    "PAID_EVENTS_SETUP.md",
    "PGADMIN_SETUP_GUIDE.md",
    "QUICK_SUPABASE_SETUP.md",
    "README_DATABASE.md",
    "README_LOCAL_SETUP.md",
    "SETUP_INSTRUCTIONS.md",
    "SUPABASE_CONNECTION.md",
    "SUPABASE_POOLED_CONNECTION.md",
    "SUPABASE_SETUP.md",
    "TESTING_VOICE_ALERTS.md",
    "TROUBLESHOOTING_DB.md",
    "TROUBLESHOOTING_TIMEOUT.md",
    "UPDATE_VERCEL_CONNECTION.md",
    "VERCEL_CONNECTION_STRING.txt",
    "VERCEL_DEPLOYMENT.md",
    "YOUR_SUPABASE_SETUP.md",
    
    # Temporary/debug files
    "check-environment.js",
    "debug-db.js",
    "error.log",
    "websocket.js",
    
    # PowerShell monitoring scripts
    "check_pause_state.ps1",
    "monitor_pause_continuous.ps1",
    "monitor_pause_resume.ps1",
    "run-pause-fix-migration.ps1",
    "test_pause_resume.ps1",
    
    # Batch files
    "create-env-local.bat",
    "setup-database.bat"
)

$deletedCount = 0
$skippedCount = 0

foreach ($file in $filesToDelete) {
    if (Test-Path $file) {
        try {
            Remove-Item $file -Force
            Write-Host "[DELETED] $file" -ForegroundColor Green
            $deletedCount++
        }
        catch {
            Write-Host "[FAILED] $file" -ForegroundColor Red
            Write-Host "  Error: $_" -ForegroundColor Yellow
            $skippedCount++
        }
    }
    else {
        Write-Host "[SKIPPED] $file (not found)" -ForegroundColor Gray
        $skippedCount++
    }
}

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "                    CLEANUP SUMMARY                            " -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "Files deleted:  $deletedCount" -ForegroundColor Green
Write-Host "Files skipped:  $skippedCount" -ForegroundColor Yellow
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "KEPT FILES:" -ForegroundColor Cyan
Write-Host "  - PROJECT_DOCUMENTATION_2025-01-29.txt (Master documentation)" -ForegroundColor Green
Write-Host "  - PRODUCTION_DB_MIGRATION.txt (SQL migration script)" -ForegroundColor Green
Write-Host "  - PROD_MIGRATION_GUIDE.txt (Migration guide)" -ForegroundColor Green
Write-Host "  - DEPLOYMENT_CHECKLIST.txt (Deployment checklist)" -ForegroundColor Green
Write-Host "  - PASSWORD_RECOVERY.txt (Password recovery guide)" -ForegroundColor Green
Write-Host "  - PROJECT_OVERVIEW.md (High-level overview)" -ForegroundColor Green
Write-Host "  - README.md (GitHub readme)" -ForegroundColor Green
Write-Host "  - TEST_ENVIRONMENT_SETUP.md (Test setup guide)" -ForegroundColor Green
Write-Host "  - setup-database.ps1 (Database setup script)" -ForegroundColor Green
Write-Host ""

Write-Host "Cleanup completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review the changes" -ForegroundColor White
Write-Host "  2. Commit: git add . && git commit -m 'chore: cleanup redundant files'" -ForegroundColor White
Write-Host "  3. Push: git push" -ForegroundColor White
Write-Host ""
