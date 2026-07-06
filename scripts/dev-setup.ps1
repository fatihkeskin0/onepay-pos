$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
pnpm install
pnpm db:generate
Write-Host "Start with: pnpm dev"
