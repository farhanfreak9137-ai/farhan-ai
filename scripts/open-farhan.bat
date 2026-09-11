@echo off
REM ==============================================================================
REM Farhan AI v1.0 — Desktop App Launcher
REM Opens Farhan AI as a dedicated desktop application window.
REM ==============================================================================

set "PORT=3000"
set "URL=http://localhost:%PORT%"
set "SCRIPT_DIR=%~dp0"

REM 1. Check if Farhan AI server is already running on port 3000
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue; if (!$c) { exit 1 } else { exit 0 }"

if %errorlevel% neq 0 (
    echo [Farhan AI] Starting background service...
    wscript.exe "%SCRIPT_DIR%start-background.vbs"
    REM Wait up to 10 seconds for server to be ready
    powershell -NoProfile -Command "for ($i=0; $i -lt 20; $i++) { try { $r = Invoke-WebRequest -Uri 'http://localhost:%PORT%/api/health' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 0"
)

REM 2. Open in Microsoft Edge App Mode (native standalone window)
start msedge --app="%URL%" 2>nul
if %errorlevel% equ 0 exit /b

REM Try Google Chrome App Mode
start chrome --app="%URL%" 2>nul
if %errorlevel% equ 0 exit /b

REM Fallback: Open in default browser
start "" "%URL%"
exit /b
