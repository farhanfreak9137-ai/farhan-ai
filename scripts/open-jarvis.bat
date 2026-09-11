@echo off
REM ==============================================================================
REM Farhan AI v1.0 — Jarvis Voice Mode Launcher
REM Opens Farhan AI directly in dedicated Jarvis Voice mode with auto-mic start.
REM ==============================================================================

set "PORT=3000"
set "URL=http://localhost:%PORT%/voice?autostart=true"

REM Try opening in Microsoft Edge App Mode (native standalone window)
start msedge --app="%URL%" 2>nul
if %errorlevel% equ 0 exit /b

REM Try Google Chrome App Mode
start chrome --app="%URL%" 2>nul
if %errorlevel% equ 0 exit /b

REM Fallback: Open in default browser
start "" "%URL%"
exit /b
