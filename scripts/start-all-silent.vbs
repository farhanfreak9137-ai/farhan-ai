' ==============================================================================
' Auren AI — Master Zero-Console Silent Daemon
' Launches both Auren Backend and Voice Listener silently with 0 terminal windows.
' ==============================================================================
Option Explicit

Dim WshShell, fso, scriptDir, projectDir, nodeExe, nextBin, cmd, pyw

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

WshShell.CurrentDirectory = projectDir

' 1. Check if server on port 3000 is already active
Dim http, serverRunning
serverRunning = False
On Error Resume Next
Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
http.Open "GET", "http://localhost:3000", False
http.setTimeouts 1000, 1000, 1000, 1000
http.Send
If Err.Number = 0 And http.Status = 200 Then
    serverRunning = True
End If
Set http = Nothing
Err.Clear
On Error GoTo 0

' 2. If server not running, start it silently
If Not serverRunning Then
    nodeExe = "C:\Program Files\nodejs\node.exe"
    If Not fso.FileExists(nodeExe) Then
        nodeExe = "C:\Program Files (x86)\nodejs\node.exe"
        If Not fso.FileExists(nodeExe) Then
            nodeExe = "node.exe"
        End If
    End If

    ' Run npm run dev or next dev silently (0 = completely hidden)
    cmd = "cmd.exe /c npx next dev --port 3000"
    WshShell.Run cmd, 0, False
End If

' 3. Start Voice Engine silently with pythonw (0 console window)
pyw = "C:\Users\RCP\AppData\Local\Python\pythoncore-3.14-64\pythonw.exe"
If Not fso.FileExists(pyw) Then
    pyw = "C:\Users\RCP\AppData\Local\Microsoft\WindowsApps\pythonw.exe"
    If Not fso.FileExists(pyw) Then
        pyw = "pythonw.exe"
    End If
End If

Dim voiceScript
voiceScript = scriptDir & "\voice_assistant_jarvis.py"
If fso.FileExists(voiceScript) Then
    WshShell.Run """" & pyw & """ """ & voiceScript & """", 0, False
End If

Set WshShell = Nothing
Set fso = Nothing
