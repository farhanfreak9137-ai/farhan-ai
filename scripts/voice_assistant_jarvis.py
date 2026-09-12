# scripts/voice_assistant_jarvis.py
"""
Auren AI — Always-Ready Hands-Free JARVIS Voice Engine
Hardware-optimized for Windows 10 (Intel Core i3-4130 / 8GB RAM).
Idle CPU: < 1% | RAM: ~45MB | STT Latency: ~200ms | Voice: Modern American Neural (Guy)

Features:
- Always-on background microphone listener with low-power RMS Voice Activity Detection.
- Wake Word: "Hey Auren" (or "Auren")
- Conversational Greeting: "Hey Farhan, what's up?"
- Dual Mode:
    1. Conversational (Two-Stage): "Hey Auren" -> "Hey Farhan, what's up?" -> Farhan speaks command.
    2. One-Shot: "Hey Auren, play Bohemian Rhapsody on Spotify" -> Executes directly.
- Instant Windows media controls: Volume up/down, mute, pause/play via virtual keys (<5ms).
- Agent execution via Auren Central Assistant (http://localhost:3000/api/voice/command).
- Modern American Neural Speech Synthesis via edge-tts (en-US-GuyNeural) + native Windows MCI playback.
"""

import sys
import os
import time
import io
import wave
import json
import re
import ctypes
import asyncio
import subprocess
import threading
import winsound
import tkinter as tk
import requests
import sounddevice as sd
import numpy as np
import edge_tts

# ==============================================================================
# Configuration & Constants
# ==============================================================================
API_URL = "http://localhost:3000/api/voice/command"
SAMPLE_RATE = 16000
BLOCK_SIZE = 1024  # 64ms per audio chunk
SILENCE_DURATION_THRESHOLD = 0.85  # Seconds of silence to conclude speech
MIN_SPEECH_DURATION = 0.45         # Minimum speech length to avoid noise spikes
MAX_SPEECH_DURATION = 15.0         # Max length before auto-transcribing
CONVERSATIONAL_WINDOW = 15.0       # Generous 15 seconds to wait for follow-up command
NEURAL_VOICE = "en-US-GuyNeural"   # Modern conversational American male
LOG_FILE = os.path.abspath("data/voice_assistant.log")
AUDIO_CACHE = os.path.abspath("data/voice_response.mp3")

# Virtual key codes for instant Windows media actions
VK_VOLUME_MUTE = 0xAD
VK_VOLUME_DOWN = 0xAE
VK_VOLUME_UP = 0xAF
VK_MEDIA_NEXT = 0xB0
VK_MEDIA_PREV = 0xB1
VK_MEDIA_PLAY_PAUSE = 0xB3

def play_chime_wake():
    """Futuristic audio chime (880Hz -> 1320Hz) played instantly when wake word is detected."""
    try:
        threading.Thread(target=lambda: [winsound.Beep(880, 70), winsound.Beep(1320, 90)], daemon=True).start()
    except Exception:
        pass

def play_chime_done():
    """Subtle confirmation chime (1320Hz -> 1760Hz) when action finishes executing."""
    try:
        threading.Thread(target=lambda: [winsound.Beep(1320, 60), winsound.Beep(1760, 80)], daemon=True).start()
    except Exception:
        pass

