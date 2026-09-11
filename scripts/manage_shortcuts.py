#!/usr/bin/env python3
"""
Auren AI — Custom Voice Shortcuts & Quick Command Manager
Allows adding, listing, testing, and managing voice/chat shortcuts without coding.
"""
import os
import sys
import json
import uuid

SHORTCUTS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "custom_shortcuts.json"))

def ensure_file():
    os.makedirs(os.path.dirname(SHORTCUTS_PATH), exist_ok=True)
    if not os.path.isfile(SHORTCUTS_PATH):
        with open(SHORTCUTS_PATH, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)

def load_shortcuts():
    ensure_file()
    try:
        with open(SHORTCUTS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception as e:
        print(f"[Error reading shortcuts]: {e}")
        return []

def save_shortcuts(shortcuts):
    ensure_file()
    with open(SHORTCUTS_PATH, "w", encoding="utf-8") as f:
        json.dump(shortcuts, f, indent=2)

def list_shortcuts():
    shortcuts = load_shortcuts()
    print("\n" + "=" * 70)
    print("               CURRENT AUREN VOICE SHORTCUTS")
    print("=" * 70)
    if not shortcuts:
        print("  No custom shortcuts configured yet.")
    else:
        for idx, s in enumerate(shortcuts, 1):
            status = "ACTIVE" if s.get("enabled", True) else "DISABLED"
            print(f"[{idx}] {s.get('name', 'Unnamed')} ({status})")
            print(f"    Triggers: {', '.join(s.get('triggers', []))}")
            print(f"    Target:   {s.get('target')}")
            print(f"    Browser:  {s.get('browser', 'edge')}")
            print(f"    Response: {s.get('response', '')}")
            print("-" * 70)
    print()

def add_shortcut():
    print("\n" + "=" * 70)
    print("                     ADD NEW VOICE SHORTCUT")
    print("=" * 70)
    name = input("Shortcut Name (e.g. Nila, Work Dashboard, Spotify Playlist): ").strip()
    if not name:
        print("[!] Name cannot be empty.")
        return

    triggers_input = input("Voice Trigger Words (comma-separated, e.g. nila, open nila, chat nila): ").strip()
    triggers = [t.strip().lower() for t in triggers_input.split(",") if t.strip()]
    if not triggers:
        triggers = [name.lower()]

    target = input("Target URL or App Path (e.g. https://... or notepad or chrome): ").strip()
    if not target:
        print("[!] Target cannot be empty.")
        return

    action = "open_url" if target.startswith(("http://", "https://", "www.")) else "launch_app"
    browser = "edge"
    if action == "open_url":
        b_choice = input("Preferred Browser ([1] Microsoft Edge (Default), [2] Google Chrome): ").strip()
        if b_choice == "2":
            browser = "chrome"

    response = input(f"Auren Spoken Response [press Enter for 'Opening {name}']: ").strip()
    if not response:
        response = f"Opening {name} for you."

    shortcut = {
        "id": f"sc-{uuid.uuid4().hex[:8]}",
        "name": name,
        "triggers": triggers,
        "action": action,
        "target": target,
        "browser": browser,
        "response": response,
        "enabled": True
    }

    shortcuts = load_shortcuts()
    shortcuts.append(shortcut)
    save_shortcuts(shortcuts)
    print(f"\n[SUCCESS] Custom shortcut '{name}' registered successfully!")
    print(f"Trigger with voice or text: '{triggers[0]}'\n")

def delete_shortcut():
    shortcuts = load_shortcuts()
    if not shortcuts:
        print("\n[!] No shortcuts to delete.\n")
        return

    list_shortcuts()
    choice = input("Enter shortcut number to delete (or 0 to cancel): ").strip()
    try:
        idx = int(choice)
        if 1 <= idx <= len(shortcuts):
            removed = shortcuts.pop(idx - 1)
            save_shortcuts(shortcuts)
            print(f"\n[SUCCESS] Deleted shortcut '{removed.get('name')}'.\n")
        else:
            print("Cancelled.")
    except ValueError:
        print("Invalid number.")

def open_json():
    print(f"\nOpening {SHORTCUTS_PATH} in Notepad...\n")
    os.system(f'notepad.exe "{SHORTCUTS_PATH}"')

def main():
    while True:
        print("=" * 70)
        print("          AUREN AI — CUSTOM VOICE SHORTCUTS PROGRAM")
        print("=" * 70)
        print("  [1] List All Shortcuts")
        print("  [2] Add New Shortcut")
        print("  [3] Delete Shortcut")
        print("  [4] Open JSON File in Notepad")
        print("  [0] Exit")
        print("=" * 70)
        choice = input("Select an option (0-4): ").strip()
        if choice == "1":
            list_shortcuts()
        elif choice == "2":
            add_shortcut()
        elif choice == "3":
            delete_shortcut()
        elif choice == "4":
            open_json()
        elif choice == "0":
            print("\nGoodbye!\n")
            break
        else:
            print("\n[!] Invalid option, please choose between 0 and 4.\n")

if __name__ == "__main__":
    main()
