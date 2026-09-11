@echo off
REM ==============================================================================
REM Auren v1.0 — Voice Studio & AI Companion Launcher
REM Global Hotkey: Ctrl+Alt+J
REM Single-instance window focus & launcher
REM ==============================================================================

set "SCRIPT_DIR=%~dp0"
set "PORT=3000"
set "URL=http://localhost:%PORT%"

set "PROFILE_DIR=%LOCALAPPDATA%\AurenAI\app-profile"

REM 1. Try single-instance focus and launch via Python
set "PY_EXE=C:\Users\RCP\AppData\Local\Python\bin\python.exe"
if not exist "%PY_EXE%" set "PY_EXE=python.exe"

"%PY_EXE%" "%SCRIPT_DIR%toggle_auren.py" 2>nul
if %errorlevel% equ 0 exit /b

REM 2. Fallback: Directly launch Edge in standalone app mode
start msedge --user-data-dir="%PROFILE_DIR%" --app="%URL%" 2>nul
if %errorlevel% equ 0 exit /b

REM 3. Fallback: Directly launch Chrome in app mode
start chrome --user-data-dir="%PROFILE_DIR%" --app="%URL%" 2>nul
if %errorlevel% equ 0 exit /b

REM 4. Fallback: Default browser
start "" "%URL%"
exit /b
