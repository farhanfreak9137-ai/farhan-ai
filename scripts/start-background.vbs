' ==============================================================================
' Farhan AI v1.0 — Silent Background Service Launcher
' Launches Farhan AI in the background without opening a command prompt window.
' ==============================================================================
Option Explicit

Dim WshShell, fso, scriptDir, projectDir, cmd

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the project directory (parent of scripts/)
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

' Set current working directory to project root
WshShell.CurrentDirectory = projectDir

' Command to start production server in background (or dev if preferred)
' Window style 0 hides the command prompt completely
cmd = "cmd.exe /c npm start"

WshShell.Run cmd, 0, False

Set WshShell = Nothing
Set fso = Nothing
