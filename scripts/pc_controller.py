#!/usr/bin/env python3
"""
Farhan AI - Universal Offline PC Controller Suite
Complete, deterministic Windows computer automation:
  - System diagnostics & hardware health (RAM, CPU, Drives, Uptime, Power)
  - Audio & media control (Mute, Unmute, Volume Up, Volume Down, Play, Pause, Next, Prev)
  - Window & workstation control (Minimize All, Restore All, Show Desktop, Lock Workstation, Close Window)
  - Process management (List top processes by RAM/CPU, terminate process by name/PID)
  - Application launcher & closer (All Windows apps, tools, browsers, URLs)
  - File and folder operations (Create, delete, list, search, open in Explorer)
  - Full desktop screen capture
"""

import sys
import os
import json
import argparse
import ctypes
import shutil
import subprocess
import time
import urllib.parse
from pathlib import Path
from datetime import datetime

# Windows Virtual-Key codes
VK_LWIN = 0x5B
VK_D = 0x44
VK_M = 0x4D
VK_VOLUME_MUTE = 0xAD
VK_VOLUME_DOWN = 0xAE
VK_VOLUME_UP = 0xAF
VK_MEDIA_NEXT_TRACK = 0xB0
VK_MEDIA_PREV_TRACK = 0xB1
VK_MEDIA_STOP = 0xB2
VK_MEDIA_PLAY_PAUSE = 0xB3

# WM_APPCOMMAND constants
HWND_BROADCAST = 0xFFFF
WM_APPCOMMAND = 0x0319
APPCOMMAND_VOLUME_MUTE = 0x80000
APPCOMMAND_VOLUME_DOWN = 0x90000
APPCOMMAND_VOLUME_UP = 0xA0000
APPCOMMAND_MEDIA_NEXTTRACK = 0xB0000
APPCOMMAND_MEDIA_PREVIOUSTRACK = 0xC0000
APPCOMMAND_MEDIA_STOP = 0xD0000
APPCOMMAND_MEDIA_PLAY_PAUSE = 0xE0000

KEYEVENTF_EXTENDEDKEY = 0x0001
KEYEVENTF_KEYUP = 0x0002

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

def attach_to_user_desktop():
    """
    Attaches the current thread to the interactive 'default' desktop of WinSta0
    so that window management, keybd_event, and screen actions target the user's
    actual display and monitor rather than any background sandbox desktop.
    """
    try:
        DESKTOP_ALL = 0x10000000 | 0x000F0000 | 0x000001FF
        hDesk = user32.OpenDesktopW('default', 0, False, DESKTOP_ALL)
        if hDesk:
            user32.SetThreadDesktop(hDesk)
            return hDesk
    except Exception:
        pass
    return None

def send_key(vk_code):
    """Simulates pressing and releasing a Windows virtual key with scan code on real desktop."""
    attach_to_user_desktop()
    try:
        import win32api
        scan = win32api.MapVirtualKey(vk_code, 0)
    except Exception:
        scan = 0
    user32.keybd_event(vk_code, scan, KEYEVENTF_EXTENDEDKEY, 0)
    time.sleep(0.04)
    user32.keybd_event(vk_code, scan, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0)

# Memory status structure
class MEMORYSTATUSEX(ctypes.Structure):
    _fields_ = [
        ('dwLength', ctypes.c_ulong),
        ('dwMemoryLoad', ctypes.c_ulong),
        ('ullTotalPhys', ctypes.c_ulonglong),
        ('ullAvailPhys', ctypes.c_ulonglong),
        ('ullTotalPageFile', ctypes.c_ulonglong),
        ('ullAvailPageFile', ctypes.c_ulonglong),
        ('ullTotalVirtual', ctypes.c_ulonglong),
        ('ullAvailVirtual', ctypes.c_ulonglong),
        ('sullAvailExtendedVirtual', ctypes.c_ulonglong)
    ]

def get_system_status():
    """Returns real-time RAM, CPU cores, Disks, and Uptime."""
    mem = MEMORYSTATUSEX()
    mem.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
    kernel32.GlobalMemoryStatusEx(ctypes.byref(mem))

    total_ram_gb = round(mem.ullTotalPhys / (1024 ** 3), 2)
    free_ram_gb = round(mem.ullAvailPhys / (1024 ** 3), 2)
    used_ram_gb = round(total_ram_gb - free_ram_gb, 2)
    ram_pct = mem.dwMemoryLoad

    # Query drives
    drives = []
    for letter in 'CDEFGHIJKLMNOPQRSTUVWXYZ':
        root = f"{letter}:\\"
        if os.path.exists(root):
            try:
                total, used, free = shutil.disk_usage(root)
                drives.append({
                    "drive": f"{letter}:",
                    "totalGb": round(total / (1024 ** 3), 1),
                    "usedGb": round(used / (1024 ** 3), 1),
                    "freeGb": round(free / (1024 ** 3), 1),
                    "usedPercent": round((used / total) * 100, 1)
                })
            except Exception:
                pass

    # Uptime via GetTickCount64
    uptime_ms = kernel32.GetTickCount64()
    uptime_hours = round(uptime_ms / (1000 * 3600), 1)

    return {
        "success": True,
        "data": {
            "ram": {
                "totalGb": total_ram_gb,
                "usedGb": used_ram_gb,
                "freeGb": free_ram_gb,
                "percentUsed": ram_pct
            },
            "cpu": {
                "logicalCores": os.cpu_count() or 1,
                "architecture": os.environ.get("PROCESSOR_ARCHITECTURE", "x64")
            },
            "drives": drives,
            "uptimeHours": uptime_hours,
            "timestamp": datetime.now().isoformat()
        }
    }

