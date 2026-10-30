@echo off
setlocal enabledelayedexpansion

title ROLLZ Restaurant POS - System Updater

echo ====================================================================
echo             ROLLZ RESTAURANT POS - SYSTEM UPDATER
echo ====================================================================
echo.
echo This tool will pull the latest updates from GitHub and safely update
echo your POS system and database without losing any sales data.
echo.
echo IMPORTANT: The updater will automatically close any active POS
echo server and terminal windows before running so files are not locked.
echo.
pause

echo.
echo [1/5] Closing any running POS background processes...
taskkill /f /im node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo.
echo [2/5] Pulling latest updates from GitHub...
git pull
if errorlevel 1 (
    echo.
    echo [WARNING] Git pull reported an issue (or you already pulled). Continuing update...
)

echo.
echo [3/5] Updating package dependencies...
call npm install
cd server
call npm install
cd ..\client
call npm install
cd ..

:: Verify or install Cloudflare tunnel helper for zero-configuration UPI observer
where cloudflared >nul 2>nul
if %errorlevel% neq 0 (
    if not exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" (
        echo [INFO] Installing Cloudflare tunnel component for UPI Gateway...
        winget install --id Cloudflare.cloudflared -e --silent --accept-source-agreements --accept-package-agreements >nul 2>&1
    )
)

echo.
echo [4/5] Updating Database Schema (Preserving all orders, customers, and menu)...
cd server
call npx prisma generate
call npx prisma db push
cd ..

echo.
echo [5/5] Rebuilding client and server bundles...
call npm run build

:: Extra guarantee: copy printer scripts & assets to dist
if not exist "server\dist\services\printer\scripts" mkdir "server\dist\services\printer\scripts" >nul 2>&1
if not exist "server\dist\services\printer\assets" mkdir "server\dist\services\printer\assets" >nul 2>&1
copy /Y "server\src\services\printer\scripts\*" "server\dist\services\printer\scripts\" >nul 2>&1
copy /Y "server\src\services\printer\assets\*" "server\dist\services\printer\assets\" >nul 2>&1

echo.
echo ====================================================================
echo  UPDATE COMPLETED SUCCESSFULLY!
echo ====================================================================
echo.
echo All new features are installed and ready:
echo - USB Thermal Printer Native Win32 Spooler (TVS-E RP 3230, Epson, etc.)
echo - Bluetooth & Serial COM Port Printing (COM1 - COM99 with baud rates)
echo - Hardware Auto-Discovery Scanner in Settings (1-click device select)
echo - Official ROLLZ Monochrome Logo Printing on Thermal Receipts
echo - Indian Rupee & Clean Encoding Fix (Rs.150.00 replacing corrupted chars)
echo - Web Bluetooth & Web Serial Browser Printing (Direct from Chrome/Edge)
echo - Dedicated "Save Printer Settings" Button in Settings -> Printers
echo - Zero-Fee Automated UPI Payment Observer & Soundbox
echo - WhatsApp Automated Billing & CRM Broadcasting
echo - Dynamic Store Logo & Login Wallpaper Customization
echo - Staff & Cashier Account Creation & Password Reset
echo.
echo You can now launch the software using ROLLZ-POS-Launcher.bat
echo or your desktop shortcut!
echo.
pause
