@echo off
REM ==============================================================================
REM Farhan AI v1.0 — Windows Auto-Startup Installer
REM Registers Farhan AI to start automatically on Windows boot.
REM ==============================================================================

echo [Farhan AI] Installing automatic Windows startup...

set "SCRIPT_DIR=%~dp0"
set "TARGET_VBS=%SCRIPT_DIR%start-background.vbs"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\FarhanAI.lnk"

echo Creating shortcut in: %STARTUP_FOLDER%

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%TARGET_VBS%\"'; $s.WorkingDirectory = '%SCRIPT_DIR%..'; $s.Description = 'Farhan AI Background Service'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo.
    echo ==============================================================================
    echo [SUCCESS] Farhan AI is now registered to start automatically on Windows boot!
    echo Target: %SHORTCUT_PATH%
    echo.
    echo To remove Farhan AI from startup later, simply delete FarhanAI.lnk from:
    echo   %STARTUP_FOLDER%
    echo ==============================================================================
) else (
    echo.
    echo [ERROR] Failed to create shortcut. Please check user permissions.
)

pause
