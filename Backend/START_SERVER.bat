@echo off
title StudyBuddy Backend Server
color 0A

echo ==========================================
echo      STUDYBUDDY AI SERVER SETUP
echo ==========================================

:: 1. Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.9+ and check "Add to PATH" in the installer.
    pause
    exit
)

:: 2. Create Virtual Environment (if missing)
if not exist "venv" (
    echo [INFO] Creating virtual environment...
    python -m venv venv
)

:: 3. Activate & Install
echo [INFO] Activating environment...
call venv\Scripts\activate

echo [INFO] Installing requirements (this might take a minute)...
pip install -r requirements.txt

:: 4. Run the App
echo.
echo [SUCCESS] Starting Server...
echo [NOTE] Keep this window OPEN while using the app.
echo.
python backend_api.py

pause