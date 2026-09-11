"""
Auren Desktop System Tray Application & Global Hotkey Listener
Provides a persistent, single-instance tray icon in the Windows notification area,
global hotkey (Ctrl+Alt+J) registration, and single-instance window toggle.
"""
import os
import sys

# Ensure scripts directory is in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import time
import threading
import subprocess
import webbrowser
import ctypes
from ctypes import wintypes
from PIL import Image, ImageDraw

import pystray
from pystray import MenuItem as item
from toggle_auren import toggle_auren, launch_auren, attach_to_user_desktop

# Win32 Constants
user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
VK_J = 0x4A
HOTKEY_ID_SUMMON = 101
ERROR_ALREADY_EXISTS = 183

def ensure_single_instance():
    """Ensures only one instance of the tray app runs per user session."""
    mutex_name = "Local\\Auren_Tray_App_Mutex_v2"
    h_mutex = kernel32.CreateMutexW(None, False, mutex_name)
    last_err = kernel32.GetLastError()
    if last_err == ERROR_ALREADY_EXISTS:
        # Already running: toggle window and exit this duplicate process
        toggle_auren()
        sys.exit(0)
    return h_mutex

def create_auren_icon(size=64):
    """
    Generates an ultra-vibrant, high-contrast Auren orb icon designed
    specifically for visibility on Windows dark and light taskbars.
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Bold neon cyan outer border ring (width 4px)
    draw.ellipse([2, 2, size - 3, size - 3], fill=(15, 23, 42, 255), outline=(6, 182, 212, 255), width=4)

    # 2. Electric purple glow ring
    draw.ellipse([8, 8, size - 9, size - 9], fill=(88, 28, 135, 255), outline=(168, 85, 247, 255), width=2)

    # 3. Bright cyan center core
    center_r = size // 4
    c = size // 2
    draw.ellipse([c - center_r, c - center_r, c + center_r, c + center_r], fill=(6, 182, 212, 255))

    # 4. Pure white glowing nucleus
    nuc_r = size // 8
    draw.ellipse([c - nuc_r, c - nuc_r, c + nuc_r, c + nuc_r], fill=(255, 255, 255, 255))

    return img

class GlobalHotkeyThread(threading.Thread):
    """Registers Ctrl+Alt+J natively via Win32 RegisterHotKey message loop."""
    def __init__(self, on_trigger):
        super().__init__(daemon=True)
        self.on_trigger = on_trigger
        self.running = True

    def run(self):
        attach_to_user_desktop()
        user32.RegisterHotKey(None, HOTKEY_ID_SUMMON, MOD_CONTROL | MOD_ALT, VK_J)

        msg = wintypes.MSG()
        while self.running:
            if user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, 1):  # PM_REMOVE
                if msg.message == 0x0312:  # WM_HOTKEY
                    if msg.wParam == HOTKEY_ID_SUMMON:
                        try:
                            self.on_trigger()
                        except Exception as e:
                            print(f"[Auren Tray] Hotkey trigger error: {e}")
                user32.TranslateMessage(ctypes.byref(msg))
                user32.DispatchMessageW(ctypes.byref(msg))
            else:
                time.sleep(0.02)

        user32.UnregisterHotKey(None, HOTKEY_ID_SUMMON)

def on_summon(icon=None, item=None):
    toggle_auren()

def on_open_dashboard(icon=None, item=None):
    webbrowser.open("http://localhost:3000")

def on_open_wakeword(icon=None, item=None):
    launch_auren()

def on_restart_server(icon=None, item=None):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    subprocess.Popen(f'wscript.exe "{os.path.join(script_dir, "start-background.vbs")}"', shell=True)

def on_exit(icon, item):
    icon.stop()
    sys.exit(0)

def main():
    attach_to_user_desktop()
    _mutex = ensure_single_instance()

    # Start native hotkey background listener
    hotkey_thread = GlobalHotkeyThread(on_trigger=toggle_auren)
    hotkey_thread.start()

    icon_img = create_auren_icon(64)

    menu = pystray.Menu(
        item("🎙️ Summon Auren (Ctrl+Alt+J)", on_summon, default=True),
        item("🔊 Hands-Free Wake Word Mode", on_open_wakeword),
        item("🌐 Open Auren Hub Dashboard", on_open_dashboard),
        pystray.Menu.SEPARATOR,
        item("🔄 Restart Auren Server", on_restart_server),
        item("❌ Exit Auren", on_exit)
    )

    icon = pystray.Icon("auren_ai", icon_img, "Auren AI Companion", menu)

    def on_setup(ico):
        ico.visible = True
        time.sleep(0.3)
        try:
            ico.notify(
                "Auren is active in your system tray! Click the ^ arrow if hidden, or press Ctrl+Alt+J anytime.",
                "Auren AI Active"
            )
        except Exception:
            pass

    icon.run(setup=on_setup)

if __name__ == "__main__":
    main()
