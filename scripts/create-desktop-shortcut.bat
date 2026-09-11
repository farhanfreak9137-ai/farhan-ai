@echo off
set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "SHORTCUT=%DESKTOP_DIR%\Farhan AI.lnk"
set "TARGET=%~dp0open-farhan.bat"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%TARGET%'; $s.WorkingDirectory = '%~dp0..'; $s.Description = 'Farhan AI Desktop App'; $s.Save()"

if exist "%SHORTCUT%" (
    echo [SUCCESS] Farhan AI desktop app shortcut created on your Desktop!
) else (
    echo [ERROR] Could not create shortcut.
)
