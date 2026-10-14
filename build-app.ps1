# Build + install the Desktop Clock app (widget + built-in wallpaper).
#
# ALWAYS use this instead of a bare `cargo build --release`: the release
# frontend is only embedded when the `custom-protocol` feature is enabled.
#
# Usage:  powershell -ExecutionPolicy Bypass -File .\build-app.ps1 [-Install]

param([switch]$Install)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

Write-Host "==> Building frontend (vite)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "frontend build failed" }

Write-Host "==> Building Rust binary (custom-protocol embeds the frontend)..." -ForegroundColor Cyan
Push-Location src-tauri
cargo build --release --features custom-protocol
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw "rust build failed" }

$built = Join-Path $root "src-tauri\target\release\desktop-clock.exe"
Write-Host "==> Built: $built" -ForegroundColor Green

if ($Install) {
    $dest = Join-Path $env:LOCALAPPDATA "Desktop Clock\desktop-clock.exe"
    if (-not (Test-Path (Split-Path $dest))) { throw "App not installed; run the installer first." }
    Get-Process desktop-clock -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    Copy-Item $built $dest -Force
    Write-Host "==> Installed to: $dest" -ForegroundColor Green
    Start-Process $dest -ArgumentList "--autostart"
    Write-Host "==> Launched." -ForegroundColor Green
}
