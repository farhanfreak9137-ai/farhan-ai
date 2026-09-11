Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
SCRIPT_DIR = FSO.GetParentFolderName(WScript.ScriptFullName)
LOCAL_APPDATA = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
PYTHONW_PATH = LOCAL_APPDATA & "\Python\bin\pythonw.exe"

If Not FSO.FileExists(PYTHONW_PATH) Then
    PYTHONW_PATH = "pythonw.exe"
End If

WshShell.Run """" & PYTHONW_PATH & """ """ & SCRIPT_DIR & "\tray_app.py""", 0, False
