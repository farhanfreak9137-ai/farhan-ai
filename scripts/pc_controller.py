#!/usr/bin/env python3
"""
Farhan AI - Native Offline PC Controller Suite
Fully offline, zero-API Windows computer automation.
Provides deterministic system control:
  - System diagnostics & hardware health
  - Audio & media control (volume up/down/mute, play/pause)
  - Window & workstation control (minimize all, lock screen)
  - Process management (list running, terminate)
  - Application launcher & closer
  - File and folder operations (create, delete, list, search)
  - Screen capture
"""

import sys
import os
import json
import argparse
import ctypes
import shutil
import subprocess
import time
from pathlib import Path
from datetime import datetime

# Windows Virtual-Key codes
VK_VOLUME_MUTE = 0xAD
VK_VOLUME_DOWN = 0xAE
VK_VOLUME_UP = 0xAF
VK_MEDIA_NEXT_TRACK = 0xB0
VK_MEDIA_PREV_TRACK = 0xB1
VK_MEDIA_STOP = 0xB2
VK_MEDIA_PLAY_PAUSE = 0xB3

KEYEVENTF_EXTENDEDKEY = 0x0001
KEYEVENTF_KEYUP = 0x0002

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

def send_key(vk_code):
    """Simulates pressing and releasing a Windows virtual key."""
    user32.keybd_event(vk_code, 0, KEYEVENTF_EXTENDEDKEY, 0)
    time.sleep(0.05)
    user32.keybd_event(vk_code, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0)

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
    """Controls volume: up, down, mute."""
    action = action.lower()
    if action == "mute":
        send_key(VK_VOLUME_MUTE)
        return {"success": True, "message": "Toggled volume mute"}
    elif action == "up":
        for _ in range(max(1, steps)):
            send_key(VK_VOLUME_UP)
            time.sleep(0.02)
        return {"success": True, "message": f"Volume increased by {steps * 2}%"}
    elif action == "down":
        for _ in range(max(1, steps)):
            send_key(VK_VOLUME_DOWN)
            time.sleep(0.02)
        return {"success": True, "message": f"Volume decreased by {steps * 2}%"}
    else:
        return {"success": False, "error": f"Unknown volume action: {action}. Use up, down, or mute."}

def control_media(action):
    """Controls media playback: play_pause, next, prev, stop."""
    action = action.lower()
    mapping = {
        "play_pause": VK_MEDIA_PLAY_PAUSE,
        "play": VK_MEDIA_PLAY_PAUSE,
        "pause": VK_MEDIA_PLAY_PAUSE,
        "next": VK_MEDIA_NEXT_TRACK,
        "prev": VK_MEDIA_PREV_TRACK,
        "previous": VK_MEDIA_PREV_TRACK,
        "stop": VK_MEDIA_STOP
    }
    if action in mapping:
        send_key(mapping[action])
        return {"success": True, "message": f"Media command '{action}' triggered"}
    return {"success": False, "error": f"Unknown media action: {action}"}

def control_windows(action):
    """Window management actions: minimize_all, lock."""
    action = action.lower()
    if action in ("minimize_all", "desktop", "show_desktop"):
        # Minimize all windows via Shell.Application COM
        cmd = "powershell -NoProfile -Command \"(New-Object -ComObject Shell.Application).MinimizeAll()\""
        subprocess.run(cmd, shell=True, capture_output=True)
        return {"success": True, "message": "All windows minimized, desktop shown."}
    elif action in ("lock", "lock_pc", "lock_screen"):
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

def kill_process(target, force=False):
    """Terminates a process by name or PID."""
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

    flag = "/F" if force else ""
    if target.isdigit():
        cmd = f"taskkill {flag} /PID {target}"
    else:
        if not target.lower().endswith(".exe"):
            target += ".exe"
        cmd = f"taskkill {flag} /IM \"{target}\""

    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.returncode == 0:
        return {"success": True, "message": f"Terminated process '{target}' successfully.", "details": res.stdout.strip()}
    else:
        return {"success": False, "error": res.stderr.strip() or res.stdout.strip() or f"Failed to kill {target}"}

def launch_application(target, args=""):
    """Launches an application or URL."""
    target = target.strip()
    aliases = {
        "microsoft edge": "msedge",
        "edge": "msedge",
        "google chrome": "chrome",
        "chrome": "chrome",
        "calculator": "calc",
        "calc": "calc",
        "notepad": "notepad",
        "file explorer": "explorer",
        "explorer": "explorer",
        "vs code": "code",
        "vscode": "code",
        "code": "code",
        "terminal": "wt",
        "task manager": "taskmgr",
        "settings": "ms-settings:",
        "control panel": "control",
        "paint": "mspaint"
    }
    resolved = aliases.get(target.lower(), target)
    cmd = f'start "" "{resolved}"'
    if args:
        cmd += f' {args}'
    
    try:
        subprocess.run(cmd, shell=True, check=True)
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
    """Captures screenshot using PIL or PowerShell."""
    try:
        os.makedirs(output_dir, exist_ok=True)
        filename = f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        filepath = os.path.join(output_dir, filename)

        try:
            from PIL import ImageGrab
            img = ImageGrab.grab()
            img.save(filepath)
            return {"success": True, "message": f"Screenshot saved to {filepath}", "path": filepath}
        except Exception:
            # Fallback to PowerShell screen capture script
            ps_script = f"""
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$bmp.Save('{os.path.abspath(filepath)}')
$g.Dispose()
$bmp.Dispose()
"""
            res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, text=True)
            if os.path.exists(filepath):
                return {"success": True, "message": f"Screenshot saved to {filepath}", "path": filepath}
            return {"success": False, "error": "Screen capture unavailable in current desktop session"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def main():
    parser = argparse.ArgumentParser(description="Farhan AI Offline PC Controller")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # status
    subparsers.add_parser("status")

    # volume
    vol_p = subparsers.add_parser("volume")
    vol_p.add_argument("action", choices=["up", "down", "mute"])
    vol_p.add_argument("--steps", type=int, default=2)

    # media
    med_p = subparsers.add_parser("media")
    med_p.add_argument("action", choices=["play", "pause", "play_pause", "next", "prev", "stop"])

    # window
    win_p = subparsers.add_parser("window")
    win_p.add_argument("action", choices=["minimize_all", "lock"])

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
    file_p.add_argument("action", choices=["create_folder", "create_file", "delete", "list", "search"])
    file_p.add_argument("path")
    file_p.add_argument("--extra", default="")

    # screenshot
    subparsers.add_parser("screenshot")

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
    else:
        result = {"success": False, "error": f"Unknown command: {args.command}"}

    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