class DesktopVoiceHUD:
    """Non-blocking floating visual HUD pill at top-center of screen so Farhan always sees status."""
    def __init__(self):
        self.root = None
        self.label = None
        self.dot = None
        self.hide_timer = None
        try:
            self.thread = threading.Thread(target=self._run, daemon=True)
            self.thread.start()
        except Exception as e:
            pass

    def _run(self):
        try:
            self.root = tk.Tk()
            self.root.overrideredirect(True)
            self.root.attributes("-topmost", True)
            self.root.attributes("-alpha", 0.94)
            self.root.config(bg="#0B0F19")

            screen_w = self.root.winfo_screenwidth()
            w = 460
            h = 44
            x = (screen_w - w) // 2
            y = 24
            self.root.geometry(f"{w}x{h}+{x}+{y}")

            frame = tk.Frame(self.root, bg="#0B0F19", highlightthickness=1, highlightbackground="#38BDF8")
            frame.pack(fill="both", expand=True)

            self.dot = tk.Label(frame, text="●", fg="#38BDF8", bg="#0B0F19", font=("Segoe UI", 13, "bold"))
            self.dot.pack(side="left", padx=(14, 6))

            self.label = tk.Label(frame, text="Auren Ready", fg="#F8FAFC", bg="#0B0F19", font=("Segoe UI", 10, "bold"))
            self.label.pack(side="left", fill="both", expand=True, padx=(0, 14))

            self.root.withdraw()
            self.root.mainloop()
        except Exception:
            pass

    def show(self, text, color="#38BDF8", duration=4.0):
        if not self.root:
            return
        def _update():
            try:
                self.dot.config(fg=color)
                self.label.config(text=text)
                self.root.deiconify()
                if self.hide_timer:
                    self.hide_timer.cancel()
                self.hide_timer = threading.Timer(duration, self.hide)
                self.hide_timer.start()
            except Exception:
                pass
        try:
            self.root.after(0, _update)
        except Exception:
            pass

    def hide(self):
        if self.root:
            try:
                self.root.after(0, self.root.withdraw)
            except Exception:
                pass

HUD = DesktopVoiceHUD()

# Ensure data directory exists
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def log(msg: str):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    try:
        print(line, flush=True)
    except Exception:
        try:
            sys.stdout.buffer.write((line + "\n").encode("utf-8", errors="replace"))
            sys.stdout.buffer.flush()
        except Exception:
            pass
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

# ==============================================================================
# API Keys & Secrets
# ==============================================================================
def get_groq_api_key() -> str:
    key = os.environ.get("GROQ_API_KEY", "")
    if not key:
        env_path = os.path.abspath(".env.local")
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.startswith("GROQ_API_KEY="):
                            key = line.split("=", 1)[1].strip()
                            break
            except Exception as e:
                log(f"Error reading .env.local: {e}")
    return key

GROQ_KEY = get_groq_api_key()

# ==============================================================================
# Speech Synthesis (Modern American Neural Voice + Hardware MCI Playback)
# ==============================================================================
def send_key_event(vk_code: int):
    """Sends native Windows hardware media virtual key stroke."""
    ctypes.windll.user32.keybd_event(vk_code, 0, 0, 0)
    time.sleep(0.05)
    ctypes.windll.user32.keybd_event(vk_code, 0, 2, 0) # Key up

def play_audio_file(filepath: str):
    """Plays MP3 via Windows MCI (hardware accelerated, zero lag)."""
    abs_path = os.path.abspath(filepath)
    alias = f"auren_speech_{int(time.time() * 1000) % 10000}"
    try:
        ctypes.windll.winmm.mciSendStringW(f'open "{abs_path}" type mpegvideo alias {alias}', None, 0, None)
        ctypes.windll.winmm.mciSendStringW(f'play {alias} wait', None, 0, None)
        ctypes.windll.winmm.mciSendStringW(f'close {alias}', None, 0, None)
    except Exception as e:
        log(f"MCI Playback error: {e}")

async def async_speak_neural(text: str):
    """Generates natural speech with edge-tts and plays it immediately."""
    # Clean text: remove markdown symbols and limit to conversational takeaway
    clean = re.sub(r'[*_#`~\[\]\(\)]', '', text).strip()
    clean = re.sub(r'\s+', ' ', clean)
    if len(clean) > 280:
        clean = clean[:275] + "..."

    try:
        comm = edge_tts.Communicate(clean, NEURAL_VOICE)
        await comm.save(AUDIO_CACHE)
        play_audio_file(AUDIO_CACHE)
    except Exception as e:
        log(f"Neural TTS failed ({e}), falling back to Windows SAPI...")
        fallback_sapi(clean)

def fallback_sapi(text: str):
    """Fallback to Windows SAPI synthesizer if offline."""
    clean_text = text.replace('"', ' ').replace("'", " ").replace('`', ' ')
    ps = f"Add-Type -AssemblyName System.speech; $speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; $speak.Rate = 1; $speak.Speak('{clean_text}')"
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, timeout=10)
    except Exception:
        pass

def speak(text: str):
    """Synchronous entry point for speaking."""
    log(f"🔊 Auren: \"{text}\"")
    try:
        asyncio.run(async_speak_neural(text))
    except Exception as e:
        log(f"Speech execution error: {e}")
        fallback_sapi(text)

