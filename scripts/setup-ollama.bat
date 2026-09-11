@echo off
REM ==============================================================================
REM Auren AI v1.0 — Local Ollama Engine Setup & Model Installer
REM Installs Ollama for Windows and pulls recommended lightweight local models
REM tailored for 8GB RAM + Intel CPU systems (Qwen 2.5 1.5B / Llama 3.2 3B).
REM ==============================================================================

echo ==============================================================================
echo              AUREN AI — LOCAL LLM & OLLAMA ENGINE SETUP                      
echo ==============================================================================
echo.

REM 1. Check if Ollama is already installed
where ollama >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Ollama is already installed!
    goto check_service
)

if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
    echo [OK] Found Ollama in %LOCALAPPDATA%\Programs\Ollama
    set "PATH=%LOCALAPPDATA%\Programs\Ollama;%PATH%"
    goto check_service
)

echo [INFO] Ollama was not detected on your system.
echo [INFO] Installing Ollama via Windows Package Manager (winget)...
echo.
winget install Ollama.Ollama --accept-source-agreements --accept-package-agreements

if %errorlevel% neq 0 (
    echo.
    echo [NOTICE] If winget requires elevation or failed, you can also download
    echo          Ollama directly from: https://ollama.com/download/windows
    pause
    exit /b 1
)

set "PATH=%LOCALAPPDATA%\Programs\Ollama;%PATH%"

:check_service
echo.
echo [INFO] Checking if Ollama service is running on port 11434...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:11434/api/version' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; exit 1"

if %errorlevel% neq 0 (
    echo [INFO] Starting Ollama daemon in the background...
    start "" ollama serve
    timeout /t 3 /nobreak >nul
)

echo.
echo ==============================================================================
echo  Recommended models for 8GB RAM systems:
echo   1. qwen2.5:1.5b  (~1.1 GB RAM - Ultra-fast, coding & native tool calling) [Recommended]
echo   2. llama3.2:3b   (~2.0 GB RAM - Meta's best compact conversational model)
echo   3. deepseek-r1:1.5b (~1.1 GB RAM - Local chain-of-thought reasoning)
echo ==============================================================================
echo.
echo [INFO] Pulling recommended default model: qwen2.5:1.5b...
echo        (This runs once to store the model locally on your drive)
echo.

ollama pull qwen2.5:1.5b

echo.
echo ==============================================================================
echo [SUCCESS] Local Ollama Engine is ready and configured!
echo You can now select 'Local LLM (Ollama)' in Auren to run completely offline!
echo ==============================================================================
echo.
pause
exit /b 0
