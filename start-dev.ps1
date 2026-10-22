# SkillBridge AI - Automated Environment & Development Bootstrap
# Usage: .\start-dev.ps1

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   SkillBridge AI - Unified Automated Environment Boot    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check .env file
if (-not (Test-Path ".\.env")) {
    Write-Host "[!] .env not found. Copying .env.example to .env..." -ForegroundColor Yellow
    Copy-Item ".\.env.example" ".\.env"
    Write-Host "[OK] Created .env from template." -ForegroundColor Green
} else {
    Write-Host "[OK] Found root .env configuration." -ForegroundColor Green
}

# 2. Check and start Docker containers (LocalStack, Django Backend, React Frontend)
Write-Host ""
Write-Host "[*] Starting all containers (LocalStack, Backend, Frontend) via Docker Compose..." -ForegroundColor Yellow
docker compose up -d

Write-Host "[OK] All services launched in Docker!" -ForegroundColor Green
Write-Host "     - LocalStack AWS Emulation: http://localhost:4566" -ForegroundColor Cyan
Write-Host "     - Django Backend API:       http://localhost:8000" -ForegroundColor Cyan
Write-Host "     - React Frontend Dashboard: http://localhost:5173" -ForegroundColor Cyan
Write-Host "     - Hot-reloading:            Active (volume-mounted)" -ForegroundColor Cyan

# 3. Instructions & Useful Commands
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   Environment Ready! (Zero Local Dependencies Needed)    " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " View Logs:     docker compose logs -f backend" -ForegroundColor White
Write-Host "                docker compose logs -f frontend" -ForegroundColor White
Write-Host " Stop Services: docker compose down" -ForegroundColor White
Write-Host " Web App:       http://localhost:5173" -ForegroundColor Green
Write-Host " Backend API:   http://localhost:8000/api/" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
