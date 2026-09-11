' ==============================================================================
' Auren v1.0 — Completely Silent Desktop Launcher
' Runs toggle_auren.py invisibly without any black console flash.
' ==============================================================================
Option Explicit

Dim WshShell, fso, scriptDir, cmd, pyw
Dim ret

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

pyw = "C:\Users\RCP\AppData\Local\Python\bin\pythonw.exe"
If Not fso.FileExists(pyw) Then
    pyw = "pythonw.exe"
End If

cmd = """" & pyw & """ """ & scriptDir & "\toggle_auren.py"""

On Error Resume Next
ret = WshShell.Run(cmd, 0, True)

Dim profileDir
profileDir = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%\AurenAI\app-profile")

If Err.Number <> 0 Or ret <> 0 Then
    ' Fallback directly to Edge app mode with dedicated profile
    WshShell.Run "cmd.exe /c start msedge --user-data-dir=""" & profileDir & """ --app=""http://localhost:3000""", 0, False
End If

Set WshShell = Nothing
Set fso = Nothing
