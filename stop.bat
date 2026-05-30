@echo off
title SCJYGM Stop All
color 0C
echo Stopping all SCJYGM services...

:: Kill processes bound to SCJYGM service ports (LISTENING only)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":8000 .*LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":8081 .*LISTENING"') do taskkill /PID %%a /F >nul 2>&1

:: Common Expo helper ports
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":19000 .*LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":19001 .*LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":19002 .*LISTENING"') do taskkill /PID %%a /F >nul 2>&1

echo Done. All services stopped.
timeout /t 2 /nobreak >nul
