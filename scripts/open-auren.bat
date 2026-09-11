@echo off
REM ==============================================================================
REM Auren v1.0 — Voice Studio & AI Companion Launcher
REM Single-instance window toggle & focus manager
REM ==============================================================================

set "PORT=3000"
set "URL=http://localhost:%PORT%/voice?autostart=true&wakeword=true"
set "SCRIPT_DIR=%~dp0"

REM 1. Check if Auren server is running on port 3000
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue; if (!$c) { exit 1 } else { exit 0 }"

if %errorlevel% neq 0 (
    echo [Auren] Starting background server...
    wscript.exe "%SCRIPT_DIR%start-background.vbs"
    powershell -NoProfile -Command "for ($i=0; $i -lt 20; $i++) { try { $r = Invoke-WebRequest -Uri 'http://localhost:%PORT%/api/health' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 0"
)

REM 2. Focus existing Auren window or launch single instance
python "%SCRIPT_DIR%toggle_auren.py"
exit /b