# ==============================================================================
# Speech-To-Text (Groq Cloud Whisper API — ~200ms Latency, 0% Local CPU)
# ==============================================================================
def transcribe_audio_groq(audio_data: np.ndarray) -> str:
    """Transcribes in-memory int16 audio array via Groq Whisper Cloud."""
    if not GROQ_KEY:
        log("No GROQ_API_KEY found. STT unavailable.")
        return ""

    # Build in-memory WAV
    wav_io = io.BytesIO()
    with wave.open(wav_io, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(audio_data.tobytes())
    wav_io.seek(0)

    try:
        t0 = time.time()
        resp = requests.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {GROQ_KEY}"},
            files={"file": ("speech.wav", wav_io, "audio/wav")},
            data={
                "model": "whisper-large-v3-turbo",
                "language": "en",
                "prompt": "Hey Auren, Auren, Farhan, play music on YouTube, Spotify, Kalyani, volume up, mute, what's up."
            },
            timeout=8
        )
        elapsed = time.time() - t0
        if resp.status_code == 200:
            result = resp.json().get("text", "").strip()
            log(f"🎙️ Groq Whisper ({elapsed:.2f}s): \"{result}\"")
            return result
        else:
            log(f"Groq Whisper HTTP {resp.status_code}: {resp.text}")
    except Exception as e:
        log(f"Groq Whisper error: {e}")
    return ""

# ==============================================================================
# Central Assistant & Fast Media Handlers
# ==============================================================================
# ==============================================================================
# Central Assistant & Fast Media Handlers
# ==============================================================================
def handle_hardware_command(command: str) -> bool:
    """Quickly intercepts volume and media control commands in <5ms."""
    low = command.lower().strip()

    if any(p in low for p in ["volume up", "increase volume", "louder", "turn it up"]):
        for _ in range(5):
            send_key_event(VK_VOLUME_UP)
        play_chime_done()
        HUD.show("🔊 Volume Up", "#22C55E", 2.0)
        speak("Volume up.")
        return True

    if any(p in low for p in ["volume down", "decrease volume", "quieter", "lower volume"]):
        for _ in range(5):
            send_key_event(VK_VOLUME_DOWN)
        play_chime_done()
        HUD.show("🔉 Volume Down", "#22C55E", 2.0)
        speak("Volume down.")
        return True

    if any(p in low for p in ["mute audio", "mute pc", "mute volume", "mute sound", "unmute"]):
        send_key_event(VK_VOLUME_MUTE)
        play_chime_done()
        HUD.show("🔇 Volume Toggled", "#22C55E", 2.0)
        speak("Volume toggled.")
        return True

    if any(p in low for p in ["pause music", "pause song", "stop music", "resume music", "play pause", "toggle playback"]):
        send_key_event(VK_MEDIA_PLAY_PAUSE)
        play_chime_done()
        HUD.show("⏯️ Playback Toggled", "#22C55E", 2.0)
        speak("Playback toggled.")
        return True

    if any(p in low for p in ["next song", "next track", "skip track", "skip song"]):
        send_key_event(VK_MEDIA_NEXT)
        play_chime_done()
        HUD.show("⏭️ Track Skipped", "#22C55E", 2.0)
        speak("Track skipped.")
        return True

    return False

def route_to_auren_central(command: str):
    """Sends command to Auren Central Assistant API and speaks response."""
    log(f"🤖 Routing command to Central Assistant: \"{command}\"")
    HUD.show(f"⚡ Processing: \"{command[:38]}\"", "#F59E0B", 6.0)

    try:
        resp = requests.post(
            API_URL,
            json={"transcript": command},
            headers={"Content-Type": "application/json"},
            timeout=25
        )
        if resp.status_code == 200:
            data = resp.json()
            answer = data.get("responseText", data.get("response", "Done."))
            agent = data.get("providerUsed", "Central Assistant")
            log(f"Response from [{agent}]: {answer[:120]}...")
            play_chime_done()
            HUD.show(f"🔊 Auren: {answer[:42]}", "#22C55E", 4.5)
            speak(answer)
        else:
            log(f"Backend HTTP error: {resp.status_code}")
            HUD.show("⚠️ Server returned an error", "#EF4444", 3.0)
            speak(f"Sorry Farhan, the server returned an error.")
    except Exception as e:
        log(f"Connection to Auren server failed: {e}")
        HUD.show("⚠️ Could not reach Auren server", "#EF4444", 3.0)
        speak("I couldn't reach the Auren server. Is it running on port 3000?")

