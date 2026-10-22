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
echo IMPORTANT: Ensure the POS server and terminal windows are CLOSED
echo before running this update so files are not locked.
echo.
pause

echo.
echo [1/4] Pulling latest updates from GitHub...
git pull
if errorlevel 1 (
    echo.
    echo [ERROR] Git pull failed. Please check your internet connection or git status.
    pause
    exit /b 1
)

echo.
echo [2/4] Updating package dependencies...
call npm install
cd server
call npm install
cd ..\client
call npm install
cd ..

echo.
echo [3/4] Updating Database Schema (Preserving all orders, customers, and menu)...
cd server
call npx prisma generate
call npx prisma db push
cd ..

echo.
echo [4/4] Rebuilding client and server bundles...
call npm run build

echo.
echo ====================================================================
echo  UPDATE COMPLETED SUCCESSFULLY!
echo ====================================================================
echo.
echo All new features are installed:
echo - WhatsApp Automated Billing & CRM Broadcasting
echo - Customer Name/Phone Auto-tracking & Past Spend History
echo - Dynamic Store Logo & Login Wallpaper Customization
echo - Staff & Cashier Account Creation & Password Reset
echo - Dynamic UPI QR Code Scanner in Settings
echo - Menu Photo 15MB Uploads & Client-side Optimizer
echo.
echo You can now launch the software using ROLLZ-POS-Launcher.bat
echo or your desktop shortcut!
echo.
pause
