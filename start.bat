@echo off
title SCJYGM Launcher
color 0A

echo ============================================
echo   SCJYGM - Starting All Services
echo ============================================
echo.

:: --- FastAPI Backend (port 8000) ---
echo [1/3] Starting API on http://localhost:8000 ...
start "SCJYGM - API (port 8000)" cmd /k "cd /d %~dp0services\api && venv\Scripts\uvicorn.exe main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak >nul

:: --- Next.js Admin (port 3000) ---
echo [2/3] Starting Admin on http://localhost:3000 ...
start "SCJYGM - Admin (port 3000)" cmd /k "cd /d %~dp0apps\admin && npx next dev --port 3000"

timeout /t 2 /nobreak >nul

:: --- Expo Mobile + Web (port 8081) ---
echo [3/3] Starting Mobile/Web on exp://... and http://localhost:8081 ...
start "SCJYGM - Mobile/Web (port 8081)" cmd /k "cd /d %~dp0apps\mobile && npx expo start --port 8081 --clear"

echo.
echo ============================================
echo   All services launched in separate windows
echo.
echo   Web    : http://localhost:8081
echo   Admin  : http://localhost:3000
echo   API    : http://localhost:8000
echo   Mobile : Scan QR in the Expo window
echo ============================================
echo.

:: Open browser tabs after services have time to start
echo Waiting 10 seconds then opening browser tabs...
timeout /t 10 /nobreak >nul
start "" "http://localhost:8081"
start "" "http://localhost:3000"

echo Browsers opened. Close this window whenever you like.
pause
