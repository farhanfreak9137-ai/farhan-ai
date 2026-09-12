import os
import sys
import json
import time
import tkinter as tk

STATE_FILE = os.path.abspath("data/voice_hud_state.json")

class FloatingHUD:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Auren HUD")
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        self.root.attributes("-alpha", 0.88)
        self.root.config(bg="#070A12")

        # Top-left corner: x=24, y=24, width=360, height=42
        w, h, x, y = 360, 42, 24, 24
        self.root.geometry(f"{w}x{h}+{x}+{y}")

        # Drag and repositioning support
        self._drag_x = 0
        self._drag_y = 0

        # Outer rounded pill-like frame
        self.frame = tk.Frame(
            self.root,
            bg="#070A12",
            highlightthickness=1,
            highlightbackground="#1E293B",
            cursor="hand2"
        )
        self.frame.pack(fill="both", expand=True)

        self.dot = tk.Label(
            self.frame,
            text="●",
            fg="#64748B",
            bg="#070A12",
            font=("Segoe UI", 13, "bold")
        )
        self.dot.pack(side="left", padx=(14, 6))

        self.label = tk.Label(
            self.frame,
            text="Auren: Standby",
            fg="#94A3B8",
            bg="#070A12",
            font=("Segoe UI", 10, "bold"),
            anchor="w"
        )
        self.label.pack(side="left", fill="both", expand=True, padx=(0, 14))

        # Bind dragging so Farhan can easily move it if it covers something
        for widget in (self.root, self.frame, self.dot, self.label):
            widget.bind("<ButtonPress-1>", self.on_press)
            widget.bind("<B1-Motion>", self.on_motion)

        self.last_mtime = 0
        self.poll_state()

    def on_press(self, event):
        self._drag_x = event.x
        self._drag_y = event.y

    def on_motion(self, event):
        x = self.root.winfo_x() + (event.x - self._drag_x)
        y = self.root.winfo_y() + (event.y - self._drag_y)
        self.root.geometry(f"+{x}+{y}")

    def poll_state(self):
        try:
            if os.path.exists(STATE_FILE):
                mtime = os.path.getmtime(STATE_FILE)
                if mtime != self.last_mtime:
                    self.last_mtime = mtime
                    with open(STATE_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    text = data.get("text", "Auren: Standby")
                    color = data.get("color", "#64748B")
                    border = data.get("border", "#1E293B")
                    alpha = data.get("alpha", 0.88)

                    self.root.attributes("-alpha", alpha)
                    self.frame.config(highlightbackground=border)
                    self.dot.config(fg=color)
                    self.label.config(
                        text=text,
                        fg="#F8FAFC" if color != "#64748B" else "#94A3B8"
                    )
        except Exception:
            pass
        self.root.after(80, self.poll_state)

    def run(self):
        self.root.mainloop()

if __name__ == "__main__":
    app = FloatingHUD()
    app.run()
