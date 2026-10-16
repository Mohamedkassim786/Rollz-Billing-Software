@echo off
setlocal enabledelayedexpansion

title ROLLZ Restaurant POS - Production Terminal Launcher

echo ====================================================================
echo             ROLLZ RESTAURANT POS - SYSTEM STARTUP
echo ====================================================================
echo.

:: 1. Verify Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found in your system PATH.
    echo Please install Node.js v18+ or v20+ from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: 2. Check current directory
if not exist "server\package.json" (
    echo [ERROR] Please run this batch script from the root of the ROLLZ project directory.
    echo Current directory: %CD%
    echo.
    pause
    exit /b 1
)

echo [1/3] Checking environment & database connectivity...
:: Launch health check or prisma validation
cd server
call npx prisma generate >nul 2>&1
cd ..

echo [2/3] Starting ROLLZ Backend API Server (Port 5000)...
start "ROLLZ POS Backend Server" cmd /k "cd /d %CD%\server && npm run dev"

:: Wait 3 seconds for server initialization
timeout /t 3 /nobreak >nul

echo [3/3] Starting ROLLZ Frontend Terminal (Port 5173)...
start "ROLLZ POS Terminal Client" cmd /k "cd /d %CD%\client && npm run dev"

:: Wait 2 seconds for client initialization
timeout /t 2 /nobreak >nul

echo.
echo ====================================================================
echo  ROLLZ POS IS RUNNING!
echo.
echo  Local Terminal:       http://localhost:5173
echo  Backend API / Health: http://localhost:5000/api/health
echo.
echo  To access from other devices on the restaurant LAN:
echo  1. Run 'ipconfig' in command prompt to find your local IPv4 address
echo     (e.g., 192.168.1.100).
echo  2. Open http://<YOUR_LAN_IP>:5173 on any authorized tablet or PC.
echo ====================================================================
echo.

:: Automatically open default browser to POS terminal
start http://localhost:5173

echo Keep the backend and frontend terminal windows open while operating.
echo Press any key to exit this launcher window (services will stay running).
pause >nul
