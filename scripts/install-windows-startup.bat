@echo off
REM ==============================================================================
REM Auren AI v1.0 — Windows Auto-Startup Installer
REM Registers Auren AI to start automatically on Windows boot.
REM ==============================================================================

echo [Auren AI] Installing automatic Windows startup...

set "SCRIPT_DIR=%~dp0"
set "TARGET_VBS=%SCRIPT_DIR%start-background.vbs"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\Auren AI Background.lnk"
set "OLD_SHORTCUT=%STARTUP_FOLDER%\FarhanAI.lnk"

if exist "%OLD_SHORTCUT%" del /f /q "%OLD_SHORTCUT%"

echo Creating shortcut in: %STARTUP_FOLDER%

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%TARGET_VBS%\"'; $s.WorkingDirectory = '%SCRIPT_DIR%..'; $s.Description = 'Auren AI Background Service'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo.
    echo ==============================================================================
    echo [SUCCESS] Auren AI is now registered to start automatically on Windows boot!
    echo Target: %SHORTCUT_PATH%
    echo.
    echo To remove Auren AI from startup later, simply delete 'Auren AI Background.lnk' from:
    echo   %STARTUP_FOLDER%
    echo ==============================================================================
) else (
    echo.
    echo [ERROR] Failed to create shortcut. Please check user permissions.
)

pause
