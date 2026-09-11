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

class STARTUPINFO(ctypes.Structure):
    _fields_ = [
        ("cb", wintypes.DWORD),
        ("lpReserved", wintypes.LPWSTR),
        ("lpDesktop", wintypes.LPWSTR),
        ("lpTitle", wintypes.LPWSTR),
        ("dwX", wintypes.DWORD),
        ("dwY", wintypes.DWORD),
        ("dwXSize", wintypes.DWORD),
        ("dwYSize", wintypes.DWORD),
        ("dwXCountChars", wintypes.DWORD),
        ("dwYCountChars", wintypes.DWORD),
        ("dwFillAttribute", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("wShowWindow", wintypes.WORD),
        ("cbReserved2", wintypes.WORD),
        ("lpReserved2", ctypes.c_char_p),
        ("hStdInput", wintypes.HANDLE),
        ("hStdOutput", wintypes.HANDLE),
        ("hStdError", wintypes.HANDLE),
    ]

class PROCESS_INFORMATION(ctypes.Structure):
    _fields_ = [
        ("hProcess", wintypes.HANDLE),
        ("hThread", wintypes.HANDLE),
        ("dwProcessId", wintypes.DWORD),
        ("dwThreadId", wintypes.DWORD),
    ]

URL = "http://localhost:3000"

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
    """Checks if window title belongs to Auren AI Desktop Application."""
    t = title.lower()
    
    # Exclude development environments, shells, editors, and scripts
    if any(ex in t for ex in ["antigravity", "visual studio", "code", ".bat", ".py", ".ts", ".json", ".md", ".vbs", "cmd.exe", "powershell", "terminal"]):
        return False
        
    # Match Auren window patterns
    if "auren ai — personal operating system" in t or "auren voice studio" in t:
        return True
    if "auren ai" in t and ("operating system" in t or "voice" in t or "hub" in t or "automation" in t):
        return True
    if "voice studio | auren ai" in t:
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

    # 1. Search Default desktop (the user's visible desktop)
    check_desktop("Default")

    # 2. Fallback to standard EnumWindows
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

def ensure_ollama_running(port=11434):
    """Ensures Ollama background AI engine is running."""
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.2):
            return True
    except Exception:
        pass

    ollama_paths = [
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Ollama\ollama app.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Ollama\ollama.exe"),
    ]
    for p in ollama_paths:
        if os.path.isfile(p):
            try:
                subprocess.Popen([p], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                break
            except Exception:
                pass
    return False

def launch_auren():
    """Launches Auren in standalone app mode on the interactive desktop."""
    ensure_server_running(3000)
    ensure_ollama_running(11434)

    profile_dir = os.path.expandvars(r"%LOCALAPPDATA%\AurenAI\app-profile")
    os.makedirs(profile_dir, exist_ok=True)

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

    launch_args = f'--user-data-dir="{profile_dir}" --app="{URL}" --no-first-run --no-default-browser-check'

    # 1. Primary: CreateProcessW explicitly targeting WinSta0\Default interactive desktop
    if target_exe:
        try:
            si = STARTUPINFO()
            si.cb = ctypes.sizeof(STARTUPINFO)
            si.lpDesktop = "WinSta0\\Default"
            si.dwFlags = 1  # STARTF_USESHOWWINDOW
            si.wShowWindow = 1  # SW_SHOWNORMAL
            pi = PROCESS_INFORMATION()
            full_cmd = f'"{target_exe}" {launch_args}'
            if kernel32.CreateProcessW(None, full_cmd, None, None, False, 0, None, None, ctypes.byref(si), ctypes.byref(pi)):
                kernel32.CloseHandle(pi.hProcess)
                kernel32.CloseHandle(pi.hThread)
                return True
        except Exception as e:
            print(f"[CreateProcess error]: {e}")

    # 2. Secondary: Windows ShellExecute via win32api
    if target_exe:
        try:
            import win32api, win32con
            h = win32api.ShellExecute(0, "open", target_exe, launch_args, None, win32con.SW_SHOWNORMAL)
            if h > 32:
                return True
        except Exception as e:
            print(f"[ShellExecute error]: {e}")

    # 3. Tertiary: Windows cmd start with dedicated profile
    try:
        cmd = f'"{target_exe}" {launch_args}' if target_exe else f'explorer.exe "{URL}"'
        subprocess.Popen(f'start "" {cmd}', shell=True)
        return True
    except Exception as e:
        print(f"[Popen start error]: {e}")

    # 4. Fallback: os.startfile
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
