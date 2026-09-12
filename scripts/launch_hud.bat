@echo off
cd /d "C:\First Agent"
echo Launcher started at %DATE% %TIME% >> "C:\First Agent\data\launch_hud.log"
"C:\Users\RCP\AppData\Local\Python\pythoncore-3.14-64\python.exe" "C:\First Agent\scripts\voice_hud.py" >> "C:\First Agent\data\launch_hud.log" 2>&1
