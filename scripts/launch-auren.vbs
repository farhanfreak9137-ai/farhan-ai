' ==============================================================================
' Auren v1.0 — Completely Silent Desktop Launcher
' Runs toggle_auren.py invisibly without any black console flash.
' ==============================================================================
Option Explicit

Dim WshShell, fso, scriptDir, cmd

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
cmd = "pythonw """ & scriptDir & "\toggle_auren.py"""

WshShell.Run cmd, 0, False

Set WshShell = Nothing
Set fso = Nothing
