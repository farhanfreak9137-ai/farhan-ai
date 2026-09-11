@echo off
REM ==============================================================================
REM Farhan AI v1.0 — Jarvis Windows Global Hotkey Installer
REM Registers Windows shortcut with global hotkey Ctrl+Alt+J.
REM ==============================================================================

echo [Farhan AI] Installing Jarvis global shortcut (Ctrl+Alt+J)...

set "SCRIPT_DIR=%~dp0"
set "TARGET_BAT=%SCRIPT_DIR%open-jarvis.bat"
set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "STARTUP_PROG=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
set "DESKTOP_PATH=%DESKTOP_DIR%\Farhan AI Jarvis.lnk"
set "PROG_PATH=%STARTUP_PROG%\Farhan AI Jarvis.lnk"

echo Creating shortcut on Desktop and in Start Menu Programs...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; foreach ($p in @('%DESKTOP_PATH%', '%PROG_PATH%')) { $s = $ws.CreateShortcut($p); $s.TargetPath = '%TARGET_BAT%'; $s.WorkingDirectory = '%SCRIPT_DIR%..'; $s.Description = 'Farhan AI Jarvis Voice Assistant'; $s.Hotkey = 'CTRL+ALT+J'; $s.Save() }"

if exist "%DESKTOP_PATH%" (
    echo.
    echo ==============================================================================
    echo [SUCCESS] Jarvis Global Hotkey [Ctrl+Alt+J] is now installed!
    echo Desktop Shortcut:    %DESKTOP_PATH%
    echo Start Menu Shortcut: %PROG_PATH%
    echo.
    echo You can now press Ctrl+Alt+J anywhere in Windows to summon Jarvis instantly!
    echo ==============================================================================
) else (
    echo.
    echo [ERROR] Failed to create shortcut.
)

pause
