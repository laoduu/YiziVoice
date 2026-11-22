@echo off
title YiziVoice
cd /d "%~dp0"

echo ========================================
echo   YiziVoice - MiMo TTS/ASR Voice Tool
echo ========================================
echo.

if not exist "node_modules" (
    echo [INFO] First run detected, installing dependencies...
    echo.
    call npm install
    echo.
)

echo [INFO] Starting YiziVoice (Tauri dev)...
echo.
call npm run tauri:dev
