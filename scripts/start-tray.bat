@echo off
REM ==============================================================================
REM Auren v1.0 — Start Background System Tray Service
REM ==============================================================================

set "SCRIPT_DIR=%~dp0"
echo [Auren] Launching System Tray Service in background...
wscript.exe "%SCRIPT_DIR%start-tray.vbs"
echo [Auren] System Tray Service is active. Look for the Auren icon in your taskbar!
