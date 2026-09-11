"""
Auren Desktop System Tray Application & Global Hotkey Listener
Provides a persistent tray icon in the Windows notification area,
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

def create_auren_icon(size=64):
    """Generates a sleek, high-resolution Auren orb icon with a glowing 'A'."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Outer glow
    for r in range(size // 2, size // 2 - 6, -1):
        alpha = int(40 * (size // 2 - r) / 6)
        draw.ellipse([size // 2 - r, size // 2 - r, size // 2 + r, size // 2 + r], fill=(139, 92, 246, alpha))

    # Gradient circle background
    margin = 4
    draw.ellipse([margin, margin, size - margin, size - margin], fill=(15, 23, 42, 255), outline=(6, 182, 212, 255), width=2)
    draw.ellipse([margin + 4, margin + 4, size - margin - 4, size - margin - 4], fill=(30, 27, 75, 255))

    # Center Cyan Orb
    center_r = 14
    c_x, c_y = size // 2, size // 2
    draw.ellipse([c_x - center_r, c_y - center_r, c_x + center_r, c_y + center_r], fill=(6, 182, 212, 220), outline=(255, 255, 255, 255), width=1)

    # Core white glow
    core_r = 6
    draw.ellipse([c_x - core_r, c_y - core_r, c_x + core_r, c_y + core_r], fill=(255, 255, 255, 255))

    return img

class GlobalHotkeyThread(threading.Thread):
    """Registers Ctrl+Alt+J natively via Win32 RegisterHotKey message loop."""
    def __init__(self, on_trigger):
        super().__init__(daemon=True)
        self.on_trigger = on_trigger
        self.running = True

    def run(self):
        attach_to_user_desktop()
        # Register Ctrl+Alt+J
        success = user32.RegisterHotKey(None, HOTKEY_ID_SUMMON, MOD_CONTROL | MOD_ALT, VK_J)
        if not success:
            print("[Auren Tray] Note: Ctrl+Alt+J already registered by system or shortcut.")

        msg = wintypes.MSG()
        while self.running:
            # Check for messages with timeout
            if user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, 1): # PM_REMOVE
                if msg.message == 0x0312:  # WM_HOTKEY
                    if msg.wParam == HOTKEY_ID_SUMMON:
                        try:
                            self.on_trigger()
                        except Exception as e:
                            print(f"[Auren Tray] Hotkey trigger error: {e}")
                user32.TranslateMessage(ctypes.byref(msg))
                user32.DispatchMessageW(ctypes.byref(msg))
            else:
                time.sleep(0.03)

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
    icon.run()

if __name__ == "__main__":
    main()
