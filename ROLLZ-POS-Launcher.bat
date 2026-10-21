@echo off
setlocal

cd /d "%~dp0"
title ROLLZ POS - System Launcher

echo ====================================================================
echo         ROLLZ FAST FOOD - BILLING SOFTWARE LAUNCHER
echo ====================================================================
echo.

:: 1. Detect Chrome or Edge
set "TARGET_BROWSER="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "TARGET_BROWSER=C:\Program Files\Google\Chrome\Application\chrome.exe"
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set "TARGET_BROWSER=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)
if "%TARGET_BROWSER%"=="" (
    if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
        set "TARGET_BROWSER=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    )
)
if "%TARGET_BROWSER%"=="" (
    if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
        set "TARGET_BROWSER=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    )
)

:: 2. Check if Backend API on port 5000 is running
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo [1/3] Starting Backend Server on port 5000...
    start "ROLLZ POS Backend" /min cmd /c "cd /d ""%~dp0server"" && npm run dev"
) else (
    echo [1/3] Backend Server is already active.
)

:: 3. Check if Frontend Terminal on port 5173 is running
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo [2/3] Starting Frontend Terminal on port 5173...
    start "ROLLZ POS Frontend" /min cmd /c "cd /d ""%~dp0client"" && npm run dev"
) else (
    echo [2/3] Frontend Terminal is already active.
)

:: 4. Wait for Vite server to respond (max 20 seconds)
echo [3/3] Connecting to POS Terminal...
set ATTEMPTS=0

:CHECK_LOOP
set /a ATTEMPTS=ATTEMPTS+1
powershell -NoProfile -Command "try { $r = [System.Net.WebRequest]::Create('http://localhost:5173'); $r.Timeout = 800; $resp = $r.GetResponse(); $resp.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto LAUNCH_APP

if %ATTEMPTS% geq 20 (
    echo Server start took longer than expected. Opening anyway...
    goto LAUNCH_APP
)

ping 127.0.0.1 -n 2 >nul
goto CHECK_LOOP

:LAUNCH_APP
echo.
echo Launching ROLLZ Billing Software Window...
if not "%TARGET_BROWSER%"=="" (
    start "" "%TARGET_BROWSER%" --app=http://localhost:5173
) else (
    start http://localhost:5173
)

ping 127.0.0.1 -n 2 >nul
exit
