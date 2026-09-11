@echo off
set "SCRIPT_DIR=%~dp0"
set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "SHORTCUT=%DESKTOP_DIR%\Auren AI.lnk"
set "TARGET_VBS=%SCRIPT_DIR%launch-auren.vbs"
set "ICON_PATH=%SCRIPT_DIR%auren.ico"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%TARGET_VBS%\"'; $s.WorkingDirectory = '%SCRIPT_DIR%..'; $s.Description = 'Auren AI Desktop Application'; $s.Hotkey = 'CTRL+ALT+J'; $s.WindowStyle = 1; if (Test-Path '%ICON_PATH%') { $s.IconLocation = '%ICON_PATH%,0' }; $s.Save()"

if exist "%SHORTCUT%" (
    echo [SUCCESS] Auren AI desktop app shortcut created on your Desktop!
) else (
    echo [ERROR] Could not create shortcut.
)
