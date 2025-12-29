@echo off
title StudyBuddy Launcher
color 0E

echo ==========================================
echo    🚀 STARTING STUDYBUDDY SYSTEM 🚀
echo ==========================================
echo.

:: 1. Launch Backend in a separate window
echo [1/2] Spawning Backend Server...
:: /d tells it which folder to start in
start "StudyBuddy Server" /d "Backend" START_SERVER.bat

:: 2. Wait 2 seconds just to be safe
timeout /t 2 /nobreak >nul

:: 3. Launch Frontend in a separate window
echo [2/2] Spawning Mobile App...
start "StudyBuddy App" /d "StudyBuddy" START_FRONTEND.bat

echo.
echo ✅ SYSTEM IS LIVE!
echo You can minimize this window (or close it).
pause