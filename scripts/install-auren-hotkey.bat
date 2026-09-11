@echo off
REM ==============================================================================
REM Auren v1.0 — Global Hotkey Installer (Ctrl+Alt+J)
REM Registers Windows shortcuts on Desktop and Start Menu for Auren AI.
REM ==============================================================================

echo [Auren] Installing Auren global shortcut (Ctrl+Alt+J)...

set "SCRIPT_DIR=%~dp0"
set "TARGET_BAT=%SCRIPT_DIR%open-auren.bat"
set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "STARTUP_PROG=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
set "DESKTOP_PATH=%DESKTOP_DIR%\Auren AI.lnk"
set "PROG_PATH=%STARTUP_PROG%\Auren AI.lnk"

echo Creating shortcut on Desktop and in Start Menu Programs...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; foreach ($p in @('%DESKTOP_PATH%', '%PROG_PATH%')) { $s = $ws.CreateShortcut($p); $s.TargetPath = '%TARGET_BAT%'; $s.WorkingDirectory = '%SCRIPT_DIR%..'; $s.Description = 'Auren Voice Assistant & AI Companion'; $s.Hotkey = 'CTRL+ALT+J'; $s.Save() }"

if exist "%DESKTOP_PATH%" (
    echo.
    echo ==============================================================================
    echo [SUCCESS] Auren Global Hotkey [Ctrl+Alt+J] is now installed!
    echo Desktop Shortcut:    %DESKTOP_PATH%
    echo Start Menu Shortcut: %PROG_PATH%
    echo.
    echo You can now press Ctrl+Alt+J anywhere in Windows to summon Auren instantly!
    echo ==============================================================================
) else (
    echo.
    echo [ERROR] Failed to create shortcut.
)
