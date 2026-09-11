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

    # Common process name aliases
    proc_aliases = {
        "calculator": ["CalculatorApp.exe", "calc.exe"],
        "calc": ["CalculatorApp.exe", "calc.exe"],
        "notepad": ["notepad.exe"],
        "edge": ["msedge.exe"],
        "microsoft edge": ["msedge.exe"],
        "chrome": ["chrome.exe"],
        "google chrome": ["chrome.exe"],
        "brave": ["brave.exe"],
        "firefox": ["firefox.exe"],
        "opera": ["opera.exe"],
        "vscode": ["Code.exe"],
        "vs code": ["Code.exe"],
        "code": ["Code.exe"],
        "terminal": ["WindowsTerminal.exe"],
        "task manager": ["Taskmgr.exe"],
        "taskmgr": ["Taskmgr.exe"],
        "paint": ["mspaint.exe"],
        "spotify": ["Spotify.exe"],
        "vlc": ["vlc.exe"],
        "discord": ["Discord.exe"],
        "whatsapp": ["WhatsApp.exe"],
        "telegram": ["Telegram.exe"],
        "steam": ["steam.exe"],
        "slack": ["slack.exe"],
        "teams": ["ms-teams.exe", "Teams.exe"],
        "zoom": ["Zoom.exe"],
        "word": ["WINWORD.EXE"],
        "excel": ["EXCEL.EXE"],
        "powerpoint": ["POWERPNT.EXE"],
        "control panel": ["control.exe"],
        "settings": ["SystemSettings.exe"]
    }

    targets_to_try = proc_aliases.get(target.lower(), [target])
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
            cmd = f"taskkill {flag} /IM \"{t_exe}\""

        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if res.returncode == 0:
            return {"success": True, "message": f"Terminated process '{t}' successfully.", "details": res.stdout.strip()}
        else:
            last_error = res.stderr.strip() or res.stdout.strip()

    return {"success": False, "error": last_error or f"Process '{target}' not found"}

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

def launch_application(target, args=""):
    """Launches an application, tool, URL, or shell path with foreground focus on real desktop."""
    attach_to_user_desktop()
    target = target.strip()
    
    # Common app & web aliases
    aliases = {
        # Browsers
        "microsoft edge": "msedge",
        "edge": "msedge",
        "google chrome": "chrome",
        "chrome": "chrome",
        "brave": "brave",
        "firefox": "firefox",
        "opera": "opera",
        # Windows built-in tools
        "calculator": "calc",
        "calc": "calc",
        "notepad": "notepad",
        "notes": "notepad",
        "file explorer": "explorer",
        "explorer": "explorer",
        "files": "explorer",
        "my computer": "explorer",
        "this pc": "explorer",
        "vs code": "code",
        "vscode": "code",
        "code": "code",
        "terminal": "wt",
        "windows terminal": "wt",
        "cmd": "cmd.exe",
        "command prompt": "cmd.exe",
        "powershell": "powershell.exe",
        "task manager": "taskmgr",
        "taskmgr": "taskmgr",
        "settings": "ms-settings:",
        "windows settings": "ms-settings:",
        "control panel": "control",
        "paint": "mspaint",
        "paint 3d": "mspaint",
        "snipping tool": "snippingtool",
        "snip": "snippingtool",
        "camera": "microsoft.windows.camera:",
        "photos": "ms-photos:",
        "registry editor": "regedit",
        "regedit": "regedit",
        "device manager": "devmgmt.msc",
        "disk management": "diskmgmt.msc",
        "services": "services.msc",
        "event viewer": "eventvwr.msc",
        # Productivity
        "word": "winword",
        "excel": "excel",
        "powerpoint": "powerpnt",
        "ppt": "powerpnt",
        # Media & social
        "spotify": "spotify",
        "vlc": "vlc",
        "media player": "vlc",
        "whatsapp": "whatsapp:",
        "discord": "discord:",
        "telegram": "telegram",
        "steam": "steam:",
        "slack": "slack",
        "teams": "teams",
        "zoom": "zoom",
        # Common sites
        "youtube": "https://www.youtube.com",
        "google": "https://www.google.com",
        "github": "https://www.github.com",
        "gmail": "https://mail.google.com",
        "chatgpt": "https://chatgpt.com",
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

    # Detect installed browser & app paths
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe")
    ]
    detected_chrome = None
    for cp in chrome_paths:
        if os.path.exists(cp):
            detected_chrome = cp
            aliases["chrome"] = cp
            aliases["google chrome"] = cp
            break

    code_paths = [
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe"),
        r"C:\Program Files\Microsoft VS Code\Code.exe",
        r"C:\Program Files (x86)\Microsoft VS Code\Code.exe"
    ]
    for cdp in code_paths:
        if os.path.exists(cdp):
            aliases["code"] = cdp
            aliases["vs code"] = cdp
            aliases["vscode"] = cdp
            break

    resolved = aliases.get(target.lower(), target)

    # If it looks like a domain without scheme (e.g. "youtube.com"), prepend https://
    if "." in resolved and not resolved.startswith(("http://", "https://", "file://", "ms-", "calc", "notepad")):
        if not os.path.exists(resolved):
            resolved = "https://" + resolved

    # 1. URLs: Open directly in Chrome if installed, or default browser on WinSta0\default
    if resolved.startswith(("http://", "https://")):
        if detected_chrome:
            if launch_process_on_desktop(f'"{detected_chrome}" "{resolved}"'):
                return {"success": True, "message": f"Opened '{resolved}' in Chrome.", "target": resolved}
        if launch_process_on_desktop(f'cmd.exe /c start "" "{resolved}"'):
            return {"success": True, "message": f"Opened '{resolved}' in default browser.", "target": resolved}

    # 2. Executable path exists: Launch directly on user desktop
    if os.path.exists(resolved):
        cmd = f'"{resolved}"'
        if args:
            cmd += f' {args}'
        if launch_process_on_desktop(cmd):
            return {"success": True, "message": f"Successfully launched '{resolved}'", "target": resolved}

    # 3. System command / protocol / app: Launch via start on WinSta0\default
    cmd = f'cmd.exe /c start "" "{resolved}"'
    if args:
        cmd += f' {args}'
    if launch_process_on_desktop(cmd):
        return {"success": True, "message": f"Successfully launched '{resolved}'", "target": resolved}

    # 4. Fallback: win32api ShellExecute
    try:
        import win32api, win32con
        hInst = win32api.ShellExecute(0, "open", resolved, args, None, win32con.SW_SHOWNORMAL)
        if hInst > 32:
            return {"success": True, "message": f"Successfully launched '{resolved}'", "target": resolved}
    except Exception:
        pass

    # 5. Last resort: os.startfile
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
    app_p.add_argument("action", choices=["launch", "close"])
    app_p.add_argument("target")
    app_p.add_argument("--args", default="")

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
        if args.action == "launch":
            result = launch_application(args.target, args.args)
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
