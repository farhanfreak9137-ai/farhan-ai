@echo off
REM ==============================================================================
REM Auren v1.0 — Voice Studio & AI Companion Launcher
REM Global Hotkey: Ctrl+Alt+J
REM Single-instance window focus & launcher
REM ==============================================================================

set "SCRIPT_DIR=%~dp0"
python "%SCRIPT_DIR%toggle_auren.py"
exit /b
