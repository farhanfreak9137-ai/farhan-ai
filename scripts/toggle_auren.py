"""
Auren Desktop Single-Instance & Window Focus Manager
Brings existing Auren Voice Studio window to the foreground on Ctrl+Alt+J
or launches it in standalone app mode if not open.
"""
import sys
import os
import subprocess
import time
import ctypes
from ctypes import wintypes

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

def attach_to_user_desktop():
    """Attaches thread to the interactive default desktop."""
    try:
        DESKTOP_ALL = 0x10000000 | 0x000F0000 | 0x000001FF
        hDesk = user32.OpenDesktopW('default', 0, False, DESKTOP_ALL)
        if hDesk:
            user32.SetThreadDesktop(hDesk)
            return hDesk
    except Exception:
        pass
    return None

def find_auren_window():
    """Finds any top-level window belonging to Auren Voice Studio / Edge App."""
    attach_to_user_desktop()
    found_hwnds = []

    def enum_cb(hwnd, lparam):
        if user32.IsWindowVisible(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buff = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buff, length + 1)
                title = buff.value.lower()
                # Match Auren window titles or voice studio
                if (
                    "auren" in title or
                    "voice interface" in title or
                    "voice studio" in title or
                    "farhan ai" in title or
                    ("localhost:3000" in title and "voice" in title)
                ):
                    # Filter out IDE / code editor windows
                    if "antigravity ide" not in title and "visual studio" not in title:
                        found_hwnds.append(hwnd)
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
    user32.EnumWindows(WNDENUMPROC(enum_cb), 0)
    return found_hwnds[0] if found_hwnds else None

def bring_window_to_front(hwnd):
    """Restores and focuses a window, bypassing Windows foreground lock."""
    attach_to_user_desktop()
    SW_RESTORE = 9
    SW_SHOW = 5

    # Check if iconic (minimized)
    if user32.IsIconic(hwnd):
        user32.ShowWindow(hwnd, SW_RESTORE)
    else:
        user32.ShowWindow(hwnd, SW_SHOW)

    # Attach thread input to steal focus if Windows restricts SetForegroundWindow
    cur_thread = kernel32.GetCurrentThreadId()
    fg_hwnd = user32.GetForegroundWindow()
    fg_thread = user32.GetWindowThreadProcessId(fg_hwnd, None) if fg_hwnd else 0

    if cur_thread != fg_thread and fg_thread != 0:
        user32.AttachThreadInput(cur_thread, fg_thread, True)
        user32.BringWindowToTop(hwnd)
        user32.SetForegroundWindow(hwnd)
        user32.AttachThreadInput(cur_thread, fg_thread, False)
    else:
        user32.BringWindowToTop(hwnd)
        user32.SetForegroundWindow(hwnd)

def launch_auren():
    """Launches Auren Voice Studio in an isolated standalone desktop app window."""
    url = "http://localhost:3000/voice?autostart=true&wakeword=true"
    profile_dir = os.path.expandvars(r"%LOCALAPPDATA%\AurenAI\Profile")
    try:
        os.makedirs(profile_dir, exist_ok=True)
    except Exception:
        pass
    
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe")
    ]
    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe")
    ]

    for p in chrome_paths:
        if os.path.isfile(p):
            try:
                subprocess.Popen(f'"{p}" --app="{url}"', shell=True)
                return True
            except Exception:
                pass

    for p in edge_paths:
        if os.path.isfile(p):
            try:
                subprocess.Popen(f'"{p}" --user-data-dir="{profile_dir}" --app="{url}"', shell=True)
                return True
            except Exception:
                pass

    # Fallback to default browser
    try:
        os.startfile(url)
        return True
    except Exception:
        pass
    return False

def toggle_auren():
    """Toggles or summons Auren."""
    hwnd = find_auren_window()
    if hwnd:
        fg_hwnd = user32.GetForegroundWindow()
        if fg_hwnd == hwnd:
            # Already active in foreground: minimize it for quick dismiss
            user32.ShowWindow(hwnd, 6)  # SW_MINIMIZE
            return {"action": "minimized", "hwnd": hex(hwnd)}
        else:
            bring_window_to_front(hwnd)
            return {"action": "focused", "hwnd": hex(hwnd)}
    else:
        launch_auren()
        return {"action": "launched"}

if __name__ == "__main__":
    res = toggle_auren()
    print(res)