def control_volume(action, steps=1):
    """Controls volume via direct WM_APPCOMMAND and virtual keys on active user desktop."""
    attach_to_user_desktop()
    action = action.lower()
    if action in ("mute", "unmute", "toggle_mute"):
        user32.SendMessageW(HWND_BROADCAST, WM_APPCOMMAND, 0, APPCOMMAND_VOLUME_MUTE)
        send_key(VK_VOLUME_MUTE)
        return {"success": True, "message": "Toggled volume mute"}
    elif action == "up":
        for _ in range(max(1, steps)):
            user32.SendMessageW(HWND_BROADCAST, WM_APPCOMMAND, 0, APPCOMMAND_VOLUME_UP)
            send_key(VK_VOLUME_UP)
            time.sleep(0.03)
        return {"success": True, "message": f"Volume increased by {steps * 2}%"}
    elif action == "down":
        for _ in range(max(1, steps)):
            user32.SendMessageW(HWND_BROADCAST, WM_APPCOMMAND, 0, APPCOMMAND_VOLUME_DOWN)
            send_key(VK_VOLUME_DOWN)
            time.sleep(0.03)
        return {"success": True, "message": f"Volume decreased by {steps * 2}%"}
    else:
        return {"success": False, "error": f"Unknown volume action: {action}. Use up, down, or mute."}

def control_media(action):
    """Controls media playback via WM_APPCOMMAND and virtual keys."""
    attach_to_user_desktop()
    action = action.lower()
    mapping = {
        "play_pause": (APPCOMMAND_MEDIA_PLAY_PAUSE, VK_MEDIA_PLAY_PAUSE),
        "play": (APPCOMMAND_MEDIA_PLAY_PAUSE, VK_MEDIA_PLAY_PAUSE),
        "pause": (APPCOMMAND_MEDIA_PLAY_PAUSE, VK_MEDIA_PLAY_PAUSE),
        "next": (APPCOMMAND_MEDIA_NEXTTRACK, VK_MEDIA_NEXT_TRACK),
        "prev": (APPCOMMAND_MEDIA_PREVIOUSTRACK, VK_MEDIA_PREV_TRACK),
        "previous": (APPCOMMAND_MEDIA_PREVIOUSTRACK, VK_MEDIA_PREV_TRACK),
        "stop": (APPCOMMAND_MEDIA_STOP, VK_MEDIA_STOP)
    }
    if action in mapping:
        app_cmd, vk = mapping[action]
        user32.SendMessageW(HWND_BROADCAST, WM_APPCOMMAND, 0, app_cmd)
        send_key(vk)
        return {"success": True, "message": f"Media command '{action}' triggered"}
    return {"success": False, "error": f"Unknown media action: {action}"}

