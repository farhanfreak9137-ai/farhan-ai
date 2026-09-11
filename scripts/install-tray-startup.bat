@echo off
REM ==============================================================================
REM Auren v1.0 — Auto-Start Tray App with Windows
REM Adds Auren Tray App shortcut to Windows Startup folder.
REM ==============================================================================

set "SCRIPT_DIR=%~dp0"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_DIR%\Auren System Tray.lnk"
set "TARGET_VBS=%SCRIPT_DIR%start-tray.vbs"

echo [Auren] Adding System Tray Service to Windows Startup...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%TARGET_VBS%\"'; $s.WorkingDirectory = '%SCRIPT_DIR%..'; $s.Description = 'Auren AI Background System Tray Service'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo.
    echo ==============================================================================
    echo [SUCCESS] Auren System Tray will now start automatically whenever your PC boots!
    echo Shortcut: %SHORTCUT_PATH%
    echo ==============================================================================
) else (
    echo [ERROR] Failed to add startup shortcut.
)
