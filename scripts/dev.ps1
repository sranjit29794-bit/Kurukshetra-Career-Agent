# scripts/dev.ps1
# Starts both the FastAPI backend and Vite frontend from repo root.
# Fails loudly if either process dies.

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " DevProof Development Stack Runner " -ForegroundColor Cyan
Write-Host " Repo Root: $RepoRoot" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Determine Python executable (venv preferred)
$PythonPath = "python"
$VenvPath = Join-Path $RepoRoot "backend\.venv\Scripts\python.exe"
if (Test-Path $VenvPath) {
    $PythonPath = $VenvPath
    Write-Host "[BACKEND] Using virtual environment Python: $PythonPath" -ForegroundColor Green
} else {
    Write-Host "[BACKEND] backend/.venv not found; using system Python: $PythonPath" -ForegroundColor Yellow
}

# 2. Launch Backend (uvicorn from REPO ROOT)
Write-Host "[BACKEND] Starting uvicorn on port 8000 from repo root..." -ForegroundColor Cyan
$backendProc = Start-Process -FilePath $PythonPath -ArgumentList "-m", "uvicorn", "backend.app.main:app", "--port", "8000", "--reload" -WorkingDirectory $RepoRoot -PassThru

# 3. Launch Frontend (npm run dev inside frontend directory)
$FrontendDir = Join-Path $RepoRoot "frontend"
Write-Host "[FRONTEND] Starting Vite dev server on port 5173..." -ForegroundColor Cyan
$frontendProc = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory $FrontendDir -PassThru

Write-Host "`nBoth processes launched. Monitoring health (Ctrl+C to stop)..." -ForegroundColor Green
Write-Host "Backend PID: $($backendProc.Id) | Frontend PID: $($frontendProc.Id)`n"

# 4. Monitor loop: fail loudly if either dies
try {
    while ($true) {
        Start-Sleep -Seconds 2

        if ($backendProc.HasExited) {
            $exitCode = $backendProc.ExitCode
            Write-Host "`n[FATAL ERROR] Backend uvicorn server died unexpectedly with exit code $exitCode!" -ForegroundColor Red
            if (-not $frontendProc.HasExited) {
                Write-Host "Stopping frontend process $($frontendProc.Id)..." -ForegroundColor Yellow
                Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue
            }
            exit 1
        }

        if ($frontendProc.HasExited) {
            $exitCode = $frontendProc.ExitCode
            Write-Host "`n[FATAL ERROR] Frontend Vite dev server died unexpectedly with exit code $exitCode!" -ForegroundColor Red
            if (-not $backendProc.HasExited) {
                Write-Host "Stopping backend process $($backendProc.Id)..." -ForegroundColor Yellow
                Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
            }
            exit 1
        }
    }
} finally {
    Write-Host "`nShutting down dev stack..." -ForegroundColor Yellow
    if ($backendProc -and -not $backendProc.HasExited) {
        Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    }
    if ($frontendProc -and -not $frontendProc.HasExited) {
        Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Dev stack stopped." -ForegroundColor Gray
}