def control_windows(action):
    """Window management actions: minimize_all, show_desktop, restore_all, close_active, lock."""
    attach_to_user_desktop()
    action = action.lower()
    if action in ("minimize_all", "desktop", "show_desktop", "toggle_desktop", "minimize"):
        # 1. Enumerate all visible top-level windows on default desktop and minimize them
        try:
            DESKTOP_ALL = 0x10000000 | 0x000F0000 | 0x000001FF
            hDesk = user32.OpenDesktopW('default', 0, False, DESKTOP_ALL)
            if hDesk:
                user32.SetThreadDesktop(hDesk)
                def enum_cb(hwnd, lparam):
                    if user32.IsWindowVisible(hwnd):
                        length = user32.GetWindowTextLengthW(hwnd)
                        if length > 0:
                            buff = ctypes.create_unicode_buffer(length + 1)
                            user32.GetWindowTextW(hwnd, buff, length + 1)
                            title = buff.value
                            if title and title != "Program Manager":
                                user32.ShowWindow(hwnd, 6)  # SW_MINIMIZE
                                user32.PostMessageW(hwnd, 0x0112, 0xF020, 0)  # SC_MINIMIZE
                    return True
                WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
                user32.EnumDesktopWindows(hDesk, WNDENUMPROC(enum_cb), 0)
        except Exception:
            pass

        # 2. Also simulate Win + D on real desktop
        try:
            user32.keybd_event(VK_LWIN, 0, 0, 0)
            user32.keybd_event(VK_D, 0, 0, 0)
            time.sleep(0.04)
            user32.keybd_event(VK_D, 0, KEYEVENTF_KEYUP, 0)
            user32.keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0)
        except Exception:
            pass

        return {"success": True, "message": "All windows minimized. Desktop is shown."}

    elif action in ("restore_all", "restore", "unminimize"):
        try:
            import win32com.client
            shell = win32com.client.Dispatch("Shell.Application")
            shell.UndoMinimizeALL()
            return {"success": True, "message": "All windows restored."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    elif action in ("close_active", "close_window"):
        hwnd = user32.GetForegroundWindow()
        if hwnd:
            user32.PostMessageW(hwnd, 0x0010, 0, 0)  # WM_CLOSE
            return {"success": True, "message": "Active window closed."}
        return {"success": False, "error": "No active window found."}

    elif action in ("lock", "lock_pc", "lock_screen", "lock_workstation"):
        user32.LockWorkStation()
        return {"success": True, "message": "Workstation locked successfully."}

    return {"success": False, "error": f"Unknown window action: {action}"}

def list_processes(limit=15):
    """Returns top running processes sorted by memory usage."""
    try:
        cmd = "tasklist /FO CSV /NH"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        lines = result.stdout.strip().split("\n")
        
        proc_list = []
        for line in lines:
            parts = [p.strip(' "\r') for p in line.split('","')]
            if len(parts) >= 5:
                name = parts[0]
                pid = parts[1]
                mem_str = parts[4].replace(",", "").replace(" K", "").replace("K", "").strip()
                try:
                    mem_kb = int(mem_str)
                    mem_mb = round(mem_kb / 1024, 1)
                except ValueError:
                    mem_mb = 0
                proc_list.append({
                    "name": name,
                    "pid": pid,
                    "memoryMb": mem_mb
                })
        
        # Sort by memory descending
        proc_list.sort(key=lambda x: x["memoryMb"], reverse=True)
        return {"success": True, "data": proc_list[:limit]}
    except Exception as e:
        return {"success": False, "error": str(e)}

def kill_process(target, force=True):
    """Terminates a process by name or PID with alias resolution."""
    attach_to_user_desktop()
    target = target.strip()
    if not target:
        return {"success": False, "error": "No target process specified"}
    
    # Safety guard: prevent killing core Windows processes
    protected = [
        "csrss.exe", "smss.exe", "wininit.exe", "services.exe", "lsass.exe", 
        "explorer.exe", "system", "svchost.exe"
    ]
    if target.lower() in protected:
        return {"success": False, "error": f"Terminating protected system process '{target}' is not allowed."}

    # Special handling for active window
    if target.lower() in ["window", "active window", "this window", "current window"]:
        return control_windows("close_active")

    # Unified Process Lookup from APP_REGISTRY
    t_clean = target.lower().strip()
    targets_to_try = KILL_TARGETS.get(t_clean)
    if not targets_to_try:
        targets_to_try = [target]

    flag = "/F" if force else ""
    last_error = ""
    for t in targets_to_try:
        if t.isdigit():
            cmd = f"taskkill {flag} /PID {t}"
        else:
            if not t.lower().endswith(".exe"):
                t_exe = t + ".exe"
            else:
                t_exe = t
            cmd = f'taskkill {flag} /IM "{t_exe}"'

        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if res.returncode == 0:
            return {"success": True, "message": f"Terminated process '{t}' successfully.", "details": res.stdout.strip()}
        else:
            last_error = res.stderr.strip() or res.stdout.strip()

    return {"success": False, "error": last_error or f"Process '{target}' not found"}

# ==============================================================================
# Comprehensive Installed Applications & System Tools Registry
# ==============================================================================
APP_REGISTRY = {
    # 1. Web Browsers
    "chrome": {
        "name": "Google Chrome",
        "launch": r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "kill": ["chrome.exe"],
        "aliases": ["chrome", "google chrome", "googlechrome", "browser", "web browser", "internet", "web"]
    },
    "edge": {
        "name": "Microsoft Edge",
        "launch": r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "kill": ["msedge.exe"],
        "aliases": ["edge", "microsoft edge", "ms edge", "msedge"]
    },
    "internet explorer": {
        "name": "Internet Explorer",
        "launch": r"C:\Program Files\Internet Explorer\iexplore.exe",
        "kill": ["iexplore.exe"],
        "aliases": ["internet explorer", "ie"]
    },

    # 2. Social, Chat & Communication
    "whatsapp": {
        "name": "WhatsApp Desktop",
        "launch": r"explorer.exe shell:AppsFolder\5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App",
        "kill": ["WhatsApp.Root.exe", "WhatsApp.exe", "WhatsAppDesktop.exe"],
        "aliases": ["whatsapp", "wa", "whatsapp desktop"]
    },
    "chatgpt": {
        "name": "ChatGPT Desktop",
        "launch": r"explorer.exe shell:AppsFolder\OpenAI.Codex_2p2nqsd0c76g0!App",
        "kill": ["codex.exe", "ChatGPT.exe", "OpenAI.Codex.exe"],
        "aliases": ["chatgpt", "chat gpt", "gpt", "openai", "chatgpt desktop"]
    },
    "skype": {
        "name": "Skype",
        "launch": r"explorer.exe shell:AppsFolder\Microsoft.SkypeApp_kzf8qxf38zg5c!App",
        "kill": ["Skype.exe", "SkypeApp.exe"],
        "aliases": ["skype"]
    },
    "phone link": {
        "name": "Phone Link",
        "launch": r"explorer.exe shell:AppsFolder\Microsoft.YourPhone_8wekyb3d8bbwe!App",
        "kill": ["PhoneExperienceHost.exe", "YourPhone.exe"],
        "aliases": ["phone link", "your phone", "phone", "phonelink"]
    },

    # 3. Microsoft Office & Productivity
    "word": {
        "name": "Microsoft Word 2013",
        "launch": r"C:\Program Files (x86)\Microsoft Office\Office15\WINWORD.EXE",
        "kill": ["WINWORD.EXE"],
        "aliases": ["word", "ms word", "microsoft word", "word 2013", "winword"]
    },
    "excel": {
        "name": "Microsoft Excel 2013",
        "launch": r"C:\Program Files (x86)\Microsoft Office\Office15\EXCEL.EXE",
        "kill": ["EXCEL.EXE"],
        "aliases": ["excel", "ms excel", "microsoft excel", "excel 2013"]
    },
    "powerpoint": {
        "name": "Microsoft PowerPoint 2013",
        "launch": r"C:\Program Files (x86)\Microsoft Office\Office15\POWERPNT.EXE",
        "kill": ["POWERPNT.EXE"],
        "aliases": ["powerpoint", "power point", "ppt", "powerpnt", "powerpoint 2013", "presentation"]
    },
    "onenote": {
        "name": "Microsoft OneNote 2013",
        "launch": r"C:\Program Files (x86)\Microsoft Office\Office15\ONENOTE.EXE",
        "kill": ["ONENOTE.EXE", "OneNote.exe", "OneNoteIm.exe"],
        "aliases": ["onenote", "one note", "onenote 2013"]
    },
    "outlook": {
        "name": "Microsoft Outlook 2013",
        "launch": r"C:\Program Files (x86)\Microsoft Office\Office15\OUTLOOK.EXE",
        "kill": ["OUTLOOK.EXE", "olk.exe"],
        "aliases": ["outlook", "email", "mail", "ms outlook", "outlook 2013"]
    },

    # 4. Developer Tools & IDEs
    "android studio": {
        "name": "Android Studio",
        "launch": r"C:\Program Files\Android\Android Studio\bin\studio64.exe",
        "kill": ["studio64.exe", "studio.exe"],
        "aliases": ["android studio", "studio", "androidstudio"]
    },
    "vs code": {
        "name": "Visual Studio Code",
        "launch": os.path.expandvars(r"%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe"),
        "kill": ["Code.exe"],
        "aliases": ["vs code", "vscode", "code", "visual studio code", "editor", "code editor"]
    },
    "antigravity": {
        "name": "Auren / Antigravity",
        "launch": os.path.expandvars(r"%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"),
        "kill": ["Antigravity.exe"],
        "aliases": ["auren", "auren ai", "antigravity", "jarvis", "farhan ai", "agent"]
    },
    "git bash": {
        "name": "Git Bash",
        "launch": r"C:\Program Files\Git\git-bash.exe",
        "kill": ["mintty.exe", "bash.exe"],
        "aliases": ["git bash", "gitbash", "bash"]
    },
    "git gui": {
        "name": "Git GUI",
        "launch": r"C:\Program Files\Git\cmd\git-gui.exe",
        "kill": ["wish.exe"],
        "aliases": ["git gui", "gitgui"]
    },
    "git cmd": {
        "name": "Git CMD",
        "launch": r"C:\Program Files\Git\git-cmd.exe",
        "kill": ["cmd.exe"],
        "aliases": ["git cmd", "gitcmd"]
    },
    "python idle": {
        "name": "Python IDLE",
        "launch": os.path.expandvars(r'%LOCALAPPDATA%\Python\pythoncore-3.14-64\pythonw.exe "%LOCALAPPDATA%\Python\pythoncore-3.14-64\Lib\idlelib\idle.pyw"'),
        "kill": ["pythonw.exe"],
        "aliases": ["idle", "python idle", "python 3.14 idle", "python editor"]
    },
    "node": {
        "name": "Node.js",
        "launch": r"C:\Program Files\nodejs\node.exe",
        "kill": ["node.exe"],
        "aliases": ["node", "nodejs"]
    },

    # 5. Media, Audio & Video
    "vlc": {
        "name": "VLC Media Player",
        "launch": r"C:\Program Files\VideoLAN\VLC\vlc.exe",
        "kill": ["vlc.exe"],
        "aliases": ["vlc", "vlc player", "vlc media player", "video player"]
    },
    "fxsound": {
        "name": "FxSound Equalizer",
        "launch": r"C:\Program Files\FxSound LLC\FxSound\FxSound.exe",
        "kill": ["FxSound.exe"],
        "aliases": ["fxsound", "fx sound", "equalizer", "sound equalizer", "audio boost"]
    },
    "windows media player": {
        "name": "Windows Media Player",
        "launch": r"C:\Program Files (x86)\Windows Media Player\wmplayer.exe",
        "kill": ["wmplayer.exe"],
        "aliases": ["windows media player", "media player", "wmplayer"]
    },
    "movies and tv": {
        "name": "Movies & TV",
        "launch": r"explorer.exe shell:AppsFolder\Microsoft.ZuneVideo_8wekyb3d8bbwe!Microsoft.ZuneVideo",
        "kill": ["Video.UI.exe"],
        "aliases": ["movies and tv", "movies & tv", "movies", "tv", "films"]
    },
    "voice recorder": {
        "name": "Voice Recorder",
        "launch": r"explorer.exe shell:AppsFolder\Microsoft.WindowsSoundRecorder_8wekyb3d8bbwe!App",
        "kill": ["SoundRec.exe"],
        "aliases": ["voice recorder", "sound recorder", "recorder", "audio recorder"]
    },
    "camera": {
        "name": "Camera",
        "launch": r"explorer.exe shell:AppsFolder\Microsoft.WindowsCamera_8wekyb3d8bbwe!App",
        "kill": ["WindowsCamera.exe"],
        "aliases": ["camera", "webcam", "web cam"]
    },
    "photos": {
        "name": "Photos",
        "launch": r"explorer.exe shell:AppsFolder\Microsoft.Windows.Photos_8wekyb3d8bbwe!App",
        "kill": ["PhotosApp.exe", "Microsoft.Photos.exe"],
        "aliases": ["photos", "pictures", "photo viewer", "gallery"]
    },

    # 6. Games & Gaming
    "tlauncher": {
        "name": "TLauncher (Minecraft)",
        "launch": os.path.expandvars(r"%APPDATA%\.minecraft\TLauncher.exe"),
        "kill": ["TLauncher.exe", "javaw.exe"],
        "aliases": ["tlauncher", "minecraft", "tl", "minecraft launcher"]
    },
    "roblox": {
        "name": "Roblox Studio",
        "launch": os.path.expandvars(r"%LOCALAPPDATA%\Roblox\Versions\RobloxStudioInstaller.exe"),
        "kill": ["RobloxStudioInstaller.exe", "RobloxStudioBeta.exe", "RobloxPlayerBeta.exe"],
        "aliases": ["roblox", "roblox studio"]
    },
    "asphalt 8": {
        "name": "Asphalt 8: Airborne",
        "launch": r"explorer.exe shell:AppsFolder\GAMELOFTSA.Asphalt8Airborne_0pp20fcewvvtj!App",
        "kill": ["Asphalt8.exe", "Asphalt8Airborne.exe"],
        "aliases": ["asphalt 8", "asphalt", "asphalt8", "racing game", "car game"]
    },
    "cricket": {
        "name": "World Cricket Championship 2 (WCC2)",
        "launch": r"explorer.exe shell:AppsFolder\NextwaveMultimediaPvtLtd.WCC2_jxdd5nhqtb94j!App",
        "kill": ["WCC2.exe", "WorldCricketChampionship2.exe"],
        "aliases": ["wcc2", "cricket", "cricket game", "world cricket championship", "wcc 2"]
    },
    "solitaire": {
        "name": "Solitaire & Casual Games",
        "launch": r"explorer.exe shell:AppsFolder\Microsoft.MicrosoftSolitaireCollection_8wekyb3d8bbwe!App",
        "kill": ["Solitaire.exe"],
        "aliases": ["solitaire", "cards", "solitaire game"]
    },

    # 7. Utilities & Diagnostics
    "anydesk": {
        "name": "AnyDesk",
        "launch": r"C:\Program Files (x86)\AnyDesk\AnyDesk.exe",
        "kill": ["AnyDesk.exe"],
        "aliases": ["anydesk", "any desk", "remote desktop"]
    },
    "avro keyboard": {
        "name": "Avro Keyboard",
        "launch": r"C:\Program Files (x86)\Avro Keyboard\Avro Keyboard.exe",
        "kill": ["Avro Keyboard.exe"],
        "aliases": ["avro", "avro keyboard", "bangla keyboard", "avrokeyboard"]
    },
    "winrar": {
        "name": "WinRAR",
        "launch": r"C:\Program Files\WinRAR\WinRAR.exe",
        "kill": ["WinRAR.exe"],
        "aliases": ["winrar", "rar", "unzip", "archive", "zip"]
    },
    "wiztree": {
        "name": "WizTree Disk Analyzer",
        "launch": r"C:\Program Files\WizTree\WizTree64.exe",
        "kill": ["WizTree64.exe", "WizTree.exe"],
        "aliases": ["wiztree", "disk analyzer", "disk space", "wiz tree"]
    },
    "free download manager": {
        "name": "Free Download Manager",
        "launch": r"C:\Program Files\Softdeluxe\Free Download Manager\fdm.exe",
        "kill": ["fdm.exe"],
        "aliases": ["fdm", "free download manager", "download manager", "freedownloadmanager"]
    },
    "quicklook": {
        "name": "QuickLook",
        "launch": r"explorer.exe shell:AppsFolder\21090PaddyXu.QuickLook_egxr34yet59cg!Main",
        "kill": ["QuickLook.exe"],
        "aliases": ["quicklook", "quick look"]
    },
    "lively wallpaper": {
        "name": "Lively Wallpaper",
        "launch": r"explorer.exe shell:AppsFolder\12030rocksdanister.LivelyWallpaper_97hta09mmv6hy!App",
        "kill": ["Lively.exe", "Lively.UI.WinUI.exe", "Lively.Common.exe"],
        "aliases": ["lively wallpaper", "lively", "live wallpaper"]
    },
    "cpu-z": {
        "name": "CPUID CPU-Z",
        "launch": r"C:\Program Files\CPUID\CPU-Z\cpuz.exe",
        "kill": ["cpuz.exe"],
        "aliases": ["cpu-z", "cpuz", "cpu info", "cpuid"]
    },
    "crystaldiskinfo": {
        "name": "CrystalDiskInfo",
        "launch": r"C:\Program Files\CrystalDiskInfo\DiskInfo64.exe",
        "kill": ["DiskInfo64.exe", "DiskInfo32.exe"],
        "aliases": ["crystaldiskinfo", "crystal disk", "disk health", "diskinfo"]
    },
    "hwinfo": {
        "name": "HWiNFO64",
        "launch": r"C:\Program Files\HWiNFO64\HWiNFO64.EXE",
        "kill": ["HWiNFO64.EXE", "HWiNFO32.EXE"],
        "aliases": ["hwinfo", "hwinfo64", "hardware info"]
    },

    # 8. Built-in Windows Accessories & Management
    "calculator": {
        "name": "Calculator",
        "launch": "calc",
        "kill": ["CalculatorApp.exe", "calc.exe"],
        "aliases": ["calculator", "calc", "math"]
    },
    "notepad": {
        "name": "Notepad",
        "launch": "notepad",
        "kill": ["notepad.exe"],
        "aliases": ["notepad", "notes", "text editor"]
    },
    "wordpad": {
        "name": "WordPad",
        "launch": "wordpad",
        "kill": ["wordpad.exe"],
        "aliases": ["wordpad"]
    },
    "paint": {
        "name": "Paint",
        "launch": "mspaint",
        "kill": ["mspaint.exe", "PaintStudio.View.exe"],
        "aliases": ["paint", "paint 3d", "drawing", "mspaint"]
    },
    "snipping tool": {
        "name": "Snipping Tool",
        "launch": "snippingtool",
        "kill": ["SnippingTool.exe", "ScreenClippingHost.exe"],
        "aliases": ["snipping tool", "snip", "screenshot tool", "snippingtool"]
    },
    "settings": {
        "name": "Windows Settings",
        "launch": "cmd.exe /c start ms-settings:",
        "kill": ["SystemSettings.exe"],
        "aliases": ["settings", "windows settings", "preferences"]
    },
    "control panel": {
        "name": "Control Panel",
        "launch": "control",
        "kill": ["control.exe"],
        "aliases": ["control panel", "control"]
    },
    "task manager": {
        "name": "Task Manager",
        "launch": "taskmgr",
        "kill": ["taskmgr.exe", "Taskmgr.exe"],
        "aliases": ["task manager", "taskmgr", "tasks", "activity monitor"]
    },
    "file explorer": {
        "name": "File Explorer",
        "launch": "explorer",
        "kill": ["explorer.exe"],
        "aliases": ["explorer", "file explorer", "files", "this pc", "my computer", "file manager"]
    },
    "command prompt": {
        "name": "Command Prompt",
        "launch": "cmd.exe",
        "kill": ["cmd.exe"],
        "aliases": ["cmd", "command prompt", "terminal", "console"]
    },
    "powershell": {
        "name": "Windows PowerShell",
        "launch": "powershell.exe",
        "kill": ["powershell.exe"],
        "aliases": ["powershell", "ps"]
    },
    "windows terminal": {
        "name": "Windows Terminal",
        "launch": "wt",
        "kill": ["WindowsTerminal.exe"],
        "aliases": ["windows terminal", "wt"]
    },
    "registry editor": {
        "name": "Registry Editor",
        "launch": "regedit",
        "kill": ["regedit.exe"],
        "aliases": ["regedit", "registry editor", "registry"]
    },
    "device manager": {
        "name": "Device Manager",
        "launch": "devmgmt.msc",
        "kill": ["mmc.exe"],
        "aliases": ["device manager", "devices"]
    },
    "disk management": {
        "name": "Disk Management",
        "launch": "diskmgmt.msc",
        "kill": ["mmc.exe"],
        "aliases": ["disk management", "partition"]
    },
    "services": {
        "name": "Windows Services",
        "launch": "services.msc",
        "kill": ["mmc.exe"],
        "aliases": ["services", "windows services"]
    },
    "event viewer": {
        "name": "Event Viewer",
        "launch": "eventvwr.msc",
        "kill": ["mmc.exe"],
        "aliases": ["event viewer", "events", "logs"]
    },
    "resource monitor": {
        "name": "Resource Monitor",
        "launch": "resmon.exe",
        "kill": ["resmon.exe"],
        "aliases": ["resource monitor", "resmon"]
    },
    "performance monitor": {
        "name": "Performance Monitor",
        "launch": "perfmon.msc",
        "kill": ["mmc.exe", "perfmon.exe"],
        "aliases": ["performance monitor", "perfmon"]
    },
    "disk cleanup": {
        "name": "Disk Cleanup",
        "launch": "cleanmgr.exe",
        "kill": ["cleanmgr.exe"],
        "aliases": ["disk cleanup", "cleanmgr", "clean disk"]
    },
    "windows security": {
        "name": "Windows Security",
        "launch": "cmd.exe /c start windowsdefender:",
        "kill": ["SecHealthUI.exe"],
        "aliases": ["windows security", "defender", "antivirus", "security"]
    },
    "microsoft store": {
        "name": "Microsoft Store",
        "launch": "cmd.exe /c start ms-windows-store:",
        "kill": ["WinStore.App.exe"],
        "aliases": ["microsoft store", "store", "app store", "windows store"]
    },
    "weather": {
        "name": "Weather",
        "launch": "cmd.exe /c start bingweather:",
        "kill": ["BingWeather.exe"],
        "aliases": ["weather", "forecast"]
    },
    "clock": {
        "name": "Clock & Alarms",
        "launch": "cmd.exe /c start ms-clock:",
        "kill": ["Time.exe"],
        "aliases": ["clock", "alarm", "alarms", "timer", "stopwatch"]
    },
    "sticky notes": {
        "name": "Sticky Notes",
        "launch": r"explorer.exe shell:AppsFolder\Microsoft.MicrosoftStickyNotes_8wekyb3d8bbwe!App",
        "kill": ["Microsoft.Notes.exe"],
        "aliases": ["sticky notes", "stickynotes", "sticky note"]
    },
    "character map": {
        "name": "Character Map",
        "launch": "charmap",
        "kill": ["charmap.exe"],
        "aliases": ["character map", "charmap"]
    },
    "magnifier": {
        "name": "Magnifier",
        "launch": "magnify",
        "kill": ["magnify.exe"],
        "aliases": ["magnifier", "zoom in screen"]
    },
    "on-screen keyboard": {
        "name": "On-Screen Keyboard",
        "launch": "osk",
        "kill": ["osk.exe"],
        "aliases": ["on-screen keyboard", "osk", "virtual keyboard"]
    }
}

# Precompile fast lookup dictionaries
LAUNCH_TARGETS = {}
KILL_TARGETS = {}

for app_id, meta in APP_REGISTRY.items():
    LAUNCH_TARGETS[app_id.lower()] = meta["launch"]
    KILL_TARGETS[app_id.lower()] = meta["kill"]
    for alias in meta.get("aliases", []):
        LAUNCH_TARGETS[alias.lower()] = meta["launch"]
        KILL_TARGETS[alias.lower()] = meta["kill"]

def list_registered_apps():
    """Returns a structured catalog of all registered applications on the user's PC."""
    items = []
    for app_id, meta in sorted(APP_REGISTRY.items(), key=lambda x: x[1]["name"].lower()):
        items.append({
            "id": app_id,
            "name": meta["name"],
            "launch": meta["launch"],
            "killProcesses": meta["kill"],
            "aliases": meta.get("aliases", [])
        })
    return {"success": True, "count": len(items), "apps": items}

def web_search(engine, query):
    """Searches Google or YouTube in the user's default browser on the interactive desktop."""
    attach_to_user_desktop()
    q = urllib.parse.quote_plus(query.strip())
    if engine.lower() == "youtube":
        url = f"https://www.youtube.com/results?search_query={q}"
    else:
        url = f"https://www.google.com/search?q={q}"
    return launch_application(url)

def launch_process_on_desktop(cmd_line):
    """Launches a process explicitly targeted to the user's interactive WinSta0\\default desktop."""
    try:
        import win32process, win32con
        si = win32process.STARTUPINFO()
        si.lpDesktop = r"WinSta0\default"
        si.dwFlags = win32process.STARTF_USESHOWWINDOW
        si.wShowWindow = win32con.SW_SHOWNORMAL
        win32process.CreateProcess(
            None, cmd_line, None, None, False, 0, None, None, si
        )
        return True
    except Exception:
        return False

def launch_application(target, args="", browser=None):
    """Launches an application, tool, URL, or shell path with foreground focus on real desktop."""
    attach_to_user_desktop()
    target = target.strip()
    target_lower = target.lower()

    # Common web & folder aliases
    aliases = {
        # Popular sites
        "youtube": "https://www.youtube.com",
        "google": "https://www.google.com",
        "github": "https://www.github.com",
        "gmail": "https://mail.google.com",
        "chatgpt web": "https://chatgpt.com",
        "reddit": "https://www.reddit.com",
        "twitter": "https://x.com",
        "x": "https://x.com",
        "linkedin": "https://www.linkedin.com",
        "facebook": "https://www.facebook.com",
        "instagram": "https://www.instagram.com",
        "netflix": "https://www.netflix.com",
        "wikipedia": "https://www.wikipedia.org",
        "amazon": "https://www.amazon.com",
        # Folders
        "downloads": os.path.expandvars("%USERPROFILE%\\Downloads"),
        "desktop": os.path.expandvars("%USERPROFILE%\\Desktop"),
        "documents": os.path.expandvars("%USERPROFILE%\\Documents"),
        "pictures": os.path.expandvars("%USERPROFILE%\\Pictures"),
        "photos folder": os.path.expandvars("%USERPROFILE%\\Pictures"),
        "videos": os.path.expandvars("%USERPROFILE%\\Videos"),
        "music": os.path.expandvars("%USERPROFILE%\\Music"),
    }

    # Detect installed browsers
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe")
    ]
    detected_chrome = None
    for cp in chrome_paths:
        if os.path.exists(cp):
            detected_chrome = cp
            break

    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe")
    ]
    detected_edge = None
    for ep in edge_paths:
        if os.path.exists(ep):
            detected_edge = ep
            break

    # Resolve target from APP_REGISTRY first, then aliases, then raw target
    resolved = LAUNCH_TARGETS.get(target_lower, aliases.get(target_lower, target))

    # If it looks like a website / domain (e.g. "youtube.com", "google.com"), prepend https://
    web_tlds = (".com", ".org", ".net", ".io", ".ai", ".edu", ".gov", ".co", ".app", ".dev", ".tv", ".me", ".info", ".biz")
    if (resolved.startswith("www.") or any(resolved.lower().endswith(tld) or f"{tld}/" in resolved.lower() for tld in web_tlds)) and not resolved.startswith(("http://", "https://")):
        resolved = "https://" + resolved

    # Handle URL navigation paths (e.g. site=instagram, args=explore -> https://www.instagram.com/explore)
    if resolved.startswith(("http://", "https://")) and args and not args.startswith("-"):
        clean_args = args.strip().lstrip("/")
        if not clean_args.startswith("http"):
            resolved = f"{resolved.rstrip('/')}/{clean_args}"
            args = ""

    # 1. URLs: Open in specified browser, or detected Edge/Chrome, or default browser
    if resolved.startswith(("http://", "https://")):
        req_browser = (browser or "").lower().strip()
        if "edge" in req_browser and detected_edge:
            if launch_process_on_desktop(f'"{detected_edge}" "{resolved}"'):
                return {"success": True, "message": f"Opened '{resolved}' in Microsoft Edge.", "target": resolved}
        elif "chrome" in req_browser and detected_chrome:
            if launch_process_on_desktop(f'"{detected_chrome}" "{resolved}"'):
                return {"success": True, "message": f"Opened '{resolved}' in Google Chrome.", "target": resolved}

        # If no specific browser requested, prefer Edge if requested or Chrome, then default
        if req_browser == "edge" and detected_edge:
            if launch_process_on_desktop(f'"{detected_edge}" "{resolved}"'):
                return {"success": True, "message": f"Opened '{resolved}' in Microsoft Edge.", "target": resolved}
        elif detected_chrome:
            if launch_process_on_desktop(f'"{detected_chrome}" "{resolved}"'):
                return {"success": True, "message": f"Opened '{resolved}' in Chrome.", "target": resolved}
        elif detected_edge:
            if launch_process_on_desktop(f'"{detected_edge}" "{resolved}"'):
                return {"success": True, "message": f"Opened '{resolved}' in Microsoft Edge.", "target": resolved}

        if launch_process_on_desktop(f'cmd.exe /c start "" "{resolved}"'):
            return {"success": True, "message": f"Opened '{resolved}' in default browser.", "target": resolved}

    # 2. Executable path exists: Launch directly on user desktop
    if os.path.exists(resolved):
        cmd = f'"{resolved}"'
        if args:
            cmd += f' {args}'
        if launch_process_on_desktop(cmd):
            return {"success": True, "message": f"Successfully launched '{resolved}'", "target": resolved}

    # 3. Shell folder command (e.g. explorer.exe shell:AppsFolder\...)
    if resolved.startswith("explorer.exe ") or resolved.startswith("cmd.exe "):
        cmd = resolved
        if args:
            cmd += f' {args}'
        if launch_process_on_desktop(cmd):
            return {"success": True, "message": f"Successfully launched '{resolved}'", "target": resolved}

    # 4. System command / protocol / app: Launch via start on WinSta0\default
    cmd = f'cmd.exe /c start "" "{resolved}"'
    if args:
        cmd += f' {args}'
    if launch_process_on_desktop(cmd):
        return {"success": True, "message": f"Successfully launched '{resolved}'", "target": resolved}

    # 5. Fallback: win32api ShellExecute
    try:
        import win32api, win32con
        hInst = win32api.ShellExecute(0, "open", resolved, args, None, win32con.SW_SHOWNORMAL)
        if hInst > 32:
            return {"success": True, "message": f"Successfully launched '{resolved}'", "target": resolved}
    except Exception:
        pass

    # 6. Last resort: os.startfile
    try:
        os.startfile(resolved)
        return {"success": True, "message": f"Successfully launched '{resolved}'", "target": resolved}
    except Exception as e:
        return {"success": False, "error": f"Failed to launch '{target}': {str(e)}"}

