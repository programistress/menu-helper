# PowerShell script to push database schema to production
# Usage: .\push-schema.ps1

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "MenuHelper - Push Database Schema" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "ERROR: DATABASE_URL not set!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set your DATABASE_URL first:" -ForegroundColor Yellow
    Write-Host '  $env:DATABASE_URL="postgresql://your-connection-string"' -ForegroundColor Green
    Write-Host ""
    Write-Host "You can find your DATABASE_URL in:" -ForegroundColor Yellow
    Write-Host "  - Vercel Dashboard -> Project -> Settings -> Environment Variables" -ForegroundColor White
    Write-Host "  - Neon Dashboard -> Connection Details" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "DATABASE_URL found" -ForegroundColor Green
Write-Host ""

# Set NODE_ENV to production
$env:NODE_ENV = "production"
Write-Host "NODE_ENV set to production" -ForegroundColor Green
Write-Host ""

# Run db:push
Write-Host "Pushing schema to production database..." -ForegroundColor Yellow
Write-Host ""

npm run db:push

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==================================" -ForegroundColor Green
    Write-Host "Schema pushed successfully!" -ForegroundColor Green
    Write-Host "==================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your app should now work properly!" -ForegroundColor Green
    Write-Host "Test it at: https://your-project.vercel.app" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "==================================" -ForegroundColor Red
    Write-Host "Schema push failed!" -ForegroundColor Red
    Write-Host "==================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try using the SQL file instead:" -ForegroundColor Yellow
    Write-Host "  1. Open your database dashboard" -ForegroundColor White
    Write-Host "  2. Go to SQL Editor" -ForegroundColor White
    Write-Host "  3. Copy contents from create-schema.sql" -ForegroundColor White
    Write-Host "  4. Run the SQL commands" -ForegroundColor White
}
