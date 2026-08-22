@echo off
title Offline APK Builder Server
cls
echo ========================================================
echo     ⚡ Offline APK Builder Server for Android ⚡
echo ========================================================
echo.
echo Launching local server on http://localhost:8080...
echo Opening browser in 2 seconds...
echo.

timeout /t 2 /nobreak > nul
start "" "http://localhost:8080"

powershell -ExecutionPolicy Bypass -File "%~dp0apk_builder_server.ps1"
pause
