@echo off
title StudyBuddy Mobile App
color 0B

echo ==========================================
echo      STUDYBUDDY FRONTEND LAUNCHER
echo ==========================================

:: 1. Check for Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please tell your friend to install Node.js from nodejs.org
    pause
    exit
)

:: 2. Smart Install
if not exist "node_modules" (
    echo [INFO] First run detected. Installing libraries...
    echo Please wait, this might take a few minutes...
    call npm install
) else (
    echo [INFO] Libraries already installed. Launching fast!
)

:: 3. Start the App
echo.
echo [SUCCESS] Starting Expo...
echo [TIP] Press 'w' to open in Browser. Scan QR with your phone.
echo.
call npx expo start

pause