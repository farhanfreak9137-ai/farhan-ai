@echo off
REM ==============================================================================
REM Farhan AI v1.0 — Desktop App Launcher
REM Opens Farhan AI as a dedicated desktop application window.
REM ==============================================================================

set "PORT=3000"
set "URL=http://localhost:%PORT%"

REM Try opening in Microsoft Edge App Mode (native window look)
start msedge --app="%URL%" 2>nul
if %errorlevel% equ 0 exit /b

REM Try Google Chrome App Mode
start chrome --app="%URL%" 2>nul
if %errorlevel% equ 0 exit /b

REM Fallback: Open in default browser
start "" "%URL%"
exit /b
