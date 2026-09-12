# scripts/create_desktop_shortcuts.ps1
$ws = New-Object -ComObject WScript.Shell

# 1. Locate msedge.exe or chrome.exe
$browserExe = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $browserExe)) {
    $browserExe = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
if (-not (Test-Path $browserExe)) {
    $browserExe = "C:\Program Files\Google\Chrome\Application\chrome.exe"
}

# 2. Create / Overwrite Desktop Shortcut pointing directly to msedge.exe
$desktop = [System.Environment]::GetFolderPath('Desktop')
$desktopShortcut = Join-Path $desktop "Auren AI.lnk"
$s1 = $ws.CreateShortcut($desktopShortcut)
$s1.TargetPath = $browserExe
$s1.Arguments = "--app=http://localhost:3000"
$s1.WorkingDirectory = [System.IO.Path]::GetDirectoryName($browserExe)
$s1.IconLocation = "$browserExe,0"
$s1.Description = "Auren AI Personal Operating System"
$s1.Save()
Write-Host "Updated Desktop Shortcut: $desktopShortcut -> $browserExe --app=http://localhost:3000"

# 3. Create Windows Auto-Startup Shortcut
$startup = [System.Environment]::GetFolderPath('Startup')
$startupShortcut = Join-Path $startup "Auren AI Daemon.lnk"
$s2 = $ws.CreateShortcut($startupShortcut)
$s2.TargetPath = "wscript.exe"
$s2.Arguments = "`"C:\First Agent\scripts\start-all-silent.vbs`""
$s2.WorkingDirectory = "C:\First Agent"
$s2.Description = "Auren AI Silent Background Daemon"
$s2.Save()
Write-Host "Updated Auto-Startup Shortcut: $startupShortcut"
