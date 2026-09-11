"""
Auren Desktop Single-Instance & Window Focus Manager
Brings existing Auren Voice Studio window to the foreground on Ctrl+Alt+J
or launches it in standalone app mode if not open.
Prevents opening duplicate windows.
"""
import sys
import os
import socket
import subprocess
import time
import ctypes
from ctypes import wintypes

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

URL = "http://localhost:3000/voice?autostart=true&wakeword=true"

def attach_to_desktop():
    """Attaches thread to the interactive WinSta0\\Default desktop."""
    try:
        hwinsta = user32.OpenWindowStationW("WinSta0", False, 0x00020000 | 0x037F)
        if hwinsta:
            user32.SetProcessWindowStation(hwinsta)
        hdesk = user32.OpenDesktopW("Default", 0, False, 0x01FF)
        if hdesk:
            user32.SetThreadDesktop(hdesk)
            return hdesk
    except Exception:
        pass
    return None

def is_auren_title(title):
    """Checks if window title belongs to Auren Voice Studio."""
    t = title.lower()
    
    # Exclude development environments and shells
    if any(ex in t for ex in ["antigravity", "visual studio", "code", "cmd.exe", "powershell"]):
        return False
        
    # Match Auren window patterns
    if "auren voice studio" in t:
        return True
    if "auren ai" in t and "voice" in t:
        return True
    if "voice studio" in t and ("auren" in t or "ai" in t):
        return True
    if "voice interface" in t:
        return True
    if "localhost:3000" in t and "voice" in t:
        return True
        
    return False

def find_auren_window():
    """Finds any top-level window belonging to Auren Voice Studio."""
    attach_to_desktop()
    found_hwnds = []

    def check_desktop(dname):
        hdesk = user32.OpenDesktopW(dname, 0, False, 0x01FF)
        if not hdesk:
            return
        
        def w_cb(hwnd, _):
            try:
                length = user32.GetWindowTextLengthW(hwnd)
                if length > 0:
                    buff = ctypes.create_unicode_buffer(length + 1)
                    user32.GetWindowTextW(hwnd, buff, length + 1)
                    title = buff.value.strip()
                    if is_auren_title(title):
                        found_hwnds.append(hwnd)
            except Exception:
                pass
            return True

        WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
        user32.EnumDesktopWindows(hdesk, WNDENUMPROC(w_cb), 0)

    # 1. Search Default desktop
    check_desktop("Default")

    # 2. If not found, check other desktops on WinSta0
    if not found_hwnds:
        hwinsta = user32.GetProcessWindowStation()
        desktops = []
        def d_cb(name, _):
            if name.lower() != "default":
                desktops.append(name)
            return True
        DESKTOPENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_wchar_p, ctypes.c_void_p)
        user32.EnumDesktopsW(hwinsta, DESKTOPENUMPROC(d_cb), 0)
        for d in desktops:
            check_desktop(d)

    # 3. Fallback to standard EnumWindows
    if not found_hwnds:
        def enum_cb(hwnd, _):
            try:
                length = user32.GetWindowTextLengthW(hwnd)
                if length > 0:
                    buff = ctypes.create_unicode_buffer(length + 1)
                    user32.GetWindowTextW(hwnd, buff, length + 1)
                    title = buff.value.strip()
                    if is_auren_title(title):
                        found_hwnds.append(hwnd)
            except Exception:
                pass
            return True
        WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
        user32.EnumWindows(WNDENUMPROC(enum_cb), 0)

    return found_hwnds[0] if found_hwnds else None

def bring_window_to_front(hwnd):
    """Restores and focuses a window, bypassing Windows foreground lock."""
    attach_to_desktop()
    SW_RESTORE = 9
    SW_SHOW = 5

    # 1. Unminimize if minimized
    if user32.IsIconic(hwnd):
        user32.ShowWindow(hwnd, SW_RESTORE)
    else:
        user32.ShowWindow(hwnd, SW_SHOW)

    # 2. Attach thread input of foreground thread and current thread
    fg_hwnd = user32.GetForegroundWindow()
    fg_thread = user32.GetWindowThreadProcessId(fg_hwnd, None) if fg_hwnd else 0
    cur_thread = kernel32.GetCurrentThreadId()
    target_thread = user32.GetWindowThreadProcessId(hwnd, None)

    attached_fg = False
    attached_target = False

    if fg_thread and fg_thread != cur_thread:
        attached_fg = user32.AttachThreadInput(cur_thread, fg_thread, True)
    if target_thread and target_thread != cur_thread:
        attached_target = user32.AttachThreadInput(cur_thread, target_thread, True)

    # 3. Simulate Alt key event to bypass Windows foreground restrictions
    user32.keybd_event(0x12, 0, 0, 0)  # ALT down
    user32.BringWindowToTop(hwnd)
    user32.SetForegroundWindow(hwnd)
    user32.SetActiveWindow(hwnd)
    user32.SetFocus(hwnd)
    user32.keybd_event(0x12, 0, 2, 0)  # ALT up

    # 4. Detach thread inputs
    if attached_fg:
        user32.AttachThreadInput(cur_thread, fg_thread, False)
    if attached_target:
        user32.AttachThreadInput(cur_thread, target_thread, False)

def ensure_server_running(port=3000):
    """Ensures Next.js production server is running."""
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.2):
            return True
    except Exception:
        pass

    script_dir = os.path.dirname(os.path.abspath(__file__))
    vbs_path = os.path.join(script_dir, "start-background.vbs")
    if os.path.isfile(vbs_path):
        try:
            subprocess.Popen(f'wscript.exe "{vbs_path}"', shell=True)
        except Exception:
            pass

    for _ in range(20):
        time.sleep(0.5)
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.3):
                return True
        except Exception:
            pass
    return False

def launch_auren():
    """Launches Auren Voice Studio in standalone app mode on the interactive desktop."""
    ensure_server_running(3000)

    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe")
    ]
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe")
    ]

    target_exe = None
    for p in edge_paths:
        if os.path.isfile(p):
            target_exe = p
            break

    if not target_exe:
        for p in chrome_paths:
            if os.path.isfile(p):
                target_exe = p
                break

    if target_exe:
        cmd = f'"{target_exe}" --app="{URL}"'
    else:
        cmd = f'explorer.exe "{URL}"'

    try:
        subprocess.Popen(f'start "" {cmd}', shell=True)
        return True
    except Exception as e:
        print(f"[Error launching Auren]: {e}")
        try:
            os.startfile(URL)
            return True
        except Exception:
            pass
    return False

def toggle_or_focus_auren():
    """Focuses existing Auren window or launches it if not already open."""
    hwnd = find_auren_window()
    if hwnd:
        bring_window_to_front(hwnd)
        return {"action": "focused", "hwnd": hex(hwnd)}
    else:
        launch_auren()
        return {"action": "launched"}

if __name__ == "__main__":
    res = toggle_or_focus_auren()
    print(res)