def file_operations(action, path_str, extra=""):
    """Performs file & folder operations."""
    path_obj = Path(os.path.expandvars(path_str))
    
    # Guard against accidental deletion of root drives
    if action == "delete":
        resolved_str = str(path_obj.resolve()).lower()
        if resolved_str in ["c:\\", "c:\\windows", "c:\\program files", "c:\\program files (x86)"]:
            return {"success": False, "error": "Operation prohibited on protected root path."}

    try:
        if action == "create_folder":
            path_obj.mkdir(parents=True, exist_ok=True)
            return {"success": True, "message": f"Directory created: {path_obj.resolve()}"}
        
        elif action == "create_file":
            path_obj.parent.mkdir(parents=True, exist_ok=True)
            with open(path_obj, "w", encoding="utf-8") as f:
                f.write(extra or "")
            return {"success": True, "message": f"File created: {path_obj.resolve()}"}
            
        elif action == "delete":
            if not path_obj.exists():
                return {"success": False, "error": f"Path does not exist: {path_obj}"}
            if path_obj.is_dir():
                shutil.rmtree(path_obj)
            else:
                path_obj.unlink()
            return {"success": True, "message": f"Deleted: {path_obj.resolve()}"}

        elif action == "open_folder":
            attach_to_user_desktop()
            os.startfile(str(path_obj.resolve()))
            return {"success": True, "message": f"Opened folder in Explorer: {path_obj.resolve()}"}

        elif action == "list":
            if not path_obj.exists():
                return {"success": False, "error": f"Directory does not exist: {path_obj}"}
            items = []
            for item in sorted(path_obj.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))[:50]:
                try:
                    stat = item.stat()
                    items.append({
                        "name": item.name,
                        "isDirectory": item.is_dir(),
                        "sizeBytes": stat.st_size if item.is_file() else 0,
                        "lastModified": datetime.fromtimestamp(stat.st_mtime).isoformat()
                    })
                except Exception:
                    pass
            return {"success": True, "data": {"path": str(path_obj.resolve()), "items": items}}

        elif action == "search":
            pattern = extra or "*"
            matches = []
            for p in path_obj.rglob(pattern):
                if len(matches) >= 30:
                    break
                matches.append(str(p.resolve()))
            return {"success": True, "data": {"path": str(path_obj.resolve()), "pattern": pattern, "matches": matches}}

        else:
            return {"success": False, "error": f"Unsupported file action: {action}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def take_screenshot(output_dir="data/screenshots"):
    """Captures screenshot of real user desktop using PIL."""
    attach_to_user_desktop()
    try:
        os.makedirs(output_dir, exist_ok=True)
        filename = f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        filepath = os.path.join(output_dir, filename)

        from PIL import ImageGrab
        img = ImageGrab.grab()
        img.save(filepath)
        return {"success": True, "message": f"Screenshot saved to {filepath}", "path": filepath}
    except Exception as e:
        return {"success": False, "error": str(e)}

def main():
    attach_to_user_desktop()

    parser = argparse.ArgumentParser(description="Farhan AI Offline PC Controller")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # status
    subparsers.add_parser("status")

    # volume
    vol_p = subparsers.add_parser("volume")
    vol_p.add_argument("action", choices=["up", "down", "mute", "unmute", "toggle_mute"])
    vol_p.add_argument("--steps", type=int, default=2)

    # media
    med_p = subparsers.add_parser("media")
    med_p.add_argument("action", choices=["play", "pause", "play_pause", "next", "prev", "stop"])

    # window
    win_p = subparsers.add_parser("window")
    win_p.add_argument("action", choices=["minimize_all", "show_desktop", "toggle_desktop", "minimize", "restore_all", "restore", "close_active", "lock"])

    # process
    proc_p = subparsers.add_parser("process")
    proc_p.add_argument("action", choices=["list", "kill"])
    proc_p.add_argument("--target", default="")
    proc_p.add_argument("--force", action="store_true")
    proc_p.add_argument("--limit", type=int, default=15)

    # app
    app_p = subparsers.add_parser("app")
    app_p.add_argument("action", choices=["launch", "close", "list"])
    app_p.add_argument("target", nargs="?", default="")
    app_p.add_argument("--args", default="")
    app_p.add_argument("--browser", default=None)

    # file
    file_p = subparsers.add_parser("file")
    file_p.add_argument("action", choices=["create_folder", "create_file", "delete", "list", "search", "open_folder"])
    file_p.add_argument("path")
    file_p.add_argument("--extra", default="")

    # screenshot
    subparsers.add_parser("screenshot")

    # search
    search_p = subparsers.add_parser("search")
    search_p.add_argument("engine", choices=["google", "youtube"])
    search_p.add_argument("query")

    args = parser.parse_args()

    if args.command == "status":
        result = get_system_status()
    elif args.command == "volume":
        result = control_volume(args.action, args.steps)
    elif args.command == "media":
        result = control_media(args.action)
    elif args.command == "window":
        result = control_windows(args.action)
    elif args.command == "process":
        if args.action == "list":
            result = list_processes(args.limit)
        else:
            result = kill_process(args.target, args.force)
    elif args.command == "app":
        if args.action == "list":
            result = list_registered_apps()
        elif args.action == "launch":
            result = launch_application(args.target, args.args, args.browser)
        else:
            result = kill_process(args.target, force=True)
    elif args.command == "file":
        result = file_operations(args.action, args.path, args.extra)
    elif args.command == "screenshot":
        result = take_screenshot()
    elif args.command == "search":
        result = web_search(args.engine, args.query)
    else:
        result = {"success": False, "error": f"Unknown command: {args.command}"}

    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