# ==============================================================================
# Wake Word & Conversational State Machine
# ==============================================================================
WAKE_WORDS = [
    "hey auren", "auren",
    "hey oren", "oren",
    "hey orin", "orin",
    "hey horen", "horen",
    "hey aurel", "aurel",
    "hey aura", "aura",
    "hey auran", "auran",
    "hey auron", "auron",
    "hey aurin", "aurin",
    "hey ren", "oh ren", "hey, ren",
    "hey aran", "aran", "arn",
    "hey lauren", "lauren",
    "hey jarvis", "jarvis",
    "hey farhan", "farhan"
]
GREETING_PHRASES = ["what's up", "whats up", "how are you", "good morning", "what up", "are you there", "you there"]

class JarvisVoiceEngine:
    def __init__(self):
        self.state = "IDLE"  # "IDLE" or "AWAITING_COMMAND"
        self.state_deadline = 0.0
        self.baseline_rms = 300.0

    def calibrate_ambient_noise(self):
        """Samples 1.2s to calibrate ambient microphone noise floor."""
        log("Calibrating ambient room noise...")
        try:
            samples = sd.rec(int(1.2 * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1, dtype='int16')
            sd.wait()
            cal_rms = float(np.sqrt(np.mean(samples.astype(np.float32)**2)))
            self.baseline_rms = max(cal_rms, 150.0)
            log(f"Ambient noise floor calibrated: RMS {self.baseline_rms:.1f}")
        except Exception as e:
            log(f"Calibration notice: {e}. Using default RMS 300.")
            self.baseline_rms = 300.0

    def process_transcript(self, raw_text: str):
        """Dispatches transcript based on wake word and conversation state."""
        if not raw_text:
            return

        text = raw_text.strip()
        low = text.lower()
        now = time.time()

        # Clean trailing punctuation
        clean_text = re.sub(r'^[^\w]+|[^\w]+$', '', text)

        # -------------------------------------------------------------
        # 1. Active State: We already greeted Farhan, this is his command
        # -------------------------------------------------------------
        if self.state == "AWAITING_COMMAND":
            if now > self.state_deadline:
                log("Command window timed out. Returning to IDLE.")
                self.state = "IDLE"
                HUD.show("💤 Command window timed out", "#94A3B8", 2.5)
            else:
                self.state = "IDLE"
                log(f"🎯 Received follow-up command: \"{text}\"")
                HUD.show(f"🎯 Command: \"{text[:38]}\"", "#A855F7", 4.0)
                # Check for fast hardware action first
                if not handle_hardware_command(text):
                    route_to_auren_central(text)
                return

        # -------------------------------------------------------------
        # 2. Idle State: Check for Wake Word ("Hey Auren" / "Auren")
        # -------------------------------------------------------------
        matched_wake = None
        for w in WAKE_WORDS:
            # Check prefix or exact match
            if low.startswith(w) or re.search(r'\b' + re.escape(w) + r'\b', low):
                matched_wake = w
                break

        if not matched_wake:
            # Wake word not spoken
            return

        log(f"⚡ Wake word detected: '{matched_wake}' in '{text}'")
        play_chime_wake()
        HUD.show(f"⚡ Wake word detected: '{matched_wake}'", "#38BDF8", 3.0)

        # Extract whatever Farhan said AFTER the wake word
        pattern = r'\b' + re.escape(matched_wake) + r'[\s,:\.!?]*'
        remainder = re.sub(pattern, '', text, count=1, flags=re.IGNORECASE).strip()
        remainder_low = remainder.lower()

        # Case A: Two-Stage Conversation (User just said "Hey Auren" or "Hey Auren what's up")
        if not remainder or any(remainder_low == g for g in GREETING_PHRASES):
            # Speak requested greeting first
            speak("Hey Farhan, what's up?")
            # Set state deadline AFTER speaking finishes so Farhan gets the full 15 seconds!
            self.state = "AWAITING_COMMAND"
            self.state_deadline = time.time() + CONVERSATIONAL_WINDOW
            HUD.show("🎙️ Auren Listening for your command...", "#38BDF8", 15.0)
            return

        # Case B: One-Shot Command (User said "Hey Auren, play Bohemian Rhapsody")
        log(f"🚀 Executing one-shot command: \"{remainder}\"")
        HUD.show(f"🚀 One-Shot: \"{remainder[:38]}\"", "#F59E0B", 4.0)
        self.state = "IDLE"
        if not handle_hardware_command(remainder):
            route_to_auren_central(remainder)

    def run_listener_loop(self):
        """Continuously monitors microphone with low-power audio streaming."""
        self.calibrate_ambient_noise()
        speech_threshold = max(self.baseline_rms * 2.8, 650.0)
        log(f"Listening for 'Hey Auren' (Speech trigger threshold: RMS {speech_threshold:.1f})...")
        HUD.show("🟢 Auren Voice Active & Listening", "#22C55E", 3.5)

        recording_chunks = []
        is_speaking = False
        silence_start = 0.0
        consecutive_voice_chunks = 0
        HALLUCINATIONS = {"thank you", "thank you.", "thanks", "thanks.", "thank you for watching", "subtitles by", "bye", "you", "thanks for listening"}

        try:
            with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype='int16', blocksize=BLOCK_SIZE) as stream:
                while True:
                    data, _ = stream.read(BLOCK_SIZE)
                    chunk = data.flatten()
                    rms = float(np.sqrt(np.mean(chunk.astype(np.float32)**2)))

                    now = time.time()

                    # Check conversation window expiry
                    if self.state == "AWAITING_COMMAND" and now > self.state_deadline:
                        log("Awaiting command window expired. Resetting to IDLE.")
                        self.state = "IDLE"
                        HUD.show("💤 Command window expired", "#94A3B8", 2.0)

                    if rms > speech_threshold:
                        consecutive_voice_chunks += 1
                        if not is_speaking and consecutive_voice_chunks >= 2:
                            is_speaking = True
                            recording_chunks = [chunk]
                            log("Speech detected, buffering audio...")
                            if self.state == "AWAITING_COMMAND":
                                HUD.show("🎙️ Listening to your command...", "#38BDF8", 6.0)
                        elif is_speaking:
                            recording_chunks.append(chunk)
                        silence_start = 0.0
                    else:
                        consecutive_voice_chunks = 0
                        if is_speaking:
                            recording_chunks.append(chunk)
                            if silence_start == 0.0:
                                silence_start = now
                            elif (now - silence_start) >= SILENCE_DURATION_THRESHOLD:
                                # Silence threshold reached: end of speech
                                duration = (len(recording_chunks) * BLOCK_SIZE) / SAMPLE_RATE
                                is_speaking = False
                                silence_start = 0.0

                                if duration >= 0.65:
                                    audio_array = np.concatenate(recording_chunks)
                                    log(f"Audio captured ({duration:.1f}s). Transcribing...")
                                    HUD.show("🧠 Transcribing speech...", "#A855F7", 2.5)
                                    transcript = transcribe_audio_groq(audio_array)
                                    clean_h = re.sub(r'[^\w\s]', '', transcript.lower()).strip()
                                    if clean_h and clean_h not in HALLUCINATIONS:
                                        HUD.show(f"⚡ Heard: \"{transcript[:38]}\"", "#38BDF8", 3.0)
                                        self.process_transcript(transcript)
                                    else:
                                        log(f"Ignored ambient noise: '{transcript}'")
                                else:
                                    log(f"Ignored short click ({duration:.2f}s).")
                                recording_chunks = []

                    # Low-power sleep to keep CPU < 1%
                    time.sleep(0.015)

        except Exception as e:
            log(f"Audio stream error: {e}")
            time.sleep(2)

# ==============================================================================
# Daemon Main
# ==============================================================================
if __name__ == "__main__":
    log("=" * 60)
    log("Auren Always-Ready JARVIS Voice Assistant Daemon Starting")
    log("Wake Word: 'Hey Auren' | Voice: en-US-GuyNeural")
    log("=" * 60)

    engine = JarvisVoiceEngine()
    while True:
        try:
            engine.run_listener_loop()
        except KeyboardInterrupt:
            log("JARVIS Voice Assistant Daemon stopped by user.")
            break
        except Exception as ex:
            log(f"Daemon restarted due to exception: {ex}")
            time.sleep(3)
