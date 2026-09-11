@echo off
REM ==============================================================================
REM Farhan AI v1.0 — Jarvis Windows Global Hotkey Installer
REM Registers Windows shortcut with global hotkey Ctrl+Alt+J.
REM ==============================================================================

echo [Farhan AI] Installing Jarvis global shortcut (Ctrl+Alt+J)...

set "SCRIPT_DIR=%~dp0"
set "TARGET_BAT=%SCRIPT_DIR%open-jarvis.bat"
set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "SHORTCUT_PATH=%DESKTOP_DIR%\Farhan AI Jarvis.lnk"

echo Creating shortcut on Desktop...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%TARGET_BAT%'; $s.WorkingDirectory = '%SCRIPT_DIR%..'; $s.Description = 'Farhan AI Jarvis Voice Assistant'; $s.Hotkey = 'CTRL+ALT+J'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo.
    echo ==============================================================================
    echo [SUCCESS] Jarvis Global Hotkey [Ctrl+Alt+J] is now installed!
    echo Shortcut: %SHORTCUT_PATH%
    echo.
    echo You can now press Ctrl+Alt+J anywhere in Windows to summon Jarvis instantly!
    echo ==============================================================================
) else (
    echo.
    echo [ERROR] Failed to create shortcut.
)

pause
