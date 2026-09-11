' ==============================================================================
' Auren AI v1.0 — Silent Background Service Launcher
' Launches Next.js production server in background with zero window flash.
' ==============================================================================
Option Explicit

Dim WshShell, fso, scriptDir, projectDir, nodeExe, nextBin, cmd

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the project directory (parent of scripts/)
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

WshShell.CurrentDirectory = projectDir

' Locate node.exe
nodeExe = "C:\Program Files\nodejs\node.exe"
If Not fso.FileExists(nodeExe) Then
    nodeExe = "C:\Program Files (x86)\nodejs\node.exe"
    If Not fso.FileExists(nodeExe) Then
        nodeExe = "node.exe"
    End If
End If

nextBin = projectDir & "\node_modules\next\dist\bin\next"

' Launch Next.js production server directly (window style 0 = completely hidden)
cmd = """" & nodeExe & """ """ & nextBin & """ start"

WshShell.Run cmd, 0, False

Set WshShell = Nothing
Set fso = Nothing
