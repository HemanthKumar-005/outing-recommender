# =============================================================================
# Outing Recommender Platform - Windows / PowerShell Deployment Script
# =============================================================================
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DeployDir = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent $DeployDir

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   Outing Recommender - Production Deployment (PowerShell)" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Check prerequisites
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker is not installed or not in PATH. Please install Docker Desktop."
    exit 1
}

Set-Location $ProjectRoot

# 2. Check environment file
$EnvFile = Join-Path $DeployDir ".env.production"
if (-not (Test-Path $EnvFile)) {
    $RootEnv = Join-Path $ProjectRoot ".env"
    if (Test-Path $RootEnv) {
        Write-Host "Copying root .env to $EnvFile..." -ForegroundColor Yellow
        Copy-Item $RootEnv $EnvFile
    } else {
        Write-Host "Creating $EnvFile from template..." -ForegroundColor Yellow
        Copy-Item (Join-Path $DeployDir ".env.production.example") $EnvFile
        Write-Host "Created $EnvFile. Please review passwords and domain settings, then rerun." -ForegroundColor Green
        exit 0
    }
}

# 3. Pull / Build containers
$ComposeFile = Join-Path $DeployDir "docker-compose.prod.yml"
Write-Host "Building and starting production containers..." -ForegroundColor Cyan
docker compose -f $ComposeFile --env-file $EnvFile up -d --build --remove-orphans

# 4. Wait for database
Write-Host "Checking PostgreSQL readiness..." -ForegroundColor Cyan
$Retries = 20
$Ready = $false
while ($Retries -gt 0 -and -not $Ready) {
    try {
        $result = docker compose -f $ComposeFile exec -T postgres pg_isready -U postgres 2>&1
        if ($LASTEXITCODE -eq 0) {
            $Ready = $true
            break
        }
    } catch {
        # continue waiting
    }
    Start-Sleep -Seconds 2
    $Retries--
    Write-Host "Waiting for database... ($Retries remaining)" -ForegroundColor DarkGray
}

if ($Ready) {
    Write-Host "PostgreSQL is ready!" -ForegroundColor Green
} else {
    Write-Warning "PostgreSQL is taking longer than expected. Continuing..."
}

# 5. Train initial model
Write-Host "Running initial model training check..." -ForegroundColor Cyan
docker compose -f $ComposeFile run --rm model-training-worker

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "   Deployment Succeeded!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "App URL:   http://localhost/"
Write-Host "API Gateway: http://localhost/api/"
Write-Host "API Docs:    http://localhost/api/docs"
Write-Host ""
Write-Host "To view logs: docker compose -f deploy/docker-compose.prod.yml logs -f"
Write-Host "=================================================================" -ForegroundColor Cyan
